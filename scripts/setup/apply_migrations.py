"""Applies supabase/migrations/*.sql to the project in .env.local, in order, each once.

Uses the Supabase Management API with SUPABASE_ACCESS_TOKEN (a personal access token). Every
file runs as one transaction together with its entry in private.applied_migrations, so a
failing file leaves nothing half-applied and a rerun skips what is done.

Usage: python scripts/setup/apply_migrations.py [--dry-run]
"""
import glob
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

# Windows consoles default to a legacy code page.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


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


def query(ref: str, token: str, sql: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": sql}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "atlethera-setup"},
    )
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return res.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def realtime_ready(ref: str, token: str) -> bool:
    status, data = query(ref, token, "select to_regclass('realtime.messages') is not null as ready;")
    return status < 300 and bool(data) and bool(data[0].get("ready"))


def wait_for_realtime(ref: str, token: str) -> bool:
    """A new project's Realtime creates realtime.messages on its first client connection."""
    if realtime_ready(ref, token):
        return True
    print("wait   Realtime has not created its tables yet; connecting once to start it")
    for attempt in range(3):
        subprocess.run(["node", os.path.join(ROOT, "scripts", "setup", "wake_realtime.mjs")], cwd=ROOT, capture_output=True)
        for _ in range(6):
            if realtime_ready(ref, token):
                return True
            time.sleep(5)
    return False


def main() -> int:
    values = env()
    url = values.get("NEXT_PUBLIC_SUPABASE_URL", "")
    token = values.get("SUPABASE_ACCESS_TOKEN", "")
    match = re.match(r"https://([a-z0-9]+)\.supabase\.co", url)
    if not match or not token:
        print("Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN in .env.local first.")
        return 1
    ref = match.group(1)

    status, data = query(ref, token, "create schema if not exists private; create table if not exists private.applied_migrations (name text primary key, applied_at timestamptz not null default now()); select name from private.applied_migrations;")
    if status >= 300:
        print(f"Could not reach the project ({status}): {data}")
        return 1
    done = {row["name"] for row in (data or [])}

    files = sorted(glob.glob(os.path.join(ROOT, "supabase", "migrations", "*.sql")))
    for path in files:
        name = os.path.basename(path)
        if name in done:
            print(f"skip   {name}")
            continue
        if "--dry-run" in sys.argv:
            print(f"would  {name}")
            continue
        sql = open(path, encoding="utf-8").read()
        if "realtime.messages" in sql and not wait_for_realtime(ref, token):
            print(f"FAILED {name}: Realtime did not create realtime.messages; check the project's Realtime status and run this again.")
            return 1
        body = f"begin;\n{sql}\ninsert into private.applied_migrations (name) values ('{name}');\ncommit;"
        status, data = query(ref, token, body)
        if status >= 300:
            print(f"FAILED {name} ({status}): {data}")
            return 1
        print(f"done   {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
