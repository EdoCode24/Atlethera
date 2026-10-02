"""Walks the Coach calendar: add a weekly practice and a game, edit, delete part of a series.

Usage: python scripts/verify/calendar_flow.py BASE_URL OUT_DIR
"""
import argparse
import os
import sys
from datetime import date, timedelta

from playwright.sync_api import sync_playwright

from roster_flow import sign_up


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    errors: list[str] = []
    checks: list[tuple[str, bool, str]] = []
    check = lambda name, ok, detail="": checks.append((name, bool(ok), str(detail)))

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        shot = lambda name, p=page: p.screenshot(path=os.path.join(a.out, f"{name}.png"), full_page=True)

        sign_up(page, a.base, "af")
        page.get_by_role("navigation").get_by_role("link", name="Takvim").first.click()
        page.wait_for_url("**/tr/panel/calendar")
        page.wait_for_timeout(400)
        today = date.fromisoformat(page.evaluate("(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()"))
        shot("01-empty")
        check("empty calendar invites adding", page.get_by_text("Takvim boş.").count() == 1)
        check("today is selected", page.locator("#day-title").count() == 1)

        # A weekly practice from today, four weeks.
        page.get_by_role("button", name="Etkinlik ekle").click()
        dlg = page.get_by_role("dialog", name="Yeni etkinlik")
        check("title follows the kind", dlg.get_by_label("Başlık").input_value() == "Antrenman", dlg.get_by_label("Başlık").input_value())
        dlg.get_by_label("Başlangıç").fill("19:00")
        dlg.get_by_label("Bitiş").fill("18:00")
        dlg.get_by_role("button", name="Etkinliği ekle").click()
        check("end before start is explained", dlg.get_by_text("Bitiş, başlangıçtan sonra olmalı.").count() == 1)
        dlg.get_by_label("Bitiş").fill("21:00")
        dlg.get_by_label("Her hafta tekrarla").check()
        dlg.get_by_label("Son tarih").fill((today + timedelta(days=21)).isoformat())
        check("series count is shown", dlg.get_by_text("4 etkinlik oluşur.").count() == 1)
        dlg.get_by_label("Yer").fill("Ana saha")
        shot("02-form")
        dlg.get_by_role("button", name="Etkinliği ekle").click()
        page.wait_for_timeout(300)
        panel = page.locator("section[aria-labelledby=day-title]")
        check("today's panel lists the practice", panel.get_by_text("19:00–21:00").count() == 1)
        check("practice row names place and series", panel.get_by_text("Ana saha, Haftalık").count() == 1)

        # A game two days out.
        game_day = today + timedelta(days=2)
        page.get_by_role("button", name="Etkinlik ekle").click()
        dlg = page.get_by_role("dialog", name="Yeni etkinlik")
        dlg.get_by_role("button", name="Maç", exact=True).click()
        dlg.get_by_label("Rakip").fill("Ankara Wolves")
        check("game title comes from the opponent", dlg.get_by_label("Başlık").input_value() == "Ankara Wolves maçı", dlg.get_by_label("Başlık").input_value())
        dlg.get_by_role("button", name="Deplasman").click()
        dlg.get_by_label("Tarih").fill(game_day.isoformat())
        dlg.get_by_label("Başlangıç").fill("15:00")
        dlg.get_by_role("button", name="Etkinliği ekle").click()
        page.wait_for_timeout(300)
        shot("03-month")

        # Agenda.
        page.get_by_role("tab", name="Yaklaşanlar").click()
        page.wait_for_timeout(200)
        shot("04-agenda")
        rows = page.locator("#calendar-panel li li button").count()
        check("agenda lists five events", rows == 5, rows)
        check("game row shows away", page.get_by_text("Maç, Deplasman").count() == 1)

        # Delete the second and later practices of the series.
        second = today + timedelta(days=7)
        page.locator("#calendar-panel > ol > li").nth(2).get_by_role("button").first.click()
        edit = page.get_by_role("dialog", name="Etkinliği düzenle")
        check("edit opens the second practice", edit.get_by_label("Tarih").input_value() == second.isoformat(), edit.get_by_label("Tarih").input_value())
        edit.get_by_role("button", name="Etkinliği sil").click()
        confirm = page.get_by_role("dialog", name="Etkinliği sil")
        check("series delete offers both choices", confirm.get_by_role("button", name="Bunu ve sonrakileri sil").count() == 1)
        confirm.get_by_role("button", name="Bunu ve sonrakileri sil").click()
        page.wait_for_timeout(300)
        rows = page.locator("#calendar-panel li li button").count()
        check("two events remain", rows == 2, rows)

        # Edit keeps the series and changes the time.
        page.locator("#calendar-panel li li button").first.click()
        edit = page.get_by_role("dialog", name="Etkinliği düzenle")
        edit.get_by_label("Başlangıç").fill("18:30")
        edit.get_by_role("button", name="Kaydet").click()
        page.wait_for_timeout(200)
        check("edited time shows", page.get_by_text("18:30–21:00").count() == 1)

        # Month navigation keeps working back and forth.
        page.get_by_role("tab", name="Ay").click()
        page.get_by_role("button", name="Sonraki ay").click()
        page.get_by_role("button", name="Önceki ay").click()
        page.get_by_role("button", name="Önceki ay").click()
        page.get_by_role("button", name="Bugün").click()
        page.wait_for_timeout(200)
        check("today button returns to today", page.locator("#day-title").inner_text().lower() != "" and page.get_by_text("18:30–21:00").count() >= 1)

        # English: weeks start on Sunday.
        page.goto(f"{a.base}/en/panel/calendar", wait_until="networkidle")
        page.wait_for_timeout(400)
        first_day = page.locator("#calendar-panel div[aria-hidden=true] span").first.inner_text()
        check("English week starts on Sunday", first_day.startswith("Sun"), first_day)
        shot("05-en")

        # Phone.
        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
        p2 = phone.new_page()
        p2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p2.goto(f"{a.base}/tr/panel/calendar", wait_until="networkidle")
        p2.wait_for_timeout(500)
        shot("06-phone", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone: no horizontal overflow", overflow <= 0, overflow)
        p2.locator('button[aria-pressed=false][aria-label*="1 etkinlik"]').first.click()
        p2.wait_for_timeout(200)
        check("phone: picking a day shows its events", p2.locator("section[aria-labelledby=day-title] li").count() == 1)
        shot("07-phone-day", p2)
        phone.close()

        check("no console errors", not errors, " | ".join(errors[:4]))
        browser.close()

    failed = [c for c in checks if not c[1]]
    for name, ok, detail in checks:
        print("PASS" if ok else "FAIL", name, f"— {detail}" if detail and not ok else "")
    print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
