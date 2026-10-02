"""Supabase helpers for the verification scripts: settings from .env.local, raw REST calls, what
the server holds for a signed-in page, and cleanup of the test accounts (every test e-mail ends
in @atlethera.test)."""
import base64
import json
import os
import re
import secrets
import time
import urllib.error
import urllib.request

TEST_DOMAIN = "@atlethera.test"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    env.update({k: v for k, v in os.environ.items() if k.startswith(("NEXT_PUBLIC_SUPABASE", "SUPABASE_", "LIVEKIT_"))})
    return env


ENV = load_env()
URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
ANON = ENV.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
SECRET = ENV.get("SUPABASE_SECRET_KEY", "")


def configured() -> bool:
    return bool(URL and ANON)


def unique_email(tag: str) -> str:
    # The random part keeps two scripts started together from signing up with the same address.
    return f"e2e-{tag}-{int(time.time() * 1000)}-{secrets.token_hex(3)}{TEST_DOMAIN}"


def call(method: str, path: str, body=None, token: str | None = None, key: str | None = None, headers: dict | None = None):
    """(status, parsed JSON or text). Auth headers: the API key, and the user's JWT when given."""
    data = json.dumps(body).encode() if body is not None else None
    h = {"apikey": key or ANON, "Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    h.update(headers or {})
    req = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def sign_up(email: str, password: str, name: str) -> str:
    status, data = call("POST", "/auth/v1/signup", {"email": email, "password": password, "data": {"name": name}})
    assert status == 200 and data and data.get("access_token"), (status, data)
    return data["access_token"]


def sign_in(email: str, password: str) -> str:
    status, data = call("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": password})
    assert status == 200, (status, data)
    return data["access_token"]


def page_token(page) -> str:
    """The access token of the account signed in on a Playwright page (Supabase's auth cookie,
    which may be split into numbered chunks)."""
    cookies = {c["name"]: c["value"] for c in page.context.cookies()}
    # "sb-<ref>-auth-token" or its chunks ".0", ".1"; not "sb-<ref>-auth-token-code-verifier".
    base = next((n.split(".")[0] for n in cookies if re.fullmatch(r"sb-[a-z0-9]+-auth-token(\.\d+)?", n)), None)
    assert base, "no Supabase session on this page"
    raw = cookies.get(base) or "".join(cookies[f"{base}.{i}"] for i in range(20) if f"{base}.{i}" in cookies)
    if raw.startswith("base64-"):
        raw = raw[len("base64-"):]
        raw = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode()
    return json.loads(raw)["access_token"]


def wait_synced(page, timeout: float = 15000) -> None:
    """Waits until the page has sent every change: its outbox in localStorage is gone."""
    page.wait_for_timeout(400)  # The play editor saves 300 ms after the last change.
    page.wait_for_function("() => !Object.keys(localStorage).some((k) => k.startsWith('atlethera.v2.outbox.'))", timeout=timeout)


def server_rows(page) -> dict:
    """Every team row the page's account reads on the server, by key."""
    status, rows = call("GET", "/rest/v1/documents?select=key,value", token=page_token(page))
    assert status == 200, (status, rows)
    return {r["key"]: r["value"] for r in rows}


def server_playbooks(page) -> list:
    """The playbooks as the server has them, put together from their rows like the app does."""
    rows = server_rows(page)
    books = []
    for book_id in (rows.get("playbooks.order") or {}).get("ids", []):
        meta = rows.get(f"pb:{book_id}")
        if not meta:
            continue
        book = {k: v for k, v in meta.items() if k != "playIds"}
        book["plays"] = [rows[f"play:{pid}"] for pid in meta.get("playIds", []) if f"play:{pid}" in rows]
        books.append(book)
    return books


def delete_test_users() -> int:
    """Deletes every account whose e-mail ends in @atlethera.test (their teams and data cascade)."""
    if not SECRET:
        return 0
    removed = 0
    page = 1
    while True:
        status, data = call("GET", f"/auth/v1/admin/users?page={page}&per_page=200", key=SECRET)
        if status != 200 or not data:
            break
        users = data.get("users", []) if isinstance(data, dict) else []
        for user in users:
            if (user.get("email") or "").endswith(TEST_DOMAIN):
                s, _ = call("DELETE", f"/auth/v1/admin/users/{user['id']}", key=SECRET)
                removed += s in (200, 204)
        if len(users) < 200:
            break
        page += 1
    return removed
