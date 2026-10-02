"""Walks the Coach roster: add, bulk add, filter, depth chart, profile, edit, delete.

Usage: python scripts/verify/roster_flow.py BASE_URL OUT_DIR [--sport af|flag] [--locale tr|en]
"""
import argparse
import os
import sys

from playwright.sync_api import Page, sync_playwright

from supa import unique_email


def sign_up(page: Page, base: str, sport: str, email: str | None = None) -> str:
    """Signs a new coach up and opens their team; each run gets its own @atlethera.test address."""
    email = email or unique_email("coach")
    page.goto(f"{base}/tr/signup?package=coach", wait_until="networkidle")
    page.get_by_label("Ad soyad").fill("Erdem Test")
    page.get_by_label("E-posta").fill(email)
    page.get_by_label("Şifre").fill("sifre1234")
    page.get_by_role("button", name="Hesabı oluştur").click()
    page.wait_for_url("**/tr/onboarding**")
    page.get_by_role("button", name="Devam").click()
    page.get_by_role("button", name="Flag Football" if sport == "flag" else "American Football").click()
    page.get_by_role("button", name="Devam").click()
    page.get_by_label("Takımının adı").fill("İstanbul Thunders")
    page.get_by_role("button", name="Paneli aç").click()
    page.wait_for_url("**/tr/panel")
    return email


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    ap.add_argument("--sport", default="af")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    errors: list[str] = []
    checks: list[tuple[str, bool, str]] = []
    check = lambda name, ok, detail="": checks.append((name, bool(ok), str(detail)))
    af = a.sport == "af"

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 860})
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        shot = lambda name: page.screenshot(path=os.path.join(a.out, f"{name}.png"), full_page=True)

        sign_up(page, a.base, a.sport)
        nav = page.get_by_role("navigation").get_by_role("link", name="Roster")
        check("roster is open in the menu", nav.count() >= 1, nav.count())
        nav.first.click()
        page.wait_for_url("**/tr/panel/roster")
        page.wait_for_timeout(500)
        shot("01-empty")
        check("empty state invites adding", page.get_by_text("Henüz oyuncu yok").count() == 1)

        # One player through the form, with a validation error first.
        page.get_by_role("button", name="Oyuncu ekle").first.click()
        dialog = page.get_by_role("dialog", name="Yeni oyuncu")
        check("new player dialog opens with the name focused", page.evaluate("document.activeElement === document.querySelector('dialog[open] input')"))
        dialog.get_by_role("button", name="Oyuncuyu ekle").click()
        check("empty name is explained", dialog.get_by_text("Oyuncunun adını yaz.").count() == 1)
        dialog.get_by_label("Ad", exact=True).fill("Kerem")
        dialog.get_by_label("Soyad").fill("Aksoy")
        dialog.get_by_label("Forma numarası").fill("12")
        dialog.get_by_role("button", name="QB", exact=True).click()
        dialog.get_by_label("Boy (cm)").fill("80")
        dialog.get_by_role("button", name="Oyuncuyu ekle").click()
        check("out-of-range height is explained", dialog.get_by_text("Boy 120 ile 230 cm arasında olmalı.").count() == 1)
        dialog.get_by_label("Boy (cm)").fill("188")
        dialog.get_by_label("Kilo (kg)").fill("92,5")
        dialog.get_by_label("Doğum tarihi").fill("2003-05-14")
        shot("02-form")
        dialog.get_by_label("Kilo (kg)").press("Enter")
        page.wait_for_timeout(300)
        check("the player is listed", page.get_by_role("link", name="Kerem Aksoy").count() >= 1)

        # A pasted list.
        page.get_by_role("button", name="Listeden ekle").first.click()
        bulk = page.get_by_role("dialog", name="Listeden oyuncu ekle")
        if af:
            text = "7 Mehmet Kaya WR CB\nCan Demir 88 TE XY\nali veli 1 QB\n71 Emre Koç LT\n\n55 Burak Şen MLB\n23 Arda Tan CB\n12 Tolga Er WR\nsadece 5"
        else:
            text = "7 Mehmet Kaya WR CB\nCan Demir 88 C XY\nali veli 1 QB\n9 Deniz Aydın RSH\n\n55 Burak Şen LB\n23 Arda Tan CB\n12 Tolga Er WR S\nsadece 5"
        bulk.get_by_label("Oyuncu listesi").fill(text)
        page.wait_for_timeout(200)
        shot("03-bulk")
        add_button = bulk.get_by_role("button", name="8 oyuncuyu ekle")
        check("bulk preview counts 8 players", add_button.count() == 1, bulk.locator("footer").inner_text())
        check("unknown word is reported", bulk.get_by_text("Satır 2: “XY”").count() == 1)
        add_button.click()
        page.wait_for_timeout(300)
        summary = page.get_by_text("9 oyuncu, 9 aktif, 0 sakat").count()
        check("summary counts the roster", summary == 1)
        rows = page.locator("table tbody tr").count()
        check("table lists 9 players", rows == 9, rows)
        dup = page.locator("table tbody tr").filter(has_text="Tolga Er").get_by_text("Bu numarayı başka bir oyuncu da giyiyor.").count()
        check("duplicate number is flagged", dup == 1, dup)
        check("lowercase names are tidied", page.get_by_role("link", name="Ali Veli").count() == 1)
        shot("04-list")

        # Filters.
        page.get_by_label("Oyuncu ara").fill("12")
        page.wait_for_timeout(150)
        check("search by number finds both 12s", page.locator("table tbody tr").count() == 2, page.locator("table tbody tr").count())
        page.get_by_label("Oyuncu ara").fill("")
        page.locator("select").nth(0).select_option("defense")
        page.wait_for_timeout(150)
        defense = page.locator("table tbody tr").count()
        check("side filter keeps defenders", defense == (3 if af else 5), defense)
        page.locator("select").nth(0).select_option("all")
        page.locator("select").nth(3).select_option("name")
        first = page.locator("table tbody tr").first.inner_text()
        check("sort by last name puts Aksoy first", "Aksoy" in first, first[:40])

        # Injured status through edit.
        page.locator("table tbody tr").filter(has_text="Mehmet Kaya").get_by_role("button", name="Oyuncuyu düzenle: Mehmet Kaya").click()
        edit = page.get_by_role("dialog", name="Oyuncuyu düzenle")
        edit.get_by_role("button", name="Sakat").click()
        edit.get_by_label("Sakatlık").fill("Sol ayak bileği")
        edit.get_by_label("Tahmini dönüş").fill("2026-10-15")
        edit.get_by_role("button", name="Kaydet").click()
        page.wait_for_timeout(300)
        check("injury shows in the list", page.get_by_text("Sol ayak bileği").count() == 1)
        check("summary counts the injured", page.get_by_text("9 oyuncu, 8 aktif, 1 sakat").count() == 1)

        # Depth chart.
        page.get_by_role("tab", name="Depth chart").click()
        page.wait_for_timeout(200)
        shot("05-depth")
        qb = page.locator("h3", has_text="QB").locator("xpath=..")
        order = qb.locator("li a").all_inner_texts()
        check("QB depth lists both quarterbacks", order == ["Kerem Aksoy", "Ali Veli"], order)
        qb.get_by_role("button", name="Ali Veli: yukarı").click()
        page.wait_for_timeout(200)
        order = qb.locator("li a").all_inner_texts()
        check("moving up changes the starter", order == ["Ali Veli", "Kerem Aksoy"], order)

        # Profile.
        qb.get_by_role("link", name="Kerem Aksoy").click()
        page.wait_for_url("**/panel/roster/pl*")
        page.wait_for_timeout(300)
        shot("06-profile")
        check("profile shows the name", page.get_by_role("heading", name="Kerem Aksoy").count() == 1)
        check("profile shows the depth place", page.get_by_text("2. sıra").count() == 1)
        check("profile shows weight with a Turkish decimal comma", page.get_by_text("92,5").count() == 1)

        # Delete from the profile.
        page.get_by_role("button", name="Düzenle").click()
        page.get_by_role("dialog", name="Oyuncuyu düzenle").get_by_role("button", name="Oyuncuyu sil").click()
        confirm = page.get_by_role("dialog", name="Oyuncuyu sil")
        check("delete asks first", confirm.get_by_text("“Kerem Aksoy” roster'dan silinsin mi?").count() == 1)
        confirm.get_by_role("button", name="Sil").click()
        page.wait_for_url("**/panel/roster")
        page.wait_for_timeout(300)
        check("deleted player is gone", page.get_by_role("link", name="Kerem Aksoy").count() == 0)
        check("summary after delete", page.get_by_text("8 oyuncu, 7 aktif, 1 sakat").count() == 1)

        # Unknown player id.
        page.goto(f"{a.base}/tr/panel/roster/pl-nope", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("unknown player says so", page.get_by_text("Bu oyuncu bulunamadı.").count() == 1)

        # English.
        page.goto(f"{a.base}/en/panel/roster", wait_until="networkidle")
        page.wait_for_timeout(400)
        check("English summary", page.get_by_text("8 players, 7 active, 1 injured").count() == 1)
        shot("07-en")

        # Phone.
        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
        p2 = phone.new_page()
        p2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p2.goto(f"{a.base}/tr/panel/roster", wait_until="networkidle")
        p2.wait_for_timeout(500)
        p2.screenshot(path=os.path.join(a.out, "08-phone.png"), full_page=True)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone: no horizontal overflow", overflow <= 0, overflow)
        cards = p2.locator("ul.md\\:hidden > li").count()
        check("phone: one card per player", cards == 8, cards)
        p2.get_by_role("tab", name="Depth chart").click()
        p2.wait_for_timeout(200)
        p2.screenshot(path=os.path.join(a.out, "09-phone-depth.png"), full_page=True)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone depth: no horizontal overflow", overflow <= 0, overflow)
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
