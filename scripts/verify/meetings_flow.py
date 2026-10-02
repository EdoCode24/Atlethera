"""Walks the Coach meetings: audience by position group, agenda with plays, attendance, print.

Usage: python scripts/verify/meetings_flow.py BASE_URL OUT_DIR
"""
import argparse
import os
import sys

from playwright.sync_api import sync_playwright

from roster_flow import sign_up
from supa import server_rows, wait_synced


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    errors: list[str] = []
    checks: list[tuple[str, bool, str]] = []
    check = lambda name, ok, detail="": checks.append((name, bool(ok), str(detail)))
    try:
        run(a, errors, check)
    except Exception as e:  # Report what passed before the step that broke.
        check(f"flow ran to the end ({type(e).__name__})", False, str(e).splitlines()[0])
    failed = [c for c in checks if not c[1]]
    for name, ok, detail in checks:
        print("PASS" if ok else "FAIL", name, f"— {detail}" if detail and not ok else "")
    print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
    return 1 if failed else 0


def run(a, errors: list[str], check) -> None:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        shot = lambda name, p=page: p.screenshot(path=os.path.join(a.out, f"{name}.png"), full_page=True)
        base = a.base

        sign_up(page, base, "af")
        page.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        page.get_by_role("button", name="Listeden ekle").first.click()
        page.get_by_label("Oyuncu listesi").fill("12 Kerem Aksoy QB\n7 Mehmet Kaya WR\n55 Burak Şen MLB\n23 Arda Tan CB\n88 Can Demir TE")
        page.get_by_role("button", name="5 oyuncuyu ekle").click()
        page.goto(f"{base}/tr/panel/playbook", wait_until="networkidle")
        page.get_by_role("button", name="Yeni playbook").first.click()
        page.get_by_label("Playbook adı").fill("Savunma 2026")
        page.get_by_role("button", name="Oluştur", exact=True).click()
        page.wait_for_url("**/panel/playbook/pb*")
        page.get_by_role("group", name="Playbook").get_by_role("button", name="Savunma").click()
        page.get_by_role("button", name="Yeni savunma oyunu").click()
        page.get_by_label("Oyun adı").fill("Cover 3 Sky")
        page.get_by_role("button", name="Oyunu oluştur ve çiz").click()
        page.wait_for_url("**/panel/playbook/pb*/play*")
        page.wait_for_timeout(500)

        page.goto(f"{base}/tr/panel/meetings", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("meetings are open in the menu", page.get_by_role("navigation").get_by_role("link", name="Toplantılar").count() >= 1)
        check("empty list invites adding", page.get_by_text("Takvimde toplantı yok.").count() == 1)
        page.get_by_role("button", name="Toplantı ekle").first.click()
        dlg = page.get_by_role("dialog", name="Toplantı ekle")
        check("title follows the kind", dlg.get_by_label("Başlık").input_value() == "Toplantı", dlg.get_by_label("Başlık").input_value())
        dlg.get_by_label("Başlık").fill("Savunma toplantısı")
        dlg.get_by_label("Başlangıç").fill("18:00")
        dlg.get_by_role("button", name="Etkinliği ekle").click()
        page.wait_for_url("**/panel/meetings/ev*")
        page.wait_for_timeout(300)
        check("adding opens the meeting", page.get_by_role("heading", level=1, name="Savunma toplantısı").count() == 1)

        # Audience.
        check("whole team by default", page.get_by_role("button", name="Tüm takım").get_attribute("aria-pressed") == "true")
        check("everyone active is invited", page.get_by_text("5 oyuncu davetli").count() == 1)
        page.get_by_role("button", name="LB", exact=True).click()
        page.get_by_role("button", name="CB", exact=True).click()
        check("groups narrow the invite", page.get_by_text("2 oyuncu davetli").count() == 1)
        check("whole team is off", page.get_by_role("button", name="Tüm takım").get_attribute("aria-pressed") == "false")

        # Agenda.
        page.get_by_role("button", name="Madde ekle").click()
        page.get_by_role("button", name="Madde ekle").click()
        items = page.locator("#meeting-panel ol > li")
        check("two agenda items", items.count() == 2, items.count())
        items.nth(0).get_by_label("Başlık").fill("Blitz tanıma")
        items.nth(0).get_by_role("button", name="5 dk artır").click()
        check("items run on the clock", page.locator("#meeting-panel").get_by_text("18:15–18:25").count() == 1)
        items.nth(0).get_by_label("Notlar").fill("Geçen maçın 3. çeyreği.")
        items.nth(0).get_by_role("button", name="Oyun bağla").click()
        picker = page.get_by_role("dialog", name="Oyun bağla")
        picker.get_by_role("button", name="Cover 3 Sky").click()
        picker.get_by_role("button", name="Bitti").click()
        check("play linked to the item", items.nth(0).get_by_role("link", name="Cover 3 Sky").count() == 1)
        items.nth(1).get_by_role("button", name="Maddeyi sil").click()
        check("item deleted", items.count() == 1, items.count())
        page.get_by_label("Kararlar ve notlar").fill("Nickel paketinde 23 numara slot'a geçiyor.")
        shot("01-agenda")

        # Print.
        page.emulate_media(media="print")
        shot("02-print")
        check("print shows the agenda sheet", page.evaluate("getComputedStyle(document.querySelector('.doc-print-root')).display") == "block")
        check("print names the audience", page.locator(".doc-print-root").get_by_text("Linebacker, Cornerback").count() == 1)
        page.emulate_media(media="screen")

        # Attendance of the invited only.
        page.get_by_role("tab", name="Yoklama").click()
        rows = page.locator("#meeting-panel ul > li")
        check("attendance lists the invited", rows.count() == 2, rows.count())
        page.get_by_role("button", name="İşaretlenmeyenleri geldi say").click()
        check("tab counts attendance", page.get_by_role("tab", name="Yoklama 2/2").count() == 1)
        shot("03-attendance")

        # List and calendar.
        page.goto(f"{base}/tr/panel/meetings", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("list shows the audience", page.get_by_text("LB, CB").count() == 1)
        check("list shows the agenda", page.get_by_text("1 madde, 15 dk").count() == 1)
        shot("04-list")
        page.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        page.wait_for_timeout(300)
        link = page.get_by_role("link", name="Gündem: Savunma toplantısı")
        check("calendar links to the agenda", link.count() == 1)
        link.click()
        page.wait_for_url("**/panel/meetings/ev*")
        page.get_by_role("button", name="Tarih ve saati düzenle").click()
        page.get_by_role("dialog", name="Etkinliği düzenle").get_by_role("button", name="Etkinliği sil").click()
        page.get_by_role("dialog", name="Etkinliği sil").get_by_role("button", name="Sil").click()
        page.wait_for_timeout(300)
        check("deleted meeting says so", page.get_by_text("Bu toplantı bulunamadı.").count() == 1)
        wait_synced(page)
        leftover = len(server_rows(page).get("meetings") or {})
        check("its agenda is gone from the server", leftover == 0, leftover)

        # English and phone.
        page.goto(f"{base}/en/panel/meetings", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("English empty state", page.get_by_text("No meetings on the calendar.").count() == 1)
        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
        p2 = phone.new_page()
        p2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p2.goto(f"{base}/tr/panel/meetings", wait_until="networkidle")
        p2.get_by_role("button", name="Toplantı ekle").first.click()
        p2.get_by_role("dialog", name="Toplantı ekle").get_by_role("button", name="Etkinliği ekle").click()
        p2.wait_for_url("**/panel/meetings/ev*")
        p2.wait_for_timeout(300)
        p2.get_by_role("button", name="Madde ekle").click()
        shot("05-phone", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone: no horizontal overflow", overflow <= 0, overflow)
        phone.close()

        check("no console errors", not errors, " | ".join(errors[:4]))
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
