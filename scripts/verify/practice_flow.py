"""Walks the Coach practice module: plan periods, link plays, copy a plan, attendance, print.

Usage: python scripts/verify/practice_flow.py BASE_URL OUT_DIR
"""
import argparse
import os
import sys
from datetime import date, timedelta

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
        shot = lambda name, p=page, full=True: p.screenshot(path=os.path.join(a.out, f"{name}.png"), full_page=full)
        base = a.base

        sign_up(page, base, "af")
        today = date.fromisoformat(page.evaluate("(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()"))

        # Roster and a play to link.
        page.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        page.get_by_role("button", name="Listeden ekle").first.click()
        page.get_by_label("Oyuncu listesi").fill("12 Kerem Aksoy QB\n7 Mehmet Kaya WR\n55 Burak Şen MLB\n23 Arda Tan CB\n88 Can Demir TE")
        page.get_by_role("button", name="5 oyuncuyu ekle").click()
        page.locator("table tbody tr").filter(has_text="Can Demir").get_by_role("button", name="Oyuncuyu düzenle: Can Demir").click()
        edit = page.get_by_role("dialog", name="Oyuncuyu düzenle")
        edit.get_by_role("button", name="Pasif").click()
        edit.get_by_role("button", name="Kaydet").click()
        page.goto(f"{base}/tr/panel/playbook", wait_until="networkidle")
        page.get_by_role("button", name="Yeni playbook").first.click()
        page.get_by_label("Playbook adı").fill("Hücum 2026")
        page.get_by_role("button", name="Oluştur", exact=True).click()
        page.wait_for_url("**/panel/playbook/pb*")
        page.get_by_role("button", name="Yeni hücum oyunu").click()
        page.get_by_label("Oyun adı").fill("Trips Right Mesh")
        page.get_by_role("button", name="Oyunu oluştur ve çiz").click()
        page.wait_for_url("**/panel/playbook/pb*/play*")
        page.wait_for_timeout(600)

        # A practice from the practice page.
        page.goto(f"{base}/tr/panel/practice", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("practice is open in the menu", page.get_by_role("navigation").get_by_role("link", name="Antrenman").count() >= 1)
        check("empty practice list invites adding", page.get_by_text("Takvimde antrenman yok.").count() == 1)
        page.get_by_role("button", name="Antrenman ekle").first.click()
        dlg = page.get_by_role("dialog", name="Antrenman ekle")
        check("the dialog adds practices only", dlg.get_by_role("button", name="Maç", exact=True).count() == 0)
        dlg.get_by_label("Başlangıç").fill("19:00")
        dlg.get_by_label("Bitiş").fill("20:30")
        dlg.get_by_label("Yer").fill("Ana saha")
        dlg.get_by_role("button", name="Etkinliği ekle").click()
        page.wait_for_url("**/panel/practice/ev*")
        page.wait_for_timeout(400)
        check("adding opens the new plan", page.get_by_role("heading", level=1, name="Antrenman").count() == 1)

        # Periods.
        page.get_by_label("Günün odağı").fill("Red zone pas oyunu")
        for preset in ("Isınma", "Bireysel", "Takım"):
            page.get_by_role("button", name=preset, exact=True).click()
        cards = page.locator("ol > li[aria-labelledby]")
        check("quick add makes three periods", cards.count() == 3, cards.count())
        check("periods run on the clock", page.locator("#practice-panel").get_by_text("19:20–19:30").count() == 1)
        check("plan leaves time open", page.get_by_text("60 dk boş kalıyor.").count() == 1)
        team = cards.nth(2)
        team.get_by_role("button", name="5 dk artır").click()
        team.get_by_role("button", name="5 dk artır").click()
        team.get_by_label("Süre (dk)").fill("60")
        check("typed length counts", page.locator("#practice-panel").get_by_text("Toplam 80 dk").count() == 1)
        team.get_by_label("Drill ve koçluk notları").fill("11'e 11, 20 yard içi.")
        team.get_by_role("button", name="Oyun bağla").click()
        picker = page.get_by_role("dialog", name="Oyun bağla")
        picker.get_by_role("button", name="Trips Right Mesh").click()
        check("picker counts the choice", picker.get_by_text("1 oyun seçili").count() == 1)
        picker.get_by_role("button", name="Bitti").click()
        check("linked play shows on the period", team.get_by_role("link", name="Trips Right Mesh").count() == 1)
        cards.nth(2).get_by_role("button", name="Yukarı taşı").click()
        check("moving up reorders", cards.nth(1).get_by_label("Periyot adı").input_value() == "Takım", cards.nth(1).get_by_label("Periyot adı").input_value())
        cards.nth(0).get_by_role("button", name="Periyodu kopyala").click()
        check("duplicate adds a period", cards.count() == 4, cards.count())
        cards.nth(1).get_by_role("button", name="Periyodu sil").click()
        check("delete removes it", cards.count() == 3, cards.count())
        page.get_by_label("Süre (dk)").nth(1).fill("90")
        check("over-time is flagged", page.get_by_text("Plan, antrenman süresini 20 dk aşıyor.").count() == 1)
        page.get_by_label("Süre (dk)").nth(1).fill("60")
        shot("01-plan")

        # Print sheet.
        page.emulate_media(media="print")
        shot("02-print", full=True)
        visible = page.evaluate("getComputedStyle(document.querySelector('.doc-print-root')).display")
        check("print shows the practice sheet", visible == "block", visible)
        app_hidden = page.evaluate("[...document.body.children].filter(e => !e.classList.contains('doc-print-root') && getComputedStyle(e).display !== 'none' && e.tagName !== 'SCRIPT').length")
        check("print hides the app", app_hidden == 0, app_hidden)
        page.emulate_media(media="screen")

        # Attendance.
        page.get_by_role("tab", name="Yoklama").click()
        page.wait_for_timeout(200)
        rows = page.locator("#practice-panel ul > li")
        check("attendance lists active players only", rows.count() == 4, rows.count())
        rows.filter(has_text="Mehmet Kaya").get_by_role("button", name="Geç").click()
        rows.filter(has_text="Burak Şen").get_by_role("button", name="Gelmedi").click()
        page.get_by_role("button", name="İşaretlenmeyenleri geldi say").click()
        check("attendance summary", page.get_by_text("2 geldi, 1 geç, 1 gelmedi, 0 izinli, 0 işaretlenmedi").count() == 1)
        rows.filter(has_text="Burak Şen").get_by_role("button", name="Gelmedi").click()
        check("a second tap unmarks", page.get_by_text("1 işaretlenmedi").count() == 1)
        rows.filter(has_text="Burak Şen").get_by_role("button", name="İzinli").click()
        check("tab shows the count", page.get_by_role("tab", name="Yoklama 3/4").count() == 1)
        shot("03-attendance")

        # The attendance reaches the player's profile, and the calendar links to the plan.
        page.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        page.get_by_role("link", name="Mehmet Kaya").first.click()
        page.wait_for_url("**/panel/roster/pl*")
        page.wait_for_timeout(300)
        check("late counts as attended on the profile", page.get_by_text("%100").count() == 1)
        shot("03b-profile")
        page.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("calendar links the practice to its plan", page.get_by_role("link", name="Plan: Antrenman").count() == 1)

        # A second practice copies the plan.
        page.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        page.get_by_role("button", name="Etkinlik ekle").click()
        dlg = page.get_by_role("dialog", name="Yeni etkinlik")
        dlg.get_by_label("Tarih").fill((today + timedelta(days=2)).isoformat())
        dlg.get_by_label("Başlangıç").fill("18:00")
        dlg.get_by_role("button", name="Etkinliği ekle").click()
        page.goto(f"{base}/tr/panel/practice", wait_until="networkidle")
        page.wait_for_timeout(300)
        shot("04a-list-before")
        listed = page.locator("section[aria-labelledby=practice-upcoming] li")
        check("practice list shows both", listed.count() == 2, listed.count())
        check("list shows the plan summary", page.get_by_text("3 periyot, 80 dk").count() == 1)
        check("list shows attendance", page.get_by_text("Yoklama: 3/4").count() == 1)
        shot("04-list")
        listed.nth(1).get_by_role("link").click()
        page.wait_for_url("**/panel/practice/ev*")
        page.wait_for_timeout(300)
        page.get_by_role("button", name="Başka antrenmandan kopyala").click()
        page.get_by_role("dialog", name="Periyotları kopyala").get_by_role("button").filter(has_text="3 periyot").click()
        check("copied periods start at the new time", page.locator("#practice-panel").get_by_text("18:00–18:10").count() == 1)

        # Deleting the practice from the calendar drops its plan.
        page.get_by_role("button", name="Tarih ve saati düzenle").click()
        page.get_by_role("dialog", name="Etkinliği düzenle").get_by_role("button", name="Etkinliği sil").click()
        page.get_by_role("dialog", name="Etkinliği sil").get_by_role("button", name="Sil").click()
        page.wait_for_timeout(300)
        check("deleted practice says so", page.get_by_text("Bu antrenman bulunamadı.").count() == 1)
        wait_synced(page)
        leftover = len(server_rows(page).get("practice") or {})
        check("its plan is gone from the server", leftover == 1, leftover)

        # Phone.
        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
        p2 = phone.new_page()
        p2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p2.goto(f"{base}/tr/panel/practice", wait_until="networkidle")
        p2.wait_for_timeout(300)
        p2.locator("section[aria-labelledby=practice-upcoming] li a").first.click()
        p2.wait_for_url("**/panel/practice/ev*")
        p2.wait_for_timeout(400)
        shot("05-phone-plan", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone plan: no horizontal overflow", overflow <= 0, overflow)
        p2.get_by_role("tab", name="Yoklama 3/4").click()
        p2.wait_for_timeout(200)
        shot("06-phone-attendance", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone attendance: no horizontal overflow", overflow <= 0, overflow)
        phone.close()

        check("no console errors", not errors, " | ".join(errors[:4]))
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
