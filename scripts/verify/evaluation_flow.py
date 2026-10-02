"""Walks the Coach evaluation: criteria, ratings over time, test days, bests, profile.

Usage: python scripts/verify/evaluation_flow.py BASE_URL OUT_DIR
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

        sign_up(page, base, "flag")
        today = date.fromisoformat(page.evaluate("(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()"))
        page.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        page.get_by_role("button", name="Listeden ekle").first.click()
        page.get_by_label("Oyuncu listesi").fill("1 Kerem Aksoy QB\n7 Mehmet Kaya WR\n9 Deniz Aydın RSH")
        page.get_by_role("button", name="3 oyuncuyu ekle").click()

        page.goto(f"{base}/tr/panel/evaluation", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("evaluation is open in the menu", page.get_by_role("navigation").get_by_role("link", name="Oyuncu değerlendirme").count() >= 1)
        check("everyone starts unevaluated", page.get_by_text("Değerlendirilmedi").count() == 3)

        # Criteria: rename one, drop one, add one.
        page.get_by_role("button", name="Ölçütleri düzenle").click()
        dlg = page.get_by_role("dialog", name="Değerlendirme ölçütleri")
        names = dlg.get_by_label("Ölçüt adı")
        check("six default criteria", names.count() == 6, names.count())
        names.nth(1).fill("Rota koşma")
        dlg.get_by_role("button", name="Koçlanabilirlik ölçütünü sil").click()
        dlg.get_by_role("button", name="Ölçüt ekle").click()
        names.last.fill("Bayrak çekme")
        dlg.get_by_role("button", name="Kaydet").click()

        # An older evaluation, then a newer one: the trend goes up.
        def evaluate(player: str, day: date, marks: dict[str, int], strengths: str = "") -> None:
            page.get_by_role("button", name=f"Değerlendir: {player}").click()
            dlg = page.get_by_role("dialog", name=f"{player}: değerlendirme")
            dlg.get_by_label("Tarih").fill(day.isoformat())
            for crit, n in marks.items():
                dlg.get_by_role("button", name=f"{crit}: {n} / 5").click()
            if strengths:
                dlg.get_by_label("Güçlü yanları").fill(strengths)
            dlg.get_by_role("button", name="Kaydet").click()
            page.wait_for_timeout(150)

        page.get_by_role("button", name="Değerlendir: Kerem Aksoy").click()
        dlg = page.get_by_role("dialog", name="Kerem Aksoy: değerlendirme")
        check("renamed criterion is offered", dlg.get_by_role("button", name="Rota koşma: 3 / 5").count() == 1)
        check("deleted criterion is gone", dlg.get_by_text("Koçlanabilirlik").count() == 0)
        dlg.get_by_role("button", name="Kaydet").click()
        check("a rating is required", dlg.get_by_text("En az bir ölçütü puanla.").count() == 1)
        dlg.get_by_role("button", name="Vazgeç").click()
        evaluate("Kerem Aksoy", today - timedelta(days=30), {"Teknik": 3, "Fiziksel": 2})
        evaluate("Kerem Aksoy", today, {"Teknik": 4, "Fiziksel": 4, "Bayrak çekme": 4}, "Pas isabeti")
        row = page.locator("#evaluation-panel li").filter(has_text="Kerem Aksoy")
        check("latest mean shows", "4,0 / 5" in row.inner_text(), row.inner_text())
        check("trend is up", row.get_by_text("Önceki değerlendirmeye göre 1,5 yükseldi").count() == 1)
        shot("01-ratings")

        # A test day.
        page.get_by_role("tab", name="Testler").click()
        check("no test days yet", page.get_by_text("Henüz test günü yok.").count() == 1)
        page.get_by_role("button", name="Test günü ekle").click()
        dlg = page.get_by_role("dialog", name="Test günü ekle")
        dlg.get_by_label("Başlık").fill("Sezon öncesi combine")
        dlg.get_by_role("button", name="Oluştur").click()
        page.wait_for_url("**/panel/evaluation/tests/ts*")
        page.wait_for_timeout(300)
        check("flag has no bench test", page.get_by_text("Bench press").count() == 0)
        page.get_by_label("Kerem Aksoy, 40 yard koşu").fill("4,85")
        page.get_by_label("Mehmet Kaya, 40 yard koşu").fill("4,62")
        page.get_by_label("Mehmet Kaya, Dikey sıçrama").fill("71")
        page.get_by_label("Deniz Aydın, Dikey sıçrama").fill("710")
        page.wait_for_timeout(150)
        check("unusual reading is flagged", page.get_by_role("status").filter(has_text="olağan dışı").count() == 1)
        page.get_by_label("Deniz Aydın, Dikey sıçrama").fill("66")
        page.wait_for_timeout(150)
        check("flag clears once fixed", page.get_by_role("status").filter(has_text="olağan dışı").count() == 0)
        shot("02-session")

        # Bests.
        page.get_by_role("link", name="Değerlendirmeye dön").click()
        page.wait_for_url("**/panel/evaluation")
        page.get_by_role("tab", name="Testler").click()
        check("session is listed", page.get_by_text("Sezon öncesi combine").count() == 1 and page.get_by_text("3 oyuncu").count() == 1)
        best = page.locator("#evaluation-panel table tbody tr").filter(has_text="Mehmet Kaya")
        check("team best is marked", best.get_by_text("Takımın en iyisi", exact=False).count() == 2, best.inner_text())
        shot("03-bests")

        # Profile.
        page.get_by_role("tab", name="Değerlendirmeler").click()
        page.get_by_role("link", name="Kerem Aksoy").first.click()
        page.wait_for_url("**/panel/roster/pl*")
        page.wait_for_timeout(300)
        check("profile shows the evaluation", page.get_by_text("Pas isabeti").count() == 1)
        check("profile shows the test best", page.get_by_text("4,85 sn").count() == 1)
        page.get_by_text("Geçmiş değerlendirmeler (2)").click()
        page.locator("details li button").last.click()
        dlg = page.get_by_role("dialog", name="Kerem Aksoy: değerlendirme")
        check("an older evaluation reopens", dlg.get_by_role("button", name="Teknik: 3 / 5").get_attribute("aria-pressed") == "true")
        dlg.get_by_role("button", name="Değerlendirmeyi sil").click()
        page.wait_for_timeout(200)
        check("deleting leaves one", page.get_by_text("Geçmiş değerlendirmeler (1)").count() == 1)
        shot("04-profile")

        # Phone.
        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
        p2 = phone.new_page()
        p2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p2.goto(f"{base}/tr/panel/evaluation", wait_until="networkidle")
        p2.wait_for_timeout(300)
        shot("05-phone", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone: no page overflow", overflow <= 0, overflow)
        phone.close()

        check("no console errors", not errors, " | ".join(errors[:4]))
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
