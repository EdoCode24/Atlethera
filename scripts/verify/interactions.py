"""End-to-end checks for the landing page. Usage: python scripts/verify/interactions.py [BASE_URL]"""
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))


def http_checks() -> None:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = urllib.request.build_opener(NoRedirect)

    def status(path: str, headers: dict[str, str] | None = None):
        req = urllib.request.Request(BASE + path, headers=headers or {})
        try:
            r = opener.open(req)
            return r.status, r.headers.get("location")
        except urllib.error.HTTPError as e:
            return e.code, e.headers.get("location")

    code, loc = status("/")
    check("/ redirects to /tr by default", code == 307 and (loc or "").endswith("/tr"), f"{code} {loc}")
    code, loc = status("/", {"Accept-Language": "en-US,en;q=0.9"})
    check("/ honours Accept-Language: en", code == 307 and (loc or "").endswith("/en"), f"{code} {loc}")
    code, loc = status("/", {"Accept-Language": "en", "Cookie": "NEXT_LOCALE=tr"})
    check("NEXT_LOCALE cookie wins over the header", code == 307 and (loc or "").endswith("/tr"), f"{code} {loc}")
    code, _ = status("/tr/does-not-exist")
    check("unknown page returns 404", code == 404, str(code))
    for path in ("/sitemap.xml", "/robots.txt", "/icon.png", "/apple-icon.png"):
        code, _ = status(path)
        check(f"{path} is served", code == 200, str(code))


def browser_checks() -> None:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        errors: list[str] = []

        # Desktop, motion on.
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/tr", wait_until="networkidle")
        page.wait_for_timeout(2500)

        lang = page.evaluate("document.documentElement.lang")
        check("html lang is tr", lang == "tr", lang)
        hreflang = page.evaluate("[...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l=>l.hreflang).sort().join(',')")
        check("hreflang alternates present", hreflang == "en,tr,x-default", hreflang)
        og = page.evaluate("document.querySelector('meta[property=\"og:image\"]')?.content || ''")
        check("og:image present", "opengraph-image" in og, og)
        check("single h1", page.locator("h1").count() == 1, str(page.locator("h1").count()))

        # Hero sport switch opens the other sport's playbook.
        page.get_by_role("button", name="Flag Football").first.click()
        page.wait_for_timeout(1200)
        title = page.locator("#top .display", has_text="Mesh").first.inner_text()
        check("hero switch shows the flag play", "MOTION MESH" in title.upper(), title)
        players = page.evaluate("document.querySelectorAll('#top svg g[data-player-id]').length")
        check("hero preview draws a 5v5 flag offense", players == 5, str(players))
        announce = page.locator("#top [aria-live=polite]").first.inner_text()
        check("hero switch is announced", "Flag Football" in announce, announce)
        page.get_by_role("button", name="American Football").first.click()
        page.wait_for_timeout(900)
        players = page.evaluate("document.querySelectorAll('#top svg g[data-player-id]').length")
        check("hero preview draws an 11-man offense", players == 11, str(players))

        # Header link lands on pricing.
        page.get_by_role("navigation", name="Ana menü").first.get_by_role("link", name="Fiyatlar").click()
        page.wait_for_timeout(2500)
        top = page.evaluate("document.getElementById('pricing').getBoundingClientRect().top")
        check("header link scrolls to pricing", -40 < top < 200, f"top={top:.0f}")

        # Nutrition calculator.
        page.evaluate("document.getElementById('nutrition').scrollIntoView()")
        page.wait_for_timeout(1500)
        form = page.get_by_role("form", name="Beslenme hesaplayıcı")
        live = form.locator("[aria-live=polite]").inner_text()
        check("calculator default target is 3.240 kcal", "3.240" in live, live)
        form.get_by_label("Kilo").fill("90")
        page.wait_for_timeout(900)
        live2 = form.locator("[aria-live=polite]").inner_text()
        check("calculator updates when weight changes", live2 != live and "kcal" in live2, live2)
        form.get_by_label("Yaş").fill("12")
        page.wait_for_timeout(300)
        err = form.get_by_text("Yaş 15 ile 80 arasında olmalı.").count()
        check("calculator explains an out-of-range age", err == 1, str(err))

        # FAQ opens from the keyboard.
        summary = page.locator("#faq summary").first
        summary.focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(600)
        opened = page.evaluate("document.querySelector('#faq details').open")
        check("FAQ opens with Enter", opened is True, str(opened))

        pins = page.evaluate("document.querySelectorAll('.pin-spacer').length")
        check("pinned sections exist with motion on", pins >= 3, str(pins))
        lenis = page.evaluate("document.documentElement.classList.contains('lenis')")
        check("smooth scroll active with motion on", lenis, str(lenis))

        # Language switch keeps the section.
        href = page.locator("header a[hreflang=en]").get_attribute("href")
        check("language link points to /en", (href or "").startswith("/en"), href or "")
        page.close()

        # English calculator formatting.
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(BASE + "/en#nutrition", wait_until="networkidle")
        page.wait_for_timeout(3000)
        live = page.get_by_role("form", name="Nutrition calculator").locator("[aria-live=polite]").inner_text()
        check("English calculator shows 3,240 kcal", "3,240" in live, live)
        top = page.evaluate("document.getElementById('nutrition').getBoundingClientRect().top")
        check("hash URL lands on its section", -40 < top < 200, f"top={top:.0f}")
        page.close()

        # Reduced motion: no pins, no smooth scroll, nothing left invisible.
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce", is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/tr", wait_until="networkidle")
        page.wait_for_timeout(2500)
        check("reduced motion: no pinned sections", page.evaluate("document.querySelectorAll('.pin-spacer').length") == 0)
        check("reduced motion: no smooth scroll", not page.evaluate("document.documentElement.classList.contains('lenis')"))
        hidden = page.evaluate(
            "[...document.querySelectorAll('main h2, main h3, main p')].filter(e=>!e.closest('[data-panel=\"flag-football\"]')).filter(e=>{const s=getComputedStyle(e);return s.visibility==='hidden'||+s.opacity<0.05}).length"
        )
        check("reduced motion: no text left invisible (besides the unselected module)", hidden == 0, str(hidden))
        page.evaluate("document.getElementById('modules').scrollIntoView()")
        page.get_by_role("group", name="Branş seç").get_by_role("button", name="Flag Football").click()
        page.wait_for_timeout(600)
        flag_visible = page.evaluate("getComputedStyle(document.querySelector('[data-panel=\"flag-football\"]')).visibility")
        check("reduced motion: module tab shows the flag panel", flag_visible == "visible", flag_visible)
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("mobile: no horizontal overflow", overflow <= 0, str(overflow))
        ctx.close()

        check("no console errors", not errors, " | ".join(errors[:5]))
        browser.close()


http_checks()
browser_checks()
failed = [r for r in results if not r[1]]
for name, ok, detail in results:
    print(("PASS" if ok else "FAIL"), name, ("— " + detail) if detail and not ok else "")
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
