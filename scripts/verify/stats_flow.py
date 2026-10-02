"""Walks the Coach stats: games with scores, player stats by group, season leaders, profile.

Usage: python scripts/verify/stats_flow.py BASE_URL OUT_DIR
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
        today = date.fromisoformat(page.evaluate("(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()"))
        page.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        page.get_by_role("button", name="Listeden ekle").first.click()
        page.get_by_label("Oyuncu listesi").fill("12 Kerem Aksoy QB\n7 Mehmet Kaya WR\n23 Arda Tan CB\n55 Burak Şen MLB\n3 Emre Koç K")
        page.get_by_role("button", name="5 oyuncuyu ekle").click()

        page.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("stats are open in the menu", page.get_by_role("navigation").get_by_role("link", name="İstatistik").count() >= 1)
        check("no record yet", page.get_by_text("Skoru girilmiş maç yok.").count() == 1)

        def add_game(opponent: str, day: date) -> None:
            page.get_by_role("button", name="Maç ekle").first.click()
            dlg = page.get_by_role("dialog", name="Maç ekle")
            dlg.get_by_label("Rakip").fill(opponent)
            dlg.get_by_label("Tarih").fill(day.isoformat())
            dlg.get_by_role("button", name="Etkinliği ekle").click()
            page.wait_for_url("**/panel/stats/ev*")
            page.wait_for_timeout(300)

        add_game("Ankara Wolves", today - timedelta(days=7))
        check("adding opens the game", page.get_by_role("heading", level=1, name="Ankara Wolves maçı").count() == 1)
        page.get_by_label("İstanbul Thunders skoru").fill("21")
        page.get_by_label("Ankara Wolves skoru").fill("14")
        check("the score reads as a win", page.get_by_text("Galibiyet").count() == 1)

        # Passing: counts in, rates out.
        for stat, value in (("Tamamlanan pas", "20"), ("Pas denemesi", "30"), ("Pas yardı", "250"), ("Touchdown pası", "2"), ("Interception", "1")):
            page.get_by_label(f"Kerem Aksoy, {stat}").fill(value)
        panel = page.locator("#sheet-panel")
        check("completion % is worked out", panel.locator("tbody").get_by_text("66,7").count() == 1)
        check("passer rating is worked out", panel.locator("tbody").get_by_text("100,7").count() == 1)
        shot("01-passing")

        # Rushing takes negative yards.
        page.get_by_role("tab", name="Koşu").click()
        page.get_by_label("Kerem Aksoy, Taşıma").fill("3")
        cell = page.get_by_label("Kerem Aksoy, Koşu yardı")
        cell.fill("-")
        check("a lone minus waits", cell.get_attribute("aria-invalid") == "true")
        cell.fill("-4")
        check("negative yards are kept", cell.get_attribute("aria-invalid") is None)
        check("total adds up", panel.locator("tfoot").get_by_text("-4").count() >= 1, panel.locator("tfoot").inner_text())

        # Receiving: the group's players, and one added by hand.
        page.get_by_role("tab", name="Pas alma").click()
        page.get_by_label("Mehmet Kaya, Yakalama", exact=True).fill("5")
        page.get_by_label("Mehmet Kaya, Yard", exact=True).fill("60")
        check("yards per catch", panel.locator("tbody").get_by_text("12,0").count() == 1)
        page.locator("select").last.select_option(label="23  Arda Tan")
        check("a player can be added to the table", page.get_by_label("Arda Tan, Yakalama", exact=True).count() == 1)
        page.get_by_label("Arda Tan, Yakalama", exact=True).fill("1")
        page.get_by_label("Arda Tan, Yard", exact=True).fill("8")
        shot("02-receiving")

        # A second game, lost.
        page.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        add_game("İzmir Lions", today - timedelta(days=1))
        page.get_by_label("İstanbul Thunders skoru").fill("10")
        page.get_by_label("İzmir Lions skoru").fill("17")
        page.get_by_role("tab", name="Pas alma").click()
        page.get_by_label("Mehmet Kaya, Yakalama", exact=True).fill("3")
        page.get_by_label("Mehmet Kaya, Yard", exact=True).fill("30")

        # Season.
        page.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("record", page.get_by_text("1 galibiyet, 1 mağlubiyet, 0 beraberlik").count() == 1)
        check("points", page.get_by_text("Atılan 31 sayı, yenilen 31 sayı").count() == 1)
        check("games list shows the score", page.get_by_text("21–14").count() == 1)
        leaders = page.locator("#leaders-panel tbody tr")
        check("passing leaders list the QB", leaders.count() == 1 and "250" in leaders.first.inner_text(), leaders.first.inner_text() if leaders.count() else "")
        page.get_by_role("tab", name="Pas alma").click()
        page.wait_for_timeout(150)
        first = leaders.first.inner_text()
        check("receiving leads with yards", "Mehmet Kaya" in first and "90" in first, first)
        check("season yards per catch", "11,3" in first, first)
        page.locator("#leaders-panel thead button").filter(has_text="YDS").click()
        check("sorting flips the order", "Arda Tan" in leaders.first.inner_text(), leaders.first.inner_text())
        shot("03-season")

        # Profile and calendar.
        page.get_by_role("link", name="Mehmet Kaya").first.click()
        page.wait_for_url("**/panel/roster/pl*")
        page.wait_for_timeout(300)
        check("profile shows season stats", page.get_by_text("2 maç").count() >= 1)
        shot("04-profile")
        page.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        page.get_by_role("tab", name="Yaklaşanlar").click()
        page.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        page.get_by_role("link", name="İzmir Lions maçı").click()
        page.wait_for_url("**/panel/stats/ev*")
        page.get_by_role("button", name="Tarih ve saati düzenle").click()
        page.get_by_role("dialog", name="Etkinliği düzenle").get_by_role("button", name="Etkinliği sil").click()
        page.get_by_role("dialog", name="Etkinliği sil").get_by_role("button", name="Sil").click()
        page.wait_for_timeout(300)
        check("deleted game says so", page.get_by_text("Bu maç bulunamadı.").count() == 1)
        page.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("record drops the deleted game", page.get_by_text("1 galibiyet, 0 mağlubiyet, 0 beraberlik").count() == 1)

        # English and phone.
        page.goto(f"{base}/en/panel/stats", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("English record", page.get_by_text("1 wins, 0 losses, 0 ties").count() == 1)
        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
        p2 = phone.new_page()
        p2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p2.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        p2.wait_for_timeout(300)
        shot("05-phone", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone season: no page overflow", overflow <= 0, overflow)
        p2.get_by_role("link", name="Ankara Wolves maçı").click()
        p2.wait_for_url("**/panel/stats/ev*")
        p2.wait_for_timeout(300)
        shot("06-phone-game", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone game: no page overflow", overflow <= 0, overflow)
        phone.close()

        check("no console errors", not errors, " | ".join(errors[:4]))
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
