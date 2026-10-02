"""Coach and player in two browsers: invite link, read-only panel, privacy, live updates.

Usage: python scripts/verify/players_flow.py BASE_URL OUT_DIR   (needs .env.local)
"""
import argparse
import os
import sys
import time

from playwright.sync_api import sync_playwright

from roster_flow import sign_up
from supa import SECRET, URL, configured, delete_test_users, unique_email

MARKERS = ["+90 555 000 33 44", "GIZLI-NOT-TAKIM", "GIZLI-SAKATLIK-TAKIM", "BASKASININ-GUCLU-YANI"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if not configured():
        print("Supabase is not configured (.env.local).")
        return 1
    errors: list[str] = []
    checks: list[tuple[str, bool, str]] = []
    check = lambda name, ok, detail="": checks.append((name, bool(ok), str(detail)))
    delete_test_users()
    try:
        run(a, errors, check)
    except Exception as e:  # Report what passed before the step that broke.
        check(f"flow ran to the end ({type(e).__name__})", False, str(e).splitlines()[0])
    finally:
        if SECRET:
            delete_test_users()
    failed = [c for c in checks if not c[1]]
    for name, ok, detail in checks:
        print("PASS" if ok else "FAIL", name, f"— {detail}" if detail and not ok else "")
    print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
    return 1 if failed else 0


def wait_saved(page) -> None:
    """The coach's changes have reached the server."""
    page.get_by_text("Kaydedildi").first.wait_for(timeout=15000)


def run(a, errors: list[str], check) -> None:
    base = a.base
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        coach_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        coach = coach_ctx.new_page()
        coach.on("pageerror", lambda e: errors.append(f"coach pageerror: {e}"))
        shot = lambda name, p: p.screenshot(path=os.path.join(a.out, f"{name}.png"), full_page=True)

        # The coach's team, with private data about a teammate.
        sign_up(coach, base, "af")
        coach.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        coach.get_by_role("button", name="Listeden ekle").first.click()
        coach.get_by_label("Oyuncu listesi").fill("7 Mehmet Kaya WR\n12 Kerem Aksoy QB")
        coach.get_by_role("button", name="2 oyuncuyu ekle").click()
        coach.locator("table tbody tr").filter(has_text="Kerem Aksoy").get_by_role("button", name="Oyuncuyu düzenle: Kerem Aksoy").click()
        dlg = coach.get_by_role("dialog", name="Oyuncuyu düzenle")
        dlg.get_by_role("button", name="Sakat").click()
        dlg.get_by_label("Sakatlık").fill(MARKERS[2])
        dlg.get_by_label("Telefon").fill(MARKERS[0])
        dlg.get_by_label("Notlar").fill(MARKERS[1])
        dlg.get_by_role("button", name="Kaydet").click()
        coach.goto(f"{base}/tr/panel/evaluation", wait_until="networkidle")
        coach.get_by_role("button", name="Değerlendir: Kerem Aksoy").click()
        ev = coach.get_by_role("dialog", name="Kerem Aksoy: değerlendirme")
        ev.get_by_role("button", name="Teknik: 4 / 5").click()
        ev.get_by_label("Güçlü yanları").fill(MARKERS[3])
        ev.get_by_role("button", name="Kaydet").click()
        coach.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        coach.get_by_role("button", name="Etkinlik ekle").click()
        ec = coach.get_by_role("dialog", name="Yeni etkinlik")
        ec.get_by_label("Başlık").fill("Salı antrenmanı")
        ec.get_by_label("Başlangıç").fill("19:00")
        ec.get_by_role("button", name="Etkinliği ekle").click()
        wait_saved(coach)

        # Invite link for Mehmet.
        coach.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        coach.get_by_role("button", name="Panel erişimi: Mehmet Kaya").click()
        access = coach.get_by_role("dialog", name="Mehmet Kaya: panel erişimi")
        access.get_by_role("button", name="Davet linki oluştur").click()
        link = access.get_by_label("Davet linki").input_value()
        check("invite link is made", "/tr/join/" in link, link)
        access.get_by_text("Son geçerlilik").first.wait_for(timeout=5000)
        shot("01-invite", coach)
        access.get_by_role("button", name="Kapat").last.click()
        check("the roster shows the invite waiting", coach.locator("table tbody tr").filter(has_text="Mehmet Kaya").get_by_text("Davet bekliyor").count() == 1)

        # The player opens it in another browser.
        player_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        player = player_ctx.new_page()
        player.on("pageerror", lambda e: errors.append(f"player pageerror: {e}"))
        bodies: list[str] = []

        def collect(response):
            if URL and response.url.startswith(URL):
                try:
                    bodies.append(response.text())
                except Exception:
                    pass

        player.on("response", collect)
        player.goto(link, wait_until="networkidle")
        check("join page names the team and the player", player.get_by_text("seni takıma davet etti").count() == 1 and player.get_by_text("Mehmet K. #7").count() == 1)
        shot("02-join", player)
        player.get_by_role("link", name="Hesap oluştur ve katıl").click()
        player.wait_for_url("**/signup**")
        check("sign-up is prefilled with the name", player.get_by_label("Ad soyad").input_value() == "Mehmet")
        player.get_by_label("Ad soyad").fill("Mehmet Kaya")
        player.get_by_label("E-posta").fill(unique_email("player"))
        player.get_by_label("Şifre").fill("sifre1234")
        player.get_by_role("button", name="Hesabı oluştur").click()
        player.wait_for_url("**/tr/panel", timeout=30000)
        player.wait_for_timeout(800)
        check("player lands in the panel", player.get_by_text("Oyuncu", exact=True).count() >= 1)
        check("player dashboard offers their profile", player.get_by_role("link", name="Profilimi aç").count() == 1)
        shot("03-player-dashboard", player)

        # The coach sees the link used.
        coach.wait_for_timeout(1500)
        check("coach sees the player linked", coach.locator("table tbody tr").filter(has_text="Mehmet Kaya").get_by_text("Bağlı").count() == 1)

        # Read-only everywhere.
        player.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        player.wait_for_timeout(500)
        check("roster: no adding", player.get_by_role("button", name="Oyuncu ekle").count() == 0)
        check("roster: no access column", player.locator("table thead").get_by_text("Panel", exact=True).count() == 0 and player.get_by_text("Hesap yok").count() == 0)
        shot("03b-player-roster", player)
        player.get_by_role("link", name="Kerem Aksoy").first.click()
        player.wait_for_url("**/panel/roster/pl*")
        player.wait_for_timeout(300)
        check("teammate profile has no contact or notes", player.get_by_text("İletişim").count() == 0 and player.get_by_text("Notlar").count() == 0)
        check("teammate profile can't be edited", player.get_by_role("button", name="Düzenle").count() == 0)
        player.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        player.wait_for_timeout(500)
        check("calendar: no adding", player.get_by_role("button", name="Etkinlik ekle").count() == 0)
        player.get_by_role("tab", name="Yaklaşanlar").click()
        player.locator("#calendar-panel li button").first.click()
        details = player.get_by_role("dialog", name="Salı antrenmanı")
        check("an event opens read-only", details.count() == 1 and details.get_by_role("button", name="Etkinliği sil").count() == 0)
        details.get_by_role("button", name="Kapat").last.click()
        player.goto(f"{base}/tr/panel/playbook", wait_until="networkidle")
        check("playbook: no new playbook", player.get_by_role("button", name="Yeni playbook").count() == 0)
        player.goto(f"{base}/tr/panel/evaluation", wait_until="networkidle")
        player.wait_for_timeout(300)
        check("evaluation reads as mine", player.get_by_role("heading", name="Değerlendirmem").count() == 1 and player.get_by_role("button", name="Değerlendir: Mehmet Kaya").count() == 0)
        shot("04-player-evaluation", player)

        # A write from the player's browser would be refused anyway: the store logs and drops it.
        # Privacy: nothing private about a teammate reached this browser.
        html = player.content()
        leaked = [m for m in MARKERS if any(m in b for b in bodies) or m in html]
        check("no private data reached the player", not leaked, leaked)

        # Live updates: the coach renames the event, the player's calendar follows without reload.
        player.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        player.get_by_role("tab", name="Yaklaşanlar").click()
        coach.goto(f"{base}/tr/panel/calendar", wait_until="networkidle")
        coach.get_by_role("tab", name="Yaklaşanlar").click()
        coach.locator("#calendar-panel li button").first.click()
        edit = coach.get_by_role("dialog", name="Etkinliği düzenle")
        edit.get_by_label("Başlık").fill("Salı antrenmanı (saha 2)")
        edit.get_by_role("button", name="Kaydet").click()
        t0 = time.time()
        player.get_by_text("Salı antrenmanı (saha 2)").first.wait_for(timeout=10000)
        check("the coach's change reaches the player live", time.time() - t0 < 10, round(time.time() - t0, 1))
        shot("05-player-live-update", player)

        check("no page errors", not errors, " | ".join(errors[:4]))
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
