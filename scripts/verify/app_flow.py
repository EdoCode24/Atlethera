"""Walks the demo app end to end and screenshots each step.

Usage: python scripts/verify/app_flow.py BASE_URL OUT_DIR [--w 1180 --h 820] [--sport flag|af]
"""
import argparse
import os
import sys

from playwright.sync_api import Page, sync_playwright

from supa import server_playbooks, unique_email, wait_synced


def first_play_player(page: Page, label: str) -> dict:
    """A player of the first play, as the server has it once the page has sent its changes."""
    wait_synced(page)
    play = server_playbooks(page)[0]["plays"][0]
    return next(x for x in play["players"] if x["label"] == label)


def field_point(page: Page, x: float, y: float) -> tuple[float, float]:
    """Screen coordinates for a spot in yards on the editor field."""
    return page.evaluate(
        """([x, y]) => {
          const svg = document.querySelector('svg.play-canvas');
          const p = new DOMPoint(x, -y).matrixTransform(svg.getScreenCTM());
          return [p.x, p.y];
        }""",
        [x, y],
    )


def player_point(page: Page, label: str) -> tuple[float, float]:
    box = page.locator("svg.play-canvas g[data-player-id]", has=page.locator(f"text:text-is('{label}')")).first.bounding_box()
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    ap.add_argument("--w", type=int, default=1180)
    ap.add_argument("--h", type=int, default=820)
    ap.add_argument("--sport", default="flag")
    ap.add_argument("--special", action="store_true", help="American football: create one play per special-teams unit")
    ap.add_argument("--locale", default="tr")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    errors: list[str] = []
    checks: list[tuple[str, bool]] = []
    L = a.locale

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": a.w, "height": a.h}, has_touch=True)
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        shot = lambda name: page.screenshot(path=os.path.join(a.out, f"{name}.png"))

        def open_field_options():
            """Field options sit in the top bar, or in the More menu on phones."""
            name = "Saha ayarları" if L == "tr" else "Field options"
            if a.w < 640:
                page.get_by_role("button", name="Diğer" if L == "tr" else "More").click()
                page.get_by_role("menuitem", name=name).click()
            else:
                page.get_by_role("button", name=name).first.click()

        # Sign up
        page.goto(f"{a.base}/{L}/signup?package=coach", wait_until="networkidle")
        shot("01-signup")
        page.get_by_label("Ad soyad" if L == "tr" else "Full name").fill("Erdem Test")
        page.get_by_label("E-posta" if L == "tr" else "Email").fill(unique_email("app"))
        page.get_by_label("Şifre" if L == "tr" else "Password").fill("sifre1234")
        page.get_by_role("button", name="Hesabı oluştur" if L == "tr" else "Create account").click()
        page.wait_for_url(f"**/{L}/onboarding**")
        page.wait_for_timeout(600)
        shot("02-onboarding-package")
        checks.append(("coach preselected from ?package", page.get_by_role("button", name="Koç" if L == "tr" else "Coach").first.get_attribute("aria-pressed") == "true"))
        page.get_by_role("button", name="Devam" if L == "tr" else "Continue").click()
        page.wait_for_timeout(300)
        sport_name = "Flag Football" if a.sport == "flag" else "American Football"
        page.get_by_role("button", name=sport_name).click()
        shot("03-onboarding-sport")
        page.get_by_role("button", name="Devam" if L == "tr" else "Continue").click()
        page.get_by_label("Takımının adı" if L == "tr" else "Your team's name").fill("İstanbul Thunders")
        page.get_by_role("button", name="Paneli aç" if L == "tr" else "Open the dashboard").click()
        page.wait_for_url(f"**/{L}/panel")
        page.wait_for_timeout(800)
        shot("04-dashboard")

        # Playbook list → new playbook
        page.goto(f"{a.base}/{L}/panel/playbook", wait_until="networkidle")
        page.wait_for_timeout(500)
        page.get_by_role("button", name="Yeni playbook" if L == "tr" else "New playbook").first.click()
        page.wait_for_timeout(300)
        shot("05-new-playbook")
        page.get_by_label("Playbook adı" if L == "tr" else "Playbook name").fill("Deneme 2")
        if a.sport == "flag":
            page.get_by_role("button", name="30 yd (NFL FLAG)").click()
        page.get_by_role("button", name="Oluştur" if L == "tr" else "Create", exact=True).click()
        page.wait_for_url("**/panel/playbook/pb*")
        page.wait_for_timeout(700)
        shot("06-playbook-empty")

        # New offensive play
        page.get_by_role("button", name="Yeni hücum oyunu" if L == "tr" else "New offensive play").click()
        page.get_by_label("Oyun adı" if L == "tr" else "Play name").fill("Trips Right Mesh")
        page.get_by_role("button", name="Pas" if L == "tr" else "Pass", exact=True).click()
        page.get_by_role("button", name="Oyunu oluştur ve çiz" if L == "tr" else "Create and draw").click()
        page.wait_for_url("**/panel/playbook/pb*/play*")
        page.wait_for_timeout(900)
        shot("07-editor")
        if a.w < 640:
            # Phones: the secondary actions (info, lock, field options, flip, redo) sit in a menu.
            page.get_by_role("button", name="Diğer" if L == "tr" else "More").click()
            page.wait_for_timeout(250)
            shot("07m-phone-menu")
            checks.append(("phone menu offers flip", page.get_by_role("menuitem", name="Oyunu çevir (sol ↔ sağ)" if L == "tr" else "Flip the play (left ↔ right)").count() == 1))
            page.get_by_role("button", name="Diğer" if L == "tr" else "More").click()

        # Backfield settings on the starting formation: "less" leans the team on the bottom edge.
        for name_tr, name_en, tag in (("Az", "Less", "a-less"), ("Çok", "More", "c-more"), ("Standart", "Standard", "b-standard")):
            open_field_options()
            page.get_by_role("button", name=name_tr if L == "tr" else name_en, exact=True).click()
            page.get_by_role("button", name="Bitti" if L == "tr" else "Done").last.click()
            page.wait_for_timeout(300)
            shot(f"07{tag}")
            if tag == "a-less":
                # The quarterback sits on the bottom edge: selecting him docks the toolbar at the top.
                qx, qy = player_point(page, "Q" if a.sport == "flag" else "QB")
                page.mouse.click(qx, qy)
                page.wait_for_timeout(250)
                shot("07d-less-q-selected")
                # Wherever the quarterback stands, the toolbar never covers him.
                tb = page.locator("[role=toolbar]").last.bounding_box()
                qb = page.locator("svg.play-canvas g[data-player-id]", has=page.locator(f"text:text-is('{'Q' if a.sport == 'flag' else 'QB'}')")).first.bounding_box()
                overlap = not (tb["y"] + tb["height"] <= qb["y"] or qb["y"] + qb["height"] <= tb["y"] or tb["x"] + tb["width"] <= qb["x"] or qb["x"] + qb["width"] <= tb["x"])
                checks.append(("toolbar never covers the selected low player", not overlap))
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)

        # Draw: select X, tap three corners
        label = "X"
        px, py = player_point(page, label)
        page.mouse.click(px, py)
        page.wait_for_timeout(250)
        shot("08-selected")

        # The tools live beside the field (under it on phones), never on top of it.
        rail = page.locator("[role=toolbar]").first.bounding_box()
        canvas = page.locator("svg.play-canvas").bounding_box()
        apart = rail["x"] + rail["width"] <= canvas["x"] + 1 or rail["y"] >= canvas["y"] + canvas["height"] - 1
        checks.append(("tool rail sits outside the field", apart))
        start = page.evaluate("""() => { const svg=document.querySelector('svg.play-canvas'); return true }""")
        # Aim inside the visible depth, whatever the screen: `top` is the deepest yard on screen.
        top = page.evaluate("() => -document.querySelector('svg.play-canvas').viewBox.baseVal.y") - 1
        low, mid, high = min(6, top * 0.5), top * 0.75, top * 0.9
        for (x, y) in [(3.9, low), (12, low), (16, mid)]:
            sx, sy = field_point(page, x, y)
            page.mouse.click(sx, sy)
            page.wait_for_timeout(120)
        shot("09-route-drawn")
        # Press-and-drag adds a segment on release
        sx, sy = field_point(page, 16, mid)
        ex, ey = field_point(page, 22, high)
        page.mouse.move(ex - 40, ey + 30)
        page.mouse.down()
        page.mouse.move(ex, ey, steps=6)
        shot("10-dragging-segment")
        page.mouse.up()
        page.wait_for_timeout(200)
        checks.append(("four segments drawn", page.locator("svg.play-canvas [data-handle]").count() == 4))

        # Shift keeps a segment dead straight: aim a little off horizontal, get exactly horizontal.
        hx, hy = field_point(page, 26, high + 0.4)
        page.keyboard.down("Shift")
        page.mouse.click(hx, hy)
        page.keyboard.up("Shift")
        page.wait_for_timeout(500)
        a_pt, b_pt = first_play_player(page, "X")["route"]["points"][-2:]
        checks.append(("shift draws a dead-straight segment", abs(a_pt["y"] - b_pt["y"]) < 0.02))
        page.get_by_role("button", name="Son segmenti sil" if L == "tr" else "Remove last segment").click()
        page.wait_for_timeout(150)

        # Styles
        page.get_by_role("button", name="Köşeler: keskin" if L == "tr" else "Corners: sharp").click()
        page.get_by_role("button", name="Rota sonu: ok" if L == "tr" else "Route end: arrow").click()
        page.wait_for_timeout(200)
        shot("11-rounded-block-end")
        page.get_by_role("button", name="Son segmenti sil" if L == "tr" else "Remove last segment").click()
        page.wait_for_timeout(150)
        checks.append(("red button removes one segment", page.locator("svg.play-canvas [data-handle]").count() == 3))
        page.get_by_role("button", name="Zigzag (motion)").click()
        page.wait_for_timeout(200)
        shot("12-zigzag")

        # Template on Y
        page.get_by_role("button", name="Bitti" if L == "tr" else "Done").click()
        yx, yy = player_point(page, "Y" if a.sport == "flag" else "TE")
        page.mouse.click(yx, yy)
        page.get_by_role("button", name="Rota şablonu" if L == "tr" else "Route template", exact=True).click()
        page.wait_for_timeout(200)
        shot("13-template-panel")
        page.get_by_role("button", name="7: Corner").click()
        page.wait_for_timeout(200)
        page.get_by_role("button", name="Yıldız" if L == "tr" else "Star").click()
        page.get_by_role("button", name="Bitti" if L == "tr" else "Done").click()
        page.wait_for_timeout(200)
        shot("14-template-applied")

        # Break direction: the centre has no near sideline, so the coach picks it
        cx0, cy0 = player_point(page, "C")
        page.mouse.click(cx0, cy0)
        page.get_by_role("button", name="Rota şablonu" if L == "tr" else "Route template", exact=True).click()
        page.get_by_role("button", name="3: Out").click()
        page.get_by_role("button", name="Sol" if L == "tr" else "Left", exact=True).click()
        page.wait_for_timeout(500)
        shot("14b-center-out-left")
        def c_break():
            c = first_play_player(page, "C")
            return c["route"]["points"][-1]["x"] - c["x"]
        went_left = c_break() < 0
        page.get_by_role("button", name="Sağ" if L == "tr" else "Right", exact=True).click()
        page.wait_for_timeout(500)
        shot("14c-center-out-right")
        checks.append(("centre out route follows the chosen side", went_left and c_break() > 0))
        page.get_by_role("button", name="Bitti" if L == "tr" else "Done").click()

        # Field options: show opponent
        open_field_options()
        page.get_by_role("button", name="Göster" if L == "tr" else "Show", exact=True).click()
        page.get_by_role("button", name="+5 (koşu yasağı)" if L == "tr" else "+5 (no run)").click() if a.sport == "flag" else page.get_by_role("button", name="+5").click()
        shot("15-field-options")
        page.get_by_role("button", name="Bitti" if L == "tr" else "Done").last.click()
        page.wait_for_timeout(300)
        shot("16-opponent-endzone")

        # Playback
        page.get_by_role("button", name="Oynat" if L == "tr" else "Play", exact=True).first.click()
        page.wait_for_timeout(1300)
        shot("17-playback-mid")
        page.wait_for_timeout(3500)
        shot("18-playback-end")
        page.get_by_role("toolbar", name="Oynatma" if L == "tr" else "Playback").get_by_role("button", name="Bitti" if L == "tr" else "Done").click()
        page.wait_for_timeout(400)

        # Back to playbook: card thumbnail + persisted route
        page.get_by_role("link", name="Playbook'a dön" if L == "tr" else "Back to the playbook").click()
        page.wait_for_url("**/panel/playbook/pb*")
        page.wait_for_timeout(800)
        shot("19-playbook-with-play")
        stored = len(first_play_player(page, "X")["route"]["points"])
        checks.append(("route saved to the server", stored == 3))

        # Defensive play with a zone
        page.get_by_role("button", name="Savunma" if L == "tr" else "Defense", exact=True).click()
        page.get_by_role("button", name="Yeni savunma oyunu" if L == "tr" else "New defensive play").click()
        page.get_by_label("Oyun adı" if L == "tr" else "Play name").fill("Cover 3")
        page.get_by_role("button", name="Oyunu oluştur ve çiz" if L == "tr" else "Create and draw").click()
        page.wait_for_url("**/panel/playbook/pb*/play*")
        page.wait_for_timeout(900)
        cx, cy = player_point(page, "LB" if a.sport == "flag" else "M")
        page.mouse.click(cx, cy)
        tx, ty = field_point(page, 15 if a.sport == "flag" else 26.7, -9)
        page.mouse.click(tx, ty)
        page.get_by_role("button", name="Zone", exact=True).click()
        page.wait_for_timeout(250)
        shot("20-defense-zone")
        checks.append(("zone drawn", page.locator("svg.play-canvas circle[r='4']").count() == 1))

        # Defense with the goal behind us, the offense shown, on the light field.
        page.keyboard.press("Escape")
        open_field_options()
        page.get_by_role("button", name="Göster" if L == "tr" else "Show", exact=True).click()
        page.get_by_role("button", name="Açık" if L == "tr" else "Light", exact=True).click()
        page.get_by_role("button", name="+5 (koşu yasağı)" if L == "tr" else "+5 (no run)").click() if a.sport == "flag" else page.get_by_role("button", name="+5").click()
        page.get_by_role("button", name="Bitti" if L == "tr" else "Done").last.click()
        page.wait_for_timeout(400)
        shot("22-defense-light-goal-behind")
        # The end zone text sits below the line of scrimmage (behind the defense).
        ez = page.evaluate("() => { const t=[...document.querySelectorAll('svg.play-canvas text')].find(t=>t.textContent==='END ZONE'); return t ? parseFloat(t.getAttribute('y')) : null }")
        checks.append(("defense end zone is behind the defense", ez is not None and ez > 0))

        if a.sport == "af":
            # Every defensive front lines up eleven players; the Mike keeps his zone across fronts.
            page.keyboard.press("Escape")
            for front in ("3-4", "4-2-5 (Nickel)" if L == "en" else "4-2-5 (Nikel)", "3-3-5 (Stack)", "5-2 (Okie)", "4-3"):
                open_field_options()
                page.get_by_role("button", name=front, exact=True).click()
                page.get_by_role("button", name="Done" if L == "en" else "Bitti").last.click()
                page.wait_for_timeout(300)
                shot("21-front-" + front.split(" ")[0])
                checks.append((f"front {front} has eleven players", page.locator("svg.play-canvas g[data-player-id]").count() == 11))
            checks.append(("mike keeps his zone across fronts", page.locator("svg.play-canvas circle[r='4']").count() == 1))

        if a.sport == "af" and a.special:
            units = ["Kickoff", "Kickoff return", "Punt", "Punt return", "Field goal / PAT", "Field goal block"] if L == "en" else ["Kickoff", "Kickoff dönüşü", "Punt", "Punt dönüşü", "Field goal / PAT", "Field goal blok"]
            for i, unit in enumerate(units):
                page.get_by_role("link", name="Back to the playbook" if L == "en" else "Playbook'a dön").click()
                page.wait_for_url("**/panel/playbook/pb*")
                page.get_by_role("button", name="Special teams" if L == "en" else "Özel takımlar", exact=True).click()
                page.get_by_role("button", name="New special teams play" if L == "en" else "Yeni özel takım oyunu").click()
                page.get_by_label("Play name" if L == "en" else "Oyun adı").fill(unit)
                page.get_by_role("button", name=unit, exact=True).first.click()
                page.get_by_role("button", name="Create and draw" if L == "en" else "Oyunu oluştur ve çiz").click()
                page.wait_for_url("**/panel/playbook/pb*/play*")
                page.wait_for_timeout(700)
                shot(f"30-special-{i}")
                own = page.locator("svg.play-canvas g[data-player-id]").count()
                checks.append((f"{unit}: eleven of ours on the field", own == 11))
            page.get_by_role("link", name="Back to the playbook" if L == "en" else "Playbook'a dön").click()
            page.wait_for_url("**/panel/playbook/pb*")
            page.get_by_role("button", name="Special teams" if L == "en" else "Özel takımlar", exact=True).click()
            page.wait_for_timeout(600)
            shot("31-special-list")

        browser.close()

    for name, ok in checks:
        print(("PASS" if ok else "FAIL"), name)
    for e in errors:
        print(e)
    failed = [c for c in checks if not c[1]]
    print(f"{len(checks) - len(failed)}/{len(checks)} checks, {len(errors)} errors")
    return 1 if failed or errors else 0


if __name__ == "__main__":
    sys.exit(main())
