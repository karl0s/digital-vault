"""The site's icons, drawn from the wordmark's own V (owner's pick, 2026-11-06).

The V is Archivo 700's outline (public/fonts/archivo-700-latin.woff2) with the halation filter
components/logos/HalationLogo.tsx gives that letter (letter 4 of "THE VAULT", t = -1/7), on the
page's #141414. The owner chose it on a preview page: V 84% of the square's height, the glow at 2x
(the site's own glow is under a pixel wide at tab size), slightly rounded corners, no header light.

Writes:
  public/favicon.svg          what browsers use (Chrome, Firefox, Edge, Safari 26+)
  public/favicon.ico          16, 32 and 48 px, for browsers without SVG icons
  public/apple-touch-icon.png 180 px, square corners (iOS rounds them itself)

    python3 tools/favicon/build.py

Needs Pillow and Playwright's headless Chromium (~/Library/Caches/ms-playwright), which renders the
SVG for the PNG and ICO files exactly as a browser does.
"""
import io
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"

# The V of Archivo 700 in font units (1000 per em; bounds x 12..683, y 0..686), from the site's woff2.
V_PATH = ("M260 0 12 686H173L321 248Q325 237 330.0 221.5Q335 206 340.0 191.0Q345 176 348 164H354Q358 175 362.5 189.5"
          "Q367 204 371.5 219.0Q376 234 380 247L528 686H683L434 0Z")
X0, X1, H, K = 12, 683, 686, 0.13          # K: the wordmark's font size 130, per font unit

# The wordmark's filter for the V, in its own units (HalationLogo's D, at t = -1/7).
T, A = -1 / 7, 1 / 7
PURPLE_BLUR, PURPLE_DY = 3 + A * 15, -T * 45
CYAN_BLUR, CYAN_DY = A * 17, -T * 9
IRRAD, IRR_DX, IRR_DY, IRR_OP = 4 + A * 8, T * 19, -T * 19, 0.38
SMEAR, SMEAR_DY, H_BLUR = A * 7, -T * 7, A * 9.5
GLOBAL_BLUR = 1.48                          # the wordmark's 1px CSS blur, at its desktop width

PICK = dict(size=0.84, glow=2.0, corner=0.125)


def svg(size=PICK["size"], glow=PICK["glow"], corner=PICK["corner"]):
    f = lambda n: f"{n:.3f}".rstrip("0").rstrip(".")
    vh = H * K
    side = vh / size
    ox = side / 2 - (X0 + (X1 - X0) / 2) * K
    base = side / 2 + vh / 2 - side * 0.015     # lifted a hair: the purple sits under the V
    g = glow
    s = f(side)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}">'
        f'<defs><clipPath id="c"><rect width="{s}" height="{s}" rx="{f(corner * side)}"/></clipPath>'
        '<filter id="h" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">'
        '<feFlood flood-color="#9333ea"/><feComposite in2="SourceAlpha" operator="in"/>'
        f'<feGaussianBlur stdDeviation="{f(PURPLE_BLUR * g)}"/><feOffset dy="{f(PURPLE_DY * g)}" result="pb"/>'
        '<feFlood flood-color="#06b6d4"/><feComposite in2="SourceAlpha" operator="in"/>'
        f'<feGaussianBlur stdDeviation="{f(CYAN_BLUR * g)}"/><feOffset dy="{f(CYAN_DY * g)}" result="cb"/>'
        f'<feGaussianBlur in="SourceAlpha" stdDeviation="{f(IRRAD * g)}"/>'
        f'<feOffset dx="{f(IRR_DX * g)}" dy="{f(IRR_DY * g)}" result="ia"/>'
        '<feFlood flood-color="#fff" result="wf"/><feComposite in2="ia" operator="in"/>'
        f'<feComponentTransfer result="ir"><feFuncA type="linear" slope="{IRR_OP}"/></feComponentTransfer>'
        f'<feGaussianBlur in="SourceAlpha" stdDeviation="{f(SMEAR * 0.4)} {f(SMEAR)}"/><feOffset dy="{f(SMEAR_DY)}"/>'
        '<feComposite in="wf" operator="in" result="vs"/>'
        f'<feGaussianBlur in="SourceAlpha" stdDeviation="{f(H_BLUR)} {f(H_BLUR * 0.6)}"/>'
        '<feComposite in="wf" operator="in" result="hs"/>'
        '<feBlend in="pb" in2="cb" mode="screen"/><feBlend in2="ir" mode="screen"/>'
        '<feBlend in2="vs" mode="screen"/><feBlend in2="hs" mode="screen"/><feBlend in2="SourceGraphic" mode="screen"/>'
        '</filter>'
        f'<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{f(GLOBAL_BLUR)}"/></filter>'
        '</defs>'
        f'<g clip-path="url(#c)"><rect width="{s}" height="{s}" fill="#141414"/>'
        f'<g filter="url(#s)"><g filter="url(#h)">'
        f'<path fill="#fff" transform="translate({f(ox)} {f(base)}) scale({K} -{K})" d="{V_PATH}"/>'
        '</g></g></g></svg>\n'
    )


def chromium():
    pw = Path.home() / "Library/Caches/ms-playwright"
    shells = sorted(pw.glob("chromium_headless_shell-*/*/chrome-headless-shell"))
    if not shells:
        raise SystemExit("No headless Chromium: run `npx playwright install chromium`.")
    return str(shells[-1])


def render(svg_text, px=1024):
    """The SVG as a browser draws it, px square, transparent outside the shape."""
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "icon.svg").write_text(svg_text)
        (Path(d) / "page.html").write_text(
            f'<!doctype html><html><body style="margin:0;background:transparent">'
            f'<img src="icon.svg" width="{px}" height="{px}" style="display:block"></body></html>')
        shot = Path(d) / "shot.png"
        subprocess.run([chromium(), "--headless", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={px},{px}",
                        "--default-background-color=00000000", "--virtual-time-budget=2000",
                        f"--screenshot={shot}", f"file://{d}/page.html"],
                       check=True, capture_output=True)
        return Image.open(io.BytesIO(shot.read_bytes())).convert("RGBA")


def main():
    rounded = svg()
    (PUBLIC / "favicon.svg").write_text(rounded)
    big = render(rounded)
    big.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    render(svg(corner=0)).resize((180, 180), Image.LANCZOS).convert("RGB").save(
        PUBLIC / "apple-touch-icon.png", optimize=True)
    for name in ("favicon.svg", "favicon.ico", "apple-touch-icon.png"):
        print(f"public/{name}", (PUBLIC / name).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
