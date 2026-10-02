"""A live meeting between a coach and a player: start, join, see and hear each other, share a
screen, chat, end; attendance fills itself. Chromium's fake camera and microphone stand in for
real devices, and a canvas stream stands in for screen capture.

Usage: python scripts/verify/live_flow.py BASE_URL OUT_DIR   (needs .env.local with LiveKit keys)
"""
import argparse
import os
import sys

from playwright.sync_api import sync_playwright

from roster_flow import sign_up
from supa import ENV, SECRET, configured, delete_test_users, unique_email

# Windows consoles default to a legacy code page.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

FAKE_SCREEN = """
(() => {
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    const x = c.getContext('2d'); let f = 0;
    setInterval(() => { x.fillStyle = f++ % 2 ? '#0a3' : '#036'; x.fillRect(0, 0, 640, 360); }, 100);
    return c.captureStream(10);
  };
})();
"""
NO_SCREEN = "(() => { if (navigator.mediaDevices) delete MediaDevices.prototype.getDisplayMedia; })();"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if not configured() or not ENV.get("LIVEKIT_URL"):
        print("Supabase or LiveKit is not configured (.env.local).")
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


def watch(page, who: str, errors: list[str], trail: list[str]) -> None:
    """Page errors fail the run; console errors and the live API's answers explain a failure."""
    page.on("pageerror", lambda e: errors.append(f"{who} pageerror: {e}"))
    page.on("crash", lambda _: (errors.append(f"{who} tab crashed"), trail.append(f"{who} TAB CRASHED at {page.url}")))
    page.on("console", lambda m: trail.append(f"{who} console.{m.type}: {m.text[:300]}") if m.type in ("error", "warning") else None)

    def answered(res):
        if "/api/live/" in res.url:
            detail = "" if res.ok else f" {res.text()[:200]}"
            trail.append(f"{who} {res.request.method} {res.url.split('/api')[1]} → {res.status}{detail}")
        elif res.status >= 400:
            trail.append(f"{who} {res.request.method} {res.url[:140]} → {res.status}")

    page.on("response", answered)


def run(a, errors: list[str], check) -> None:
    trail: list[str] = []
    pages: dict = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        try:
            steps(a, errors, check, trail, pages, browser)
        except Exception:
            for who, page in pages.items():
                try:
                    page.screenshot(path=os.path.join(a.out, f"failed-{who}.png"))
                except Exception:
                    pass
            print("\n".join(trail[-30:]) or "(no console errors or live API calls)")
            raise
        finally:
            browser.close()


def steps(a, errors: list[str], check, trail: list[str], pages: dict, browser) -> None:
    base = a.base
    coach_ctx = browser.new_context(viewport={"width": 1280, "height": 860}, permissions=["camera", "microphone"])
    coach_ctx.add_init_script(FAKE_SCREEN)
    coach = coach_ctx.new_page()
    pages["coach"] = coach
    watch(coach, "coach", errors, trail)
    shot = lambda name, p: p.screenshot(path=os.path.join(a.out, f"{name}.png"))

    # Team, player, invite.
    sign_up(coach, base, "af")
    coach.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
    coach.get_by_role("button", name="Listeden ekle").first.click()
    coach.get_by_label("Oyuncu listesi").fill("7 Mehmet Kaya WR")
    coach.get_by_role("button", name="1 oyuncuyu ekle").click()
    coach.get_by_role("button", name="Panel erişimi: Mehmet Kaya").click()
    access = coach.get_by_role("dialog", name="Mehmet Kaya: panel erişimi")
    access.get_by_role("button", name="Davet linki oluştur").click()
    link = access.get_by_label("Davet linki").input_value()
    access.get_by_role("button", name="Kapat").last.click()

    player_ctx = browser.new_context(viewport={"width": 1280, "height": 860}, permissions=["camera", "microphone"])
    player_ctx.add_init_script(FAKE_SCREEN)
    player = player_ctx.new_page()
    pages["player"] = player
    watch(player, "player", errors, trail)
    player.goto(link, wait_until="networkidle")
    player.get_by_role("link", name="Hesap oluştur ve katıl").click()
    player.get_by_label("Ad soyad").fill("Mehmet Kaya")
    player.get_by_label("E-posta").fill(unique_email("live-player"))
    player.get_by_label("Şifre").fill("sifre1234")
    player.get_by_role("button", name="Hesabı oluştur").click()
    player.wait_for_url("**/tr/panel", timeout=30000)

    # The coach starts a meeting.
    coach.goto(f"{base}/tr/panel/meetings", wait_until="networkidle")
    coach.get_by_role("button", name="Toplantı ekle").first.click()
    coach.get_by_role("dialog", name="Toplantı ekle").get_by_label("Başlık").fill("Film toplantısı")
    coach.get_by_role("dialog", name="Toplantı ekle").get_by_role("button", name="Etkinliği ekle").click()
    coach.wait_for_url("**/panel/meetings/ev*")
    player.goto(f"{base}/tr/panel", wait_until="networkidle")
    coach.get_by_role("button", name="Canlı toplantıyı başlat").click()
    coach.wait_for_url("**/live", timeout=20000)
    coach.get_by_role("button", name="Toplantıya katıl").click()
    coach.locator("[data-identity]").first.wait_for(timeout=20000)
    check("coach is in the room", coach.locator("[data-identity]").count() == 1)

    # The player sees the banner and joins.
    banner = player.get_by_role("link", name="Katıl")
    banner.first.wait_for(timeout=15000)
    check("player sees the live banner", player.get_by_text("Canlı: Film toplantısı").count() >= 1)
    shot("01-player-banner", player)
    banner.first.click()
    player.wait_for_url("**/live")
    player.get_by_role("button", name="Mikrofon").click()
    player.get_by_role("button", name="Toplantıya katıl").click()
    player.wait_for_function("document.querySelectorAll('[data-identity]').length === 2", timeout=20000)
    coach.wait_for_function("document.querySelectorAll('[data-identity]').length === 2", timeout=20000)
    check("both see two people", True)
    coach.wait_for_function(
        "[...document.querySelectorAll('[data-identity] video')].some(v => !v.closest('[data-identity]').querySelector('.-scale-x-100') && v.videoWidth > 0)",
        timeout=20000,
    )
    check("the coach sees the player's video", True)
    coach.wait_for_function("!!document.querySelector('[data-speaking]')", timeout=20000)
    check("someone speaking lights up", True)
    shot("02-coach-room", coach)

    # Screen share and chat.
    coach.get_by_role("button", name="Ekranı paylaş").click()
    player.locator("[data-layout=focus]").wait_for(timeout=20000)
    check("the player sees the shared screen", player.get_by_text("ekranını paylaşıyor").count() == 1)
    player.wait_for_function("(() => { const v = document.querySelector('[data-layout=focus] video[data-testid=screen-share]'); return !!v && v.videoWidth > 0; })()", timeout=20000)
    check("the shared screen's picture arrives", True)
    shot("03-player-share", player)
    coach.get_by_role("button", name="Paylaşımı durdur").click()
    player.get_by_role("button", name="Sohbet").click()
    player.get_by_placeholder("Mesaj yaz").fill("Hazırım koç")
    player.get_by_role("button", name="Gönder").click()
    coach.get_by_role("button", name="Sohbet").click()
    coach.get_by_text("Hazırım koç").wait_for(timeout=10000)
    check("chat reaches the coach", True)

    # Phone: no share button where screens can't be shared.
    phone_ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, permissions=["camera", "microphone"], storage_state=player_ctx.storage_state())
    phone_ctx.add_init_script(NO_SCREEN)
    phone = phone_ctx.new_page()
    pages["phone"] = phone
    watch(phone, "phone", errors, trail)
    phone.goto(player.url, wait_until="networkidle")
    phone.get_by_role("button", name="Toplantıya katıl").click()
    phone.locator("[data-identity]").first.wait_for(timeout=20000)
    check("phone: no share button without screen capture", phone.get_by_role("button", name="Ekranı paylaş").count() == 0)
    phone.wait_for_function("document.querySelectorAll('[data-identity]').length === 2", timeout=20000)
    phone.wait_for_function("[...document.querySelectorAll('[data-identity] video')].some((v) => !v.classList.contains('-scale-x-100') && v.videoWidth > 0)", timeout=20000)
    check("phone: the coach's video arrives", True)
    shot("04-phone-room", phone)
    overflow = phone.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("phone: no horizontal overflow", overflow <= 0, overflow)
    # The same account joined twice: the first device is told so and can come back.
    player.get_by_text("Bu hesapla başka bir sekmeden ya da cihazdan katıldın.").wait_for(timeout=15000)
    check("same account on a second device: the first one is told", True)
    phone_ctx.close()
    player.get_by_role("button", name="Tekrar katıl").click()
    player.get_by_role("button", name="Toplantıya katıl").click()
    player.wait_for_function("document.querySelectorAll('[data-identity]').length === 2", timeout=20000)
    check("the first device rejoins", True)

    # The coach ends it for everyone; attendance filled itself.
    player.get_by_role("button", name="Sohbet").click()
    coach.get_by_role("button", name="Herkes için bitir").click()
    coach.get_by_role("dialog", name="Herkes için bitir").get_by_role("button", name="Herkes için bitir").click()
    player.get_by_text("Toplantı bitti.").wait_for(timeout=20000)
    check("the player's call ends", True)
    coach.goto(coach.url.replace("/live", ""), wait_until="networkidle")
    coach.get_by_role("tab", name="Yoklama").click()
    row = coach.locator("#meeting-panel ul > li").filter(has_text="Mehmet Kaya")
    check("attendance marked the player present", row.get_by_role("button", name="Geldi").get_attribute("aria-pressed") == "true")

    check("no page errors", not errors, " | ".join(errors[:4]))


if __name__ == "__main__":
    sys.exit(main())
