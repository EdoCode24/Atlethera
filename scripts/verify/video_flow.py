"""Walks the Coach video analysis: add film by link, mark clips, jump to them, tag players and plays.

A short WebM is recorded in the browser (canvas + MediaRecorder) and served locally, so a real
video file plays; YouTube and a plain link are checked too.

Usage: python scripts/verify/video_flow.py BASE_URL OUT_DIR
"""
import argparse
import base64
import functools
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

from roster_flow import sign_up

FILE_PORT = 3210

RECORD = """async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(25);
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const parts = [];
  rec.ondataavailable = (e) => parts.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start();
  const t0 = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.fillStyle = '#0a3'; ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = '#fff'; ctx.font = '48px sans-serif'; ctx.fillText(t.toFixed(1), 110, 110);
      if (t < 6) requestAnimationFrame(draw); else resolve();
    };
    draw();
  });
  rec.stop();
  await done;
  const buf = await new Blob(parts, { type: 'video/webm' }).arrayBuffer();
  let s = ''; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}"""


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


def serve(folder: str) -> http.server.ThreadingHTTPServer:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", FILE_PORT), functools.partial(Quiet, directory=folder))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def run(a, errors: list[str], check) -> None:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        shot = lambda name, p=page: p.screenshot(path=os.path.join(a.out, f"{name}.png"), full_page=True)
        base = a.base

        # A real clip to play.
        page.goto(f"{base}/tr", wait_until="domcontentloaded")
        data = base64.b64decode(page.evaluate(RECORD))
        with open(os.path.join(a.out, "clip.webm"), "wb") as f:
            f.write(data)
        server = serve(a.out)
        file_url = f"http://127.0.0.1:{FILE_PORT}/clip.webm"

        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" and "youtube" not in m.text.lower() else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        sign_up(page, base, "af")
        page.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        page.get_by_role("button", name="Listeden ekle").first.click()
        page.get_by_label("Oyuncu listesi").fill("12 Kerem Aksoy QB\n7 Mehmet Kaya WR\n23 Arda Tan CB")
        page.get_by_role("button", name="3 oyuncuyu ekle").click()
        page.goto(f"{base}/tr/panel/playbook", wait_until="networkidle")
        page.get_by_role("button", name="Yeni playbook").first.click()
        page.get_by_label("Playbook adı").fill("Hücum")
        page.get_by_role("button", name="Oluştur", exact=True).click()
        page.wait_for_url("**/panel/playbook/pb*")
        page.get_by_role("button", name="Yeni hücum oyunu").click()
        page.get_by_label("Oyun adı").fill("Slant Flat")
        page.get_by_role("button", name="Oyunu oluştur ve çiz").click()
        page.wait_for_url("**/panel/playbook/pb*/play*")
        page.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        page.get_by_role("button", name="Maç ekle").first.click()
        page.get_by_role("dialog", name="Maç ekle").get_by_label("Rakip").fill("Ankara Wolves")
        page.get_by_role("dialog", name="Maç ekle").get_by_role("button", name="Etkinliği ekle").click()
        page.wait_for_url("**/panel/stats/ev*")

        # Add the film.
        page.goto(f"{base}/tr/panel/video", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("video is open in the menu", page.get_by_role("navigation").get_by_role("link", name="Video analiz").count() >= 1)
        check("empty list invites adding", page.get_by_text("Henüz video yok.").count() == 1)
        page.get_by_role("button", name="Video ekle").first.click()
        dlg = page.get_by_role("dialog", name="Video ekle")
        dlg.get_by_label("Başlık").fill("Ankara Wolves, 1. yarı")
        dlg.get_by_label("Video bağlantısı").fill("maç videosu")
        dlg.get_by_role("button", name="Videoyu ekle").click()
        check("a bad link is explained", dlg.get_by_text("Geçerli bir web bağlantısı yapıştır").count() == 1)
        dlg.get_by_label("Video bağlantısı").fill(file_url)
        dlg.get_by_label("Hangi maç ya da antrenman").select_option(label=dlg.get_by_label("Hangi maç ya da antrenman").locator("option").nth(1).inner_text())
        dlg.get_by_role("button", name="Videoyu ekle").click()
        page.wait_for_url("**/panel/video/vid*")
        page.wait_for_timeout(500)
        check("the file plays on the page", page.locator("video").count() == 1)
        check("the game is named", page.get_by_text("Ankara Wolves maçı").count() >= 1)

        # A clip at the current moment, one typed, one wrong.
        page.evaluate("(() => { const v = document.querySelector('video'); v.muted = true; return v.play(); })()")
        page.wait_for_timeout(2200)
        now = page.get_by_role("button", name="Şu anki an")
        check("current moment is offered once playing", now.is_enabled())
        now.click()
        typed = page.get_by_placeholder("12:45").input_value()
        check("current moment fills the time", typed in ("0:01", "0:02", "0:03"), typed)
        page.get_by_placeholder("Örn. 3. down, blitz'e karşı hot route").fill("Snap")
        page.get_by_role("button", name="Klibi ekle").click()
        page.get_by_placeholder("12:45").fill("1:75")
        page.get_by_role("button", name="Klibi ekle").click()
        check("a wrong time is explained", page.get_by_text("Zamanı dk:sn olarak gir").count() == 1)
        page.get_by_placeholder("12:45").fill("0:04")
        page.get_by_placeholder("Örn. 3. down, blitz'e karşı hot route").fill("Yakalama")
        page.get_by_placeholder("12:45").press("Enter")
        clips = page.locator("section[aria-labelledby=clips-title] ol > li")
        check("two clips, in time order", clips.count() == 2 and "Snap" in clips.nth(0).get_by_role("textbox").first.input_value(), clips.count())
        # Tag a player and a play.
        second = clips.nth(1)
        second.locator("select").select_option(label="7  Mehmet Kaya")
        check("player tagged", second.get_by_text("7 Mehmet Kaya").count() == 1)
        second.get_by_role("button", name="Oyun bağla").click()
        picker = page.get_by_role("dialog", name="Oyun bağla")
        picker.get_by_role("button", name="Slant Flat").click()
        picker.get_by_role("button", name="Bitti").click()
        check("play linked to the clip", second.get_by_role("link", name="Slant Flat").count() == 1)
        shot("01-video")

        # The profile lists the moment and opens the film at it.
        page.goto(f"{base}/tr/panel/roster", wait_until="networkidle")
        page.get_by_role("link", name="Mehmet Kaya").first.click()
        page.wait_for_url("**/panel/roster/pl*")
        page.wait_for_timeout(300)
        moment = page.get_by_role("link", name="0:04 Yakalama", exact=False)
        check("profile lists the moment", moment.count() == 1)
        moment.click()
        page.wait_for_url("**/panel/video/vid*t=4")
        page.wait_for_timeout(500)
        src = page.evaluate("document.querySelector('video').getAttribute('src')")
        check("the film opens at the moment", src.endswith("#t=4"), src)

        # Jumping needs a file with a seek index (MediaRecorder's has none): a public WebM.
        page.goto(f"{base}/tr/panel/video", wait_until="networkidle")
        page.get_by_role("button", name="Video ekle").first.click()
        dlg = page.get_by_role("dialog", name="Video ekle")
        dlg.get_by_label("Başlık").fill("Arama denemesi")
        dlg.get_by_label("Video bağlantısı").fill("https://upload.wikimedia.org/wikipedia/commons/2/22/Volcano_Lava_Sample.webm")
        dlg.get_by_role("button", name="Videoyu ekle").click()
        page.wait_for_url("**/panel/video/vid*")
        page.wait_for_function("document.querySelector('video') && document.querySelector('video').readyState >= 1", timeout=20000)
        page.get_by_placeholder("12:45").fill("0:04")
        page.get_by_role("button", name="Klibi ekle").click()
        page.evaluate("document.querySelector('video').muted = true")
        page.get_by_role("button", name="0:04 anına git").click()
        page.wait_for_timeout(1200)
        at = page.evaluate("document.querySelector('video').currentTime")
        check("jumping seeks the video", 3.9 <= at <= 6, at)

        # YouTube and a plain link.
        page.goto(f"{base}/tr/panel/video", wait_until="networkidle")
        page.get_by_role("button", name="Video ekle").first.click()
        dlg = page.get_by_role("dialog", name="Video ekle")
        dlg.get_by_label("Başlık").fill("Rakip analizi")
        dlg.get_by_label("Video bağlantısı").fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
        dlg.get_by_role("button", name="Videoyu ekle").click()
        page.wait_for_url("**/panel/video/vid*")
        page.wait_for_timeout(2500)
        src = page.locator("iframe").get_attribute("src") or ""
        check("YouTube embeds without cookies and with the JS API", "youtube-nocookie.com/embed/aqz-KE-bpKQ?enablejsapi=1" in src, src)
        print("info: YouTube reported a time:", page.get_by_role("button", name="Şu anki an").is_enabled())
        page.goto(f"{base}/tr/panel/video", wait_until="networkidle")
        page.get_by_role("button", name="Video ekle").first.click()
        dlg = page.get_by_role("dialog", name="Video ekle")
        dlg.get_by_label("Başlık").fill("Hudl kesiti")
        dlg.get_by_label("Video bağlantısı").fill("https://www.hudl.com/video/3/123/abc")
        dlg.get_by_role("button", name="Videoyu ekle").click()
        page.wait_for_url("**/panel/video/vid*")
        page.wait_for_timeout(300)
        check("a plain link opens in a new tab", page.get_by_role("link", name="Bağlantıyı aç").get_attribute("target") == "_blank")
        page.get_by_placeholder("12:45").fill("2:10")
        page.get_by_role("button", name="Klibi ekle").click()
        check("its clips can't seek", page.get_by_role("button", name="2:10 anına git").is_disabled())

        # The list, and the game leaving the calendar.
        page.goto(f"{base}/tr/panel/video", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("list shows four videos", page.locator("main ul > li").count() == 4, page.locator("main ul > li").count())
        check("list shows clip counts", page.get_by_text("2 klip").count() == 1)
        shot("02-list")
        page.goto(f"{base}/tr/panel/stats", wait_until="networkidle")
        page.get_by_role("link", name="Ankara Wolves maçı").click()
        page.get_by_role("button", name="Tarih ve saati düzenle").click()
        page.get_by_role("dialog", name="Etkinliği düzenle").get_by_role("button", name="Etkinliği sil").click()
        page.get_by_role("dialog", name="Etkinliği sil").get_by_role("button", name="Sil").click()
        page.goto(f"{base}/tr/panel/video", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("film stays when the game goes", page.get_by_text("Ankara Wolves, 1. yarı").count() == 1 and page.get_by_text("Ankara Wolves maçı").count() == 0)

        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, storage_state=ctx.storage_state())
        p2 = phone.new_page()
        p2.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        p2.goto(f"{base}/tr/panel/video", wait_until="networkidle")
        p2.get_by_text("Ankara Wolves, 1. yarı").click()
        p2.wait_for_url("**/panel/video/vid*")
        p2.wait_for_timeout(500)
        shot("03-phone", p2)
        overflow = p2.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("phone: no page overflow", overflow <= 0, overflow)
        phone.close()

        check("no console errors", not errors, " | ".join(errors[:4]))
        server.shutdown()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
