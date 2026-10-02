"""Creates (or reuses) the Atlethera Supabase project in Frankfurt, configures it for the app, and
writes the project URL and keys into .env.local. Safe to run again: it reuses the project and only
fills in what is missing. Secrets are written to .env.local, never printed.

Needs SUPABASE_ACCESS_TOKEN (a scoped personal access token) in .env.local.

Usage: python scripts/setup/create_project.py
"""
import json
import os
import re
import secrets
import string
import sys
import time
import urllib.error
import urllib.request

# Windows consoles default to a legacy code page.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV_PATH = os.path.join(ROOT, ".env.local")
API = "https://api.supabase.com"
NAME = "Atlethera"
REGION = "eu-central-1"  # Frankfurt


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    if os.path.exists(ENV_PATH):
        for line in open(ENV_PATH, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip().strip('"').strip("'")
    return values


def set_env(key: str, value: str, comment: str | None = None) -> None:
    """Sets KEY=value in .env.local, replacing an existing line or appending one."""
    lines = open(ENV_PATH, encoding="utf-8").read().splitlines() if os.path.exists(ENV_PATH) else []
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=")
    for i, line in enumerate(lines):
        if pattern.match(line):
            lines[i] = f"{key}={value}"
            break
    else:
        if comment:
            lines += ["", f"# {comment}"]
        lines.append(f"{key}={value}")
    open(ENV_PATH, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")


def api(method: str, path: str, token: str, body=None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "atlethera-setup"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def fail(step: str, status, data) -> int:
    message = data.get("message") if isinstance(data, dict) else data
    print(f"FAILED {step}: HTTP {status} {message}")
    if status in (401, 403):
        print("       The token may lack a permission for this step (see the permissions table).")
    return 1


def main() -> int:
    env = read_env()
    token = env.get("SUPABASE_ACCESS_TOKEN", "")
    if not token:
        print("Put SUPABASE_ACCESS_TOKEN in .env.local first.")
        return 1

    status, orgs = api("GET", "/v1/organizations", token)
    if status != 200:
        return fail("list organizations", status, orgs)
    org = next((o for o in orgs if o.get("name", "").lower() == NAME.lower()), orgs[0] if len(orgs) == 1 else None)
    if not org:
        print("Organizations the token sees:", ", ".join(o.get("name", "?") for o in orgs))
        print(f"None is called {NAME}.")
        return 1
    slug = org.get("slug") or org.get("id")
    print(f"ok     organization: {org.get('name')}")

    status, projects = api("GET", f"/v1/organizations/{slug}/projects", token)
    if status != 200:
        status, projects = api("GET", "/v1/projects", token)
    listed = projects.get("projects", projects) if isinstance(projects, dict) else (projects or [])
    listed = listed if isinstance(listed, list) else []
    for p in listed:
        print(f"       project seen: {p.get('name')} ({p.get('region')}, {p.get('status')})")
    existing = next((p for p in listed if p.get("name") == NAME and p.get("region") == REGION), None)

    if existing:
        ref = existing.get("ref") or existing.get("id")
        print(f"ok     reusing project {NAME} in {REGION}")
    else:
        password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(28))
        # Kept before the project exists, so a failure midway never loses it.
        set_env("SUPABASE_DB_PASSWORD", password, "Veritabanı şifresi (Supabase projesi); başka yerde saklanmıyor")
        body = {"name": NAME, "organization_slug": slug, "db_pass": password, "region_selection": {"type": "specific", "code": REGION}}
        status, created = api("POST", "/v1/projects", token, body)
        if status not in (200, 201):
            return fail("create project", status, created)
        ref = created.get("ref") or created.get("id")
        print(f"ok     created project {NAME} in {REGION}")

    # Wait until the database is up.
    last = None
    for _ in range(80):
        status, project = api("GET", f"/v1/projects/{ref}", token)
        state = project.get("status") if isinstance(project, dict) else None
        if state != last:
            print(f"       status: {state}")
            last = state
        if state == "ACTIVE_HEALTHY":
            break
        if state in ("INIT_FAILED", "REMOVED"):
            return fail("start project", status, project)
        time.sleep(6)
    else:
        print("FAILED project did not become healthy in time; run this again in a minute.")
        return 1

    auth = {"mailer_autoconfirm": True, "disable_signup": False, "site_url": "http://localhost:3000", "uri_allow_list": "http://localhost:3000/**", "password_min_length": 8}
    status, data = api("PATCH", f"/v1/projects/{ref}/config/auth", token, auth)
    if status not in (200, 201):
        return fail("auth settings", status, data)
    print("ok     sign-up without e-mail confirmation, password length 8, localhost allowed")

    status, data = api("PATCH", f"/v1/projects/{ref}/config/realtime", token, {"private_only": True})
    if status in (200, 201, 204):
        print("ok     realtime: private channels only")
    else:
        print(f"skip   realtime private-only (HTTP {status}); the app works without it")

    status, keys = api("GET", f"/v1/projects/{ref}/api-keys?reveal=true", token)
    if status != 200:
        return fail("read API keys", status, keys)
    for kind in ("publishable", "secret"):
        if not any(k.get("type") == kind for k in keys):
            s, d = api("POST", f"/v1/projects/{ref}/api-keys", token, {"type": kind, "name": f"default_{kind}"})
            if s not in (200, 201):
                return fail(f"create {kind} key", s, d)
    status, keys = api("GET", f"/v1/projects/{ref}/api-keys?reveal=true", token)
    publishable = next((k["api_key"] for k in keys if k.get("type") == "publishable" and k.get("api_key")), None)
    secret = next((k["api_key"] for k in keys if k.get("type") == "secret" and k.get("api_key")), None)
    if not publishable or not secret:
        print("FAILED the keys came back without values (the token may need API Key Secrets: Read).")
        return 1

    set_env("NEXT_PUBLIC_SUPABASE_URL", f"https://{ref}.supabase.co")
    set_env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishable)
    set_env("SUPABASE_SECRET_KEY", secret)
    print("ok     project URL and keys written to .env.local")
    return 0


if __name__ == "__main__":
    sys.exit(main())
