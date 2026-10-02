"""Checks the database rules directly (no browser): what a player can read and write, invites.

Usage: python scripts/verify/rls_probe.py   (needs .env.local; creates and removes test accounts)
"""
import json
import sys

from supa import SECRET, call, configured, delete_test_users, sign_up, unique_email

checks: list[tuple[str, bool, str]] = []


def check(name: str, ok, detail="") -> None:
    checks.append((name, bool(ok), str(detail)))


def rpc(fn: str, args: dict, token: str | None):
    return call("POST", f"/rest/v1/rpc/{fn}", args, token=token)


def main() -> int:
    if not configured():
        print("Supabase is not configured (.env.local).")
        return 1
    delete_test_users()
    try:
        run()
    except AssertionError as e:
        check("probe ran to the end", False, e)
    finally:
        if SECRET:
            delete_test_users()
    failed = [c for c in checks if not c[1]]
    for name, ok, detail in checks:
        print("PASS" if ok else "FAIL", name, f"— {detail}" if detail and not ok else "")
    print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
    return 1 if failed else 0


def run() -> None:
    pw = "sifre1234"
    coach = sign_up(unique_email("rls-coach"), pw, "Koç Test")
    status, ws = rpc("create_workspace", {"p_package": "coach", "p_sport": "american-football", "p_name": "RLS Takımı"}, coach)
    assert status == 200, (status, ws)
    wid = ws["id"]
    check("coach creates a team", bool(wid))

    now = "2026-09-24T10:00:00.000Z"
    base = {"heightCm": 180, "weightKg": 80, "birthDate": "2004-01-01", "createdAt": now, "updatedAt": now}
    roster = {
        "players": [
            {**base, "id": "pl1", "firstName": "Ali", "lastName": "Can", "number": 7, "positions": ["WR"], "status": "injured", "injury": {"note": "GIZLI-SAKATLIK", "returnDate": None}, "phone": "+90 555 000 11 22", "email": "gizli1@x.test", "notes": "GIZLI-NOT-1"},
            {**base, "id": "pl2", "firstName": "Veli", "lastName": "Kaya", "number": 9, "positions": ["QB"], "status": "active", "injury": None, "phone": "+90 555 000 33 44", "email": "gizli2@x.test", "notes": "GIZLI-NOT-2"},
        ],
        "depth": {"WR": ["pl1"], "QB": ["pl2"]},
    }
    evaluation = {
        "criteria": [{"id": "c1", "name": "Teknik"}],
        "evaluations": [
            {"id": "e1", "playerId": "pl1", "date": "2026-09-01", "ratings": {"c1": 4}, "strengths": "Hız", "improve": "Blok", "notes": "GIZLI-EVAL-NOT", "createdAt": now, "updatedAt": now},
            {"id": "e2", "playerId": "pl2", "date": "2026-09-01", "ratings": {"c1": 2}, "strengths": "BASKASININ-DEGERLENDIRMESI", "improve": "", "notes": "", "createdAt": now, "updatedAt": now},
        ],
        "tests": [{"id": "t1", "date": "2026-09-01", "title": "", "results": {"pl1": {"forty": 4.8}, "pl2": {"forty": 4.6}}, "createdAt": now}],
    }
    calendar = [{"id": "ev1", "kind": "meeting", "title": "Toplantı", "date": "2026-09-24", "start": "18:00", "end": None, "location": "", "notes": "", "opponent": "", "venue": None, "seriesId": None, "createdAt": now, "updatedAt": now}]
    for key, value in (("roster", roster), ("evaluation", evaluation), ("calendar", calendar)):
        status, data = call("POST", "/rest/v1/documents", {"workspace_id": wid, "key": key, "value": value}, token=coach, headers={"Prefer": "return=representation"})
        check(f"coach writes {key}", status == 201, (status, data))

    status, derived = call("POST", "/rest/v1/documents", {"workspace_id": wid, "key": "roster.public", "value": {}}, token=coach)
    check("nobody writes the derived rows", status in (401, 403), status)

    # Invite, preview and accept.
    status, token = rpc("create_invite", {"p_ws": wid, "p_player": "pl1"}, coach)
    check("coach creates an invite", status == 200 and isinstance(token, str), (status, token))
    status, info = rpc("invite_info", {"p_token": token}, None)
    check("invite preview works signed out", status == 200 and info and info[0]["first_name"] == "Ali" and info[0]["last_initial"] == "C" and info[0]["jersey"] == 7 and info[0]["status"] == "open", info)
    check("invite preview shows no contact data", "GIZLI" not in json.dumps(info) and "555" not in json.dumps(info), info)
    status, missing = rpc("invite_info", {"p_token": "nope"}, None)
    check("unknown token shows nothing", status == 200 and missing == [], missing)

    player = sign_up(unique_email("rls-player"), pw, "Ali Can")
    status, joined = rpc("accept_invite", {"p_token": token}, player)
    check("player accepts", status == 200 and joined == wid, (status, joined))
    status, again = rpc("accept_invite", {"p_token": token}, player)
    check("accepting twice is harmless", status == 200 and again == wid, (status, again))
    status, info = rpc("invite_info", {"p_token": token}, player)
    check("the used invite reads as mine", info and info[0]["status"] == "mine", info)

    # What the player reads.
    status, rows = call("GET", f"/rest/v1/documents?workspace_id=eq.{wid}&select=key,value", token=player)
    keys = sorted(r["key"] for r in rows) if status == 200 else []
    check("player reads the team's documents", {"calendar", "roster.public", "me:pl1"} <= set(keys), keys)
    check("player never reads the coach's roster or evaluation", not ({"roster", "evaluation", "me:pl2"} & set(keys)), keys)
    body = json.dumps(rows, ensure_ascii=False)
    for marker in ("GIZLI-NOT-1", "GIZLI-NOT-2", "gizli2@x.test", "+90 555 000 33 44", "GIZLI-EVAL-NOT", "BASKASININ-DEGERLENDIRMESI"):
        check(f"player never receives {marker}", marker not in body)
    me = next((r["value"] for r in rows if r["key"] == "me:pl1"), {})
    check("player sees their own contact and injury", me.get("player", {}).get("phone") == "+90 555 000 11 22" and me.get("player", {}).get("injury", {}).get("note") == "GIZLI-SAKATLIK", me.get("player"))
    check("player sees only their own evaluation", [e["playerId"] for e in me.get("evaluation", {}).get("evaluations", [])] == ["pl1"], me.get("evaluation"))
    check("player sees only their own test results", all(list(t["results"].keys()) == ["pl1"] for t in me.get("evaluation", {}).get("tests", [])), me.get("evaluation"))
    public = next((r["value"] for r in rows if r["key"] == "roster.public"), {})
    check("teammates' injury status stays, the details go", [p["status"] for p in public.get("players", [])] == ["injured", "active"] and all(p["injury"] is None for p in public.get("players", [])), public)

    # What the player can't do.
    status, data = call("PATCH", f"/rest/v1/documents?workspace_id=eq.{wid}&key=eq.calendar", {"value": []}, token=player, headers={"Prefer": "return=representation"})
    check("player can't change a document", status in (200, 204) and not data, (status, data))
    status, _ = call("POST", "/rest/v1/documents", {"workspace_id": wid, "key": "videos", "value": []}, token=player)
    check("player can't add a document", status in (401, 403), status)
    status, data = call("DELETE", f"/rest/v1/documents?workspace_id=eq.{wid}&key=eq.calendar", token=player, headers={"Prefer": "return=representation"})
    check("player can't delete a document", not data, (status, data))
    status, data = call("GET", f"/rest/v1/documents?workspace_id=eq.{wid}&key=eq.calendar&select=value", token=coach)
    check("the calendar is untouched", status == 200 and data and len(data[0]["value"]) == 1, data)
    status, _ = rpc("create_invite", {"p_ws": wid, "p_player": "pl2"}, player)
    check("player can't create invites", status >= 400, status)
    status, _ = rpc("start_live_meeting", {"p_ws": wid, "p_event": "ev1"}, player)
    check("player can't start a live meeting", status >= 400, status)

    # Live meeting rows.
    status, live = rpc("start_live_meeting", {"p_ws": wid, "p_event": "ev1"}, coach)
    check("coach starts a live meeting", status == 200 and live.get("room", "").startswith("atl_"), (status, live))
    status, again = rpc("start_live_meeting", {"p_ws": wid, "p_event": "ev1"}, coach)
    check("starting again rejoins the same session", status == 200 and again.get("id") == live.get("id"), again)
    status, seen = call("GET", f"/rest/v1/live_meetings?workspace_id=eq.{wid}&ended_at=is.null&select=id", token=player)
    check("player sees the live session", status == 200 and len(seen) == 1, seen)
    status, _ = rpc("record_meeting_join", {"p_id": live["id"]}, player)
    status, joins = call("GET", f"/rest/v1/meeting_joins?live_meeting_id=eq.{live['id']}&select=player_id", token=coach)
    check("coach sees who joined", status == 200 and joins == [{"player_id": "pl1"}], joins)
    status, _ = rpc("start_live_meeting", {"p_ws": wid, "p_event": "nope"}, coach)
    check("only meetings go live", status >= 400, status)
    status, ended = rpc("end_live_meeting", {"p_id": live["id"]}, coach)
    check("coach ends it", status == 200 and ended.get("ended_at"), ended)

    # Revoked and used links.
    status, token2 = rpc("create_invite", {"p_ws": wid, "p_player": "pl2"}, coach)
    rpc("revoke_invite", {"p_token": token2}, coach)
    status, info = rpc("invite_info", {"p_token": token2}, None)
    check("a revoked link says so", info and info[0]["status"] == "revoked", info)
    other = sign_up(unique_email("rls-other"), pw, "Başka")
    status, err = rpc("accept_invite", {"p_token": token2}, other)
    check("a revoked link can't be used", status >= 400 and "invite_invalid" in json.dumps(err), err)
    status, err = rpc("accept_invite", {"p_token": token}, other)
    check("a used link can't be used again", status >= 400 and "invite_used" in json.dumps(err), err)
    status, err = rpc("create_invite", {"p_ws": wid, "p_player": "pl1"}, coach)
    check("a linked player gets no new link", status >= 400 and "player_linked" in json.dumps(err), err)

    # Removing access.
    status, members = call("GET", f"/rest/v1/memberships?workspace_id=eq.{wid}&role=eq.player&select=user_id", token=coach)
    uid = members[0]["user_id"] if members else ""
    call("DELETE", f"/rest/v1/memberships?workspace_id=eq.{wid}&user_id=eq.{uid}", token=coach)
    status, rows = call("GET", f"/rest/v1/documents?workspace_id=eq.{wid}&select=key", token=player)
    check("a removed player reads nothing", status == 200 and rows == [], rows)


if __name__ == "__main__":
    sys.exit(main())
