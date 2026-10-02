"""Screenshots a section at several scroll offsets past its top, in viewport heights.

Usage:
  python scripts/verify/section.py URL SECTION_ID OUT_STEM --steps 0,0.5,1,1.5 [--w 1440] [--h 900]
                                   [--reduce] [--mobile] [--click SELECTOR]

Scrolls in small increments (like a reader) so pinned, scrubbed timelines settle.
"""
import argparse

from playwright.sync_api import sync_playwright


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("section")
    p.add_argument("out")
    p.add_argument("--steps", default="0")
    p.add_argument("--w", type=int, default=1440)
    p.add_argument("--h", type=int, default=900)
    p.add_argument("--reduce", action="store_true")
    p.add_argument("--mobile", action="store_true")
    p.add_argument("--click", default="")
    a = p.parse_args()

    issues: list[str] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": a.w, "height": a.h},
            reduced_motion="reduce" if a.reduce else "no-preference",
            has_touch=a.mobile,
            is_mobile=a.mobile,
        )
        page = ctx.new_page()
        page.on("console", lambda m: issues.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: issues.append(f"pageerror: {e}"))
        page.goto(a.url, wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(1500)

        top = page.evaluate(
            f"""() => {{
              const el = document.getElementById({a.section!r});
              const spacer = el.closest('.pin-spacer') || el;
              return el.getBoundingClientRect().top + window.scrollY;
            }}"""
        )
        current = 0
        for step in [float(s) for s in a.steps.split(",")]:
            target = int(top + step * a.h)
            while abs(current - target) > 0:
                delta = max(-300, min(300, target - current))
                current += delta
                page.evaluate(f"window.scrollTo(0, {current})")
                page.wait_for_timeout(60)
            page.wait_for_timeout(1300)
            if a.click:
                page.click(a.click)
                page.wait_for_timeout(2200)
            page.screenshot(path=f"{a.out}-{str(step).replace('.', '_')}.png")
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        if overflow > 0:
            issues.append(f"horizontal overflow: {overflow}px")
        browser.close()

    for line in issues:
        print(line)
    print(f"done ({len(issues)} issues)")


if __name__ == "__main__":
    main()
