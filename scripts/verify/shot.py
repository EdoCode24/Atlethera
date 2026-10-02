"""Screenshot helper for visual review.

Usage:
  python scripts/verify/shot.py URL OUT.png [--w 1440] [--h 900] [--reduce] [--full]
                                [--scroll Y[,Y...]] [--wait MS] [--click SELECTOR]

With --scroll, one screenshot per position is written as OUT-<y>.png. Console errors and
page errors are printed so a visual pass also catches runtime failures.
"""
import argparse
import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("out")
    p.add_argument("--w", type=int, default=1440)
    p.add_argument("--h", type=int, default=900)
    p.add_argument("--reduce", action="store_true")
    p.add_argument("--full", action="store_true")
    p.add_argument("--scroll", default="")
    p.add_argument("--wait", type=int, default=1800)
    p.add_argument("--click", default="")
    p.add_argument("--mobile", action="store_true")
    a = p.parse_args()

    errors: list[str] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": a.w, "height": a.h},
            device_scale_factor=1,
            reduced_motion="reduce" if a.reduce else "no-preference",
            has_touch=a.mobile,
            is_mobile=a.mobile,
        )
        page = ctx.new_page()
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.goto(a.url, wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(a.wait)
        if a.click:
            page.click(a.click)
            page.wait_for_timeout(1200)

        if a.scroll:
            stem = a.out[:-4] if a.out.endswith(".png") else a.out
            for y in [int(v) for v in a.scroll.split(",")]:
                page.evaluate(f"window.scrollTo(0, {y})")
                page.wait_for_timeout(1400)
                page.screenshot(path=f"{stem}-{y}.png")
        else:
            page.screenshot(path=a.out, full_page=a.full)

        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        if overflow > 0:
            errors.append(f"horizontal overflow: {overflow}px")
        browser.close()

    for line in errors:
        print(line)
    print(f"done ({len(errors)} issues)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
