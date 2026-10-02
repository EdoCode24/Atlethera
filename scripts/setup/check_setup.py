"""Checks .env.local against the live services: keys present and valid, e-mail confirmation off,
schema applied, LiveKit reachable. Prints one line per check; secrets are never printed.

Usage: python scripts/setup/check_setup.py
"""
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

# Windows consoles default to a legacy code page.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
results: list[tuple[str, bool, str]] = []


def env() -> dict[str, str]:
    values: dict[str, str] = {}
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip().strip('"').strip("'")
    return values


def check(name: str, ok: bool, hint: str = "") -> None:
    results.append((name, ok, hint))


def http(method: str, url: str, headers: dict, body: bytes | None = None):
    req = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": "atlethera-setup", **headers})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            raw = res.read().decode()
            return res.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:  # DNS, TLS, timeout
        return 0, str(e)


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def livekit_jwt(key: str, secret: str) -> str:
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    now = int(time.time())
    payload = b64(json.dumps({"iss": key, "nbf": now, "exp": now + 300, "sub": "setup-check", "video": {"roomList": True}}).encode())
    signature = b64(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def main() -> int:
    v = env()
    url = v.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    anon = v.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
    secret = v.get("SUPABASE_SECRET_KEY", "")

    check("Supabase URL filled in", bool(re.match(r"https://[a-z0-9]+\.supabase\.co$", url)), "Project Settings → Data API / Connect: https://<ref>.supabase.co")
    check("publishable key filled in", anon.startswith("sb_publishable_") or anon.startswith("eyJ"), "Project Settings → API Keys: sb_publishable_…")
    check("secret key filled in", secret.startswith("sb_secret_") or secret.startswith("eyJ"), "Project Settings → API Keys → Secret keys: sb_secret_…")
    check("access token filled in (for the setup)", len(v.get("SUPABASE_ACCESS_TOKEN", "")) > 20, "Account → Access Tokens → Generate new token")

    if url and anon:
        status, raw = http("GET", f"{url}/auth/v1/settings", {"apikey": anon})
        check("Supabase answers with the publishable key", status == 200, f"HTTP {status}")
        if status == 200:
            settings = json.loads(raw)
            check("e-mail confirmation is off", settings.get("mailer_autoconfirm") is True, "Authentication → Sign In / Providers → Email → Confirm email: off")
            check("sign-ups are allowed", settings.get("disable_signup") is False, "Authentication → Sign In / Providers: allow new users to sign up")
        status, _ = http("GET", f"{url}/rest/v1/documents?select=key&limit=1", {"apikey": anon})
        check("database schema is in place", status == 200, "run: python scripts/setup/apply_migrations.py")
    if url and secret:
        status, _ = http("GET", f"{url}/auth/v1/admin/users?page=1&per_page=1", {"apikey": secret})
        check("secret key is accepted", status == 200, f"HTTP {status}")

    lk_url, lk_key, lk_secret = v.get("LIVEKIT_URL", ""), v.get("LIVEKIT_API_KEY", ""), v.get("LIVEKIT_API_SECRET", "")
    check("LiveKit URL filled in", lk_url.startswith("wss://"), "LiveKit Cloud → Settings: wss://<project>.livekit.cloud")
    check("LiveKit key and secret filled in", bool(lk_key and lk_secret), "LiveKit Cloud → Settings → API Keys")
    if lk_url.startswith("wss://") and lk_key and lk_secret:
        status, raw = http(
            "POST",
            lk_url.replace("wss://", "https://") + "/twirp/livekit.RoomService/ListRooms",
            {"Authorization": f"Bearer {livekit_jwt(lk_key, lk_secret)}", "Content-Type": "application/json"},
            b"{}",
        )
        check("LiveKit accepts the key and secret", status == 200, f"HTTP {status}")

    failed = [r for r in results if not r[1]]
    for name, ok, hint in results:
        print(("OK   " if ok else "TODO ") + name + ("" if ok else f"  →  {hint}"))
    print(f"\n{len(results) - len(failed)}/{len(results)} ready")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
