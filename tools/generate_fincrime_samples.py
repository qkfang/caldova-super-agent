#!/usr/bin/env python3
"""
Generator for the Financial Crime "Try it out" sample documents
(Wealth Team in a Day — Caldova Wealth).

Produces visibly fictional PNG documents stamped "SPECIMEN — DEMO ONLY" and the
manifest.json the backend serves from ``src/backend/wwwroot/fincrime/samples/``:

* Victoria-style driver licences (Grace Williams — copy on file and a tampered
  copy supplied with the rollover request; Priya Natarajan; George
  Papadopoulos; Lily Chen)
* Australia-style passport bio pages (Robert Chen — genuine certified copy;
  Priya Natarajan — photo-swap specimen with inconsistent MRZ check digits)
* Bank statements (G Williams Holdings Pty Ltd — the account nominated for the
  SMSF rollover; Thomas Bradley — Tom's hardship payment account)
* An SMSF registration extract (GW Family Superannuation Fund)
* A certified death certificate (Mei Chen)
* A confirmation-of-income-support letter (Tom Bradley)

Every person, number, bank, fund and layout is fictional. Layouts are inspired
by Australian documents but deliberately do not reproduce any real government
design, crest or security feature.

Run (requires Pillow — ``pip install pillow``):

    python tools/generate_fincrime_samples.py

The output is committed to the repo — the web app never invokes this script.
"""
from __future__ import annotations

import json
import math
from datetime import date
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "backend" / "wwwroot" / "fincrime" / "samples"
SRC_PREFIX = "/fincrime/samples/"
SPECIMEN = "SPECIMEN — DEMO ONLY"

# ───────────────────────── Fonts (Windows, Linux, macOS) ─────────────────────────
_FONT_CANDIDATES: dict[tuple[str, bool], list[str]] = {
    ("sans", False): [
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ],
    ("sans", True): [
        "C:/Windows/Fonts/arialbd.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ],
    ("mono", False): [
        "C:/Windows/Fonts/consola.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
    ],
    ("mono", True): [
        "C:/Windows/Fonts/consolab.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
    ],
    # Deliberately "wrong" typeface used to re-type a field on tampered documents.
    ("courier", True): [
        "C:/Windows/Fonts/courbd.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
    ],
    ("serif", False): [
        "C:/Windows/Fonts/georgia.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
    ],
    ("serif", True): [
        "C:/Windows/Fonts/georgiab.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    ],
    ("script", False): [
        "C:/Windows/Fonts/segoesc.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
    ],
}


@lru_cache(maxsize=None)
def font(size: int, kind: str = "sans", bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in _FONT_CANDIDATES.get((kind, bold), []) + _FONT_CANDIDATES[("sans", bold)]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


# ───────────────────────── Drawing helpers ─────────────────────────
INK = (17, 24, 39)
MUTED = (100, 116, 139)
RED = (190, 24, 24)


def text_width(d: ImageDraw.ImageDraw, text: str, f) -> int:
    box = d.textbbox((0, 0), text, font=f)
    return box[2] - box[0]


def scan_bed(w: int, h: int) -> Image.Image:
    """Neutral 'scanner bed' background the document sits on."""
    return Image.new("RGBA", (w, h), (218, 223, 229, 255))


def guilloche(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], colour, *, rows: int = 10,
              amp: float = 7.0, period: float = 70.0, width: int = 1, phase: float = 0.0) -> None:
    x0, y0, x1, y1 = box
    for i in range(rows):
        base = y0 + (y1 - y0) * (i + 0.5) / rows
        pts = [(x, base + amp * math.sin((x - x0) / period * 2 * math.pi + i * 0.9 + phase))
               for x in range(x0, x1 + 1, 3)]
        d.line(pts, fill=colour, width=width)


def hologram(img: Image.Image, box: tuple[int, int, int, int], alpha: int = 120) -> None:
    """Rainbow 'hologram' band composited over part of the card."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    band = Image.new("RGBA", (w, h))
    px = band.load()
    for x in range(w):
        for y in range(h):
            t = (x + y * 0.7) / max(w * 0.45, 1)
            r = int(150 + 100 * math.sin(t * 2 * math.pi))
            g = int(150 + 100 * math.sin(t * 2 * math.pi + 2.1))
            b = int(150 + 100 * math.sin(t * 2 * math.pi + 4.2))
            px[x, y] = (r, g, b, alpha)
    bd = ImageDraw.Draw(band)
    for k in range(-h, w, 14):
        bd.line((k, h, k + h, 0), fill=(255, 255, 255, 90), width=2)
    bd.rounded_rectangle((0, 0, w - 1, h - 1), radius=10, outline=(255, 255, 255, 160), width=2)
    img.alpha_composite(band, (x0, y0))


def portrait(size: tuple[int, int], bg, fg, *, hair: str = "short", hair_colour=None) -> Image.Image:
    """Simple stylised head-and-shoulders silhouette (no real likeness)."""
    w, h = size
    im = Image.new("RGBA", (w, h), bg)
    d = ImageDraw.Draw(im)
    cx = w / 2
    hc = hair_colour or fg
    if hair == "long":
        d.ellipse((cx - w * 0.27, h * 0.12, cx + w * 0.27, h * 0.78), fill=hc)
    elif hair == "short":
        d.ellipse((cx - w * 0.21, h * 0.14, cx + w * 0.21, h * 0.50), fill=hc)
    elif hair == "bun":
        d.ellipse((cx - w * 0.09, h * 0.07, cx + w * 0.09, h * 0.22), fill=hc)
        d.ellipse((cx - w * 0.21, h * 0.15, cx + w * 0.21, h * 0.48), fill=hc)
    d.ellipse((cx - w * 0.45, h * 0.64, cx + w * 0.45, h * 1.35), fill=fg)
    d.rectangle((cx - w * 0.09, h * 0.48, cx + w * 0.09, h * 0.70), fill=fg)
    d.ellipse((cx - w * 0.19, h * 0.19, cx + w * 0.19, h * 0.58), fill=fg)
    return im


def rotated_stamp(lines: list[str], colour, *, angle: float = -8, size: int = 18, pad: int = 14) -> Image.Image:
    """Rubber-stamp style box (e.g. a JP certification) returned as an RGBA image."""
    f = font(size, "sans", True)
    tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    widths = [text_width(tmp, ln, f) for ln in lines]
    line_h = size + 8
    w = max(widths) + pad * 2
    h = line_h * len(lines) + pad * 2 - 6
    st = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(st)
    d.rounded_rectangle((2, 2, w - 3, h - 3), radius=8, outline=colour + (200,), width=3)
    for i, ln in enumerate(lines):
        d.text((pad + (max(widths) - widths[i]) / 2, pad + i * line_h - 2), ln, font=f, fill=colour + (210,))
    return st.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)


def specimen(img: Image.Image, *, opacity: int = 72) -> Image.Image:
    """Diagonal 'SPECIMEN — DEMO ONLY' watermark plus a corner tag."""
    w, h = img.size
    f = font(int(min(w, h) * 0.085), "sans", True)
    tmp = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bbox = tmp.textbbox((0, 0), SPECIMEN, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    timg = Image.new("RGBA", (tw + 40, th + 40), (0, 0, 0, 0))
    ImageDraw.Draw(timg).text((20 - bbox[0], 20 - bbox[1]), SPECIMEN, font=f, fill=RED + (opacity,))
    rot = timg.rotate(math.degrees(math.atan2(h, w)) * 0.75, expand=True, resample=Image.Resampling.BICUBIC)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    overlay.paste(rot, ((w - rot.width) // 2, (h - rot.height) // 2), rot)
    out = Image.alpha_composite(img, overlay)

    d = ImageDraw.Draw(out)
    tag_font = font(15, "sans", True)
    tag_w = text_width(d, SPECIMEN, tag_font) + 20
    d.rounded_rectangle((w - tag_w - 14, h - 40, w - 14, h - 12), radius=6, fill=(254, 226, 226, 255),
                        outline=RED + (255,), width=2)
    d.text((w - tag_w - 4, h - 35), SPECIMEN, font=tag_font, fill=RED + (255,))
    return out


def save(img: Image.Image, name: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(OUT_DIR / name, "PNG", optimize=True)


def dmy(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def dmy_long(d: date) -> str:
    return f"{d.day} {d.strftime('%B %Y')}"


def dmy_mrz(d: date) -> str:
    return d.strftime("%d %b %Y").upper()


# ───────────────────────── MRZ (ICAO 9303, TD3) ─────────────────────────
def mrz_check_digit(field: str) -> str:
    weights = (7, 3, 1)
    total = 0
    for i, ch in enumerate(field):
        if ch.isdigit():
            v = int(ch)
        elif ch.isalpha():
            v = ord(ch.upper()) - 55
        else:
            v = 0
        total += v * weights[i % 3]
    return str(total % 10)


def td3_mrz(*, surname: str, given: str, number: str, nationality: str, dob: date, sex: str,
            expiry: date, issuing_state: str = "AUS") -> tuple[str, str]:
    name = f"{surname.upper()}<<{given.upper().replace(' ', '<')}"
    line1 = (f"P<{issuing_state}{name}" + "<" * 44)[:44]
    num = (number.upper() + "<" * 9)[:9]
    dob_s = dob.strftime("%y%m%d")
    exp_s = expiry.strftime("%y%m%d")
    personal = "<" * 14
    line2 = (num + mrz_check_digit(num) + nationality + dob_s + mrz_check_digit(dob_s) + sex
             + exp_s + mrz_check_digit(exp_s) + personal + "<")
    composite = line2[0:10] + line2[13:20] + line2[21:43]
    line2 += mrz_check_digit(composite)
    assert len(line1) == 44 and len(line2) == 44
    return line1, line2


def corrupt_check_digits(line2: str) -> str:
    """Break the document-number and composite check digits (photo-swap specimen)."""
    chars = list(line2)
    chars[9] = str((int(chars[9]) + 3) % 10)
    chars[43] = str((int(chars[43]) + 5) % 10)
    return "".join(chars)


def certified_copy_canvas(w: int, h: int, certified: bool) -> Image.Image:
    """A certified copy is a photocopy on paper with the JP stamp beside the
    document, so certified documents get a white page with room for the stamp."""
    if not certified:
        return scan_bed(w, h)
    return Image.new("RGBA", (w, h + 150), (250, 250, 248, 255))


def jp_stamp(img: Image.Image, sighted: date, top: int) -> None:
    st = rotated_stamp(["CERTIFIED TRUE COPY OF THE ORIGINAL", "A. Nguyen JP (Vic) · Reg. 14422",
                        f"Sighted {dmy(sighted)}"], (29, 78, 216), size=16, angle=3)
    img.alpha_composite(st, (40, top + 8))


# ───────────────────────── Driver licence (Victoria-style) ─────────────────────────
def driver_licence(name: str, p: dict, *, tampered: bool = False) -> None:
    W, H = 980, 620
    img = certified_copy_canvas(W, H, bool(p.get("certified")))
    card = (22, 22, W - 22, H - 22)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(card, radius=26, fill=(243, 248, 246, 255), outline=(150, 170, 170, 255), width=2)
    guilloche(d, (40, 120, W - 40, H - 60), (186, 220, 214, 255), rows=14, amp=6, period=90)

    # Header band
    d.rounded_rectangle((22, 22, W - 22, 116), radius=26, fill=(13, 79, 95, 255))
    d.rectangle((22, 80, W - 22, 116), fill=(13, 79, 95, 255))
    d.text((50, 36), "VICTORIA · AUSTRALIA", font=font(17, "sans", True), fill=(186, 230, 253, 255))
    d.text((50, 60), "DRIVER LICENCE", font=font(38, "sans", True), fill=(255, 255, 255, 255))
    d.rounded_rectangle((W - 200, 48, W - 50, 88), radius=8, fill=(253, 230, 138, 255))
    d.text((W - 185, 56), "SPECIMEN", font=font(22, "sans", True), fill=(120, 53, 15, 255))

    # Photo
    photo_box = (52, 140, 292, 430)
    pw, ph = photo_box[2] - photo_box[0], photo_box[3] - photo_box[1]
    if tampered:
        # Cut-out photo: different backdrop, white halo, slightly shifted.
        ph_img = portrait((pw - 10, ph - 10), (214, 204, 188, 255), (88, 74, 66, 255), hair="short")
        d.rectangle(photo_box, fill=(255, 255, 255, 255))
        img.alpha_composite(ph_img, (photo_box[0] + 9, photo_box[1] + 3))
    else:
        ph_img = portrait((pw, ph), (205, 222, 230, 255), (71, 85, 105, 255), hair=p.get("hair", "short"),
                          hair_colour=p.get("hair_colour"))
        img.alpha_composite(ph_img, (photo_box[0], photo_box[1]))
        d.rectangle(photo_box, outline=(71, 85, 105, 255), width=2)
        # Hologram band across the lower corner of the photo.
        hologram(img, (140, 386, 300, 440))
        d.text((146, 444), "HOLOGRAM", font=font(11, "sans", True), fill=(100, 116, 139, 255))

    # Fields
    lf = font(13, "sans", True)
    x, y = 330, 140

    def field(label: str, value: str, fx: int, fy: int, *, size: int = 25, retyped: bool = False) -> None:
        d.text((fx, fy), label, font=lf, fill=MUTED + (255,))
        if retyped:
            # Re-typed value: different typeface, weight, colour and baseline,
            # over a patched background that interrupts the guilloche.
            rf = font(27, "courier", True)
            tw = text_width(d, value, rf)
            d.rectangle((fx - 4, fy + 17, fx + tw + 8, fy + 52), fill=(252, 252, 247, 255))
            d.text((fx + 2, fy + 23), value, font=rf, fill=(55, 48, 40, 255))
        else:
            d.text((fx, fy + 18), value, font=font(size, "sans", True), fill=INK + (255,))

    field("NAME", p["name"].upper(), x, y)
    field("ADDRESS", p["address"].upper(), x, y + 64, size=19)
    field("LICENCE NO.", p["licence_no"], x, y + 128)
    field("DATE OF BIRTH", dmy(p["dob_shown"] if tampered else p["dob"]), x + 300, y + 128, retyped=tampered)
    field("ISSUE DATE", dmy(p["issue"]), x, y + 192)
    field("LICENCE EXPIRY", dmy(p["expiry"]), x + 300, y + 192)
    field("LICENCE TYPE", "CAR", x, y + 256)
    field("CONDITIONS", "NIL", x + 300, y + 256)

    # Signature
    d.text((60, 470), "Signature", font=font(12, "sans", True), fill=MUTED + (255,))
    d.text((60, 488), p["signature"], font=font(30, "script"), fill=(30, 41, 59, 255))
    d.line((60, 532, 300, 532), fill=(148, 163, 184, 255), width=1)

    # Microprint border + issuer footer
    micro = ("ROADLICENSINGVICTORIA" * 12)[:150]
    d.text((50, H - 46), micro, font=font(8, "sans"), fill=(120, 150, 150, 255))
    issuer = "Road Licensing Victroia" if tampered else "Road Licensing Victoria"
    d.text((330, 500), f"Issued by {issuer}", font=font(17, "sans", True), fill=(30, 41, 59, 255))
    d.text((330, 526), "Security features: hologram band · microprint border · UV ink",
           font=font(13, "sans"), fill=MUTED + (255,))
    d.text((330, 546), "Specimen layout — not a real government design", font=font(13, "sans"),
           fill=MUTED + (255,))

    if p.get("certified"):
        jp_stamp(img, p["certified"], H)

    save(specimen(img), name)


# ───────────────────────── Passport bio page (Australia-style) ─────────────────────────
def passport(name: str, p: dict, *, photo_swap: bool = False) -> tuple[str, str]:
    W, H = 1000, 720
    img = certified_copy_canvas(W, H, bool(p.get("certified")))
    d = ImageDraw.Draw(img)
    page = (22, 22, W - 22, H - 22)
    d.rounded_rectangle(page, radius=18, fill=(248, 243, 228, 255), outline=(170, 160, 140, 255), width=2)
    guilloche(d, (40, 110, W - 40, 520), (214, 200, 230, 255), rows=16, amp=8, period=110)
    guilloche(d, (40, 110, W - 40, 520), (200, 226, 214, 255), rows=9, amp=12, period=160, phase=1.7)

    d.text((48, 38), "PASSPORT", font=font(36, "serif", True), fill=(30, 27, 75, 255))
    d.text((270, 50), "AUSTRALIA  ·  specimen layout", font=font(19, "sans", True), fill=(76, 29, 149, 255))
    d.rounded_rectangle((W - 210, 40, W - 48, 80), radius=8, fill=(253, 230, 138, 255))
    d.text((W - 196, 48), "SPECIMEN", font=font(22, "sans", True), fill=(120, 53, 15, 255))

    photo_box = (52, 120, 292, 440)
    pw, ph = photo_box[2] - photo_box[0], photo_box[3] - photo_box[1]
    if photo_swap:
        # Re-pasted photo: the guilloche is interrupted around it, the backdrop
        # and lighting differ, and the photo sits slightly rotated with a halo.
        d.rectangle((photo_box[0] - 8, photo_box[1] - 8, photo_box[2] + 12, photo_box[3] + 10),
                    fill=(250, 248, 240, 255))
        swap = portrait((pw - 6, ph - 6), (232, 216, 196, 255), (60, 44, 40, 255), hair="short")
        halo = Image.new("RGBA", (swap.width + 10, swap.height + 10), (255, 255, 255, 255))
        halo.alpha_composite(swap, (5, 5))
        halo = halo.rotate(-2.2, expand=True, resample=Image.Resampling.BICUBIC, fillcolor=(0, 0, 0, 0))
        img.alpha_composite(halo, (photo_box[0] - 2, photo_box[1] - 4))
    else:
        main = portrait((pw, ph), (215, 226, 236, 255), (55, 65, 81, 255), hair=p.get("hair", "short"),
                        hair_colour=p.get("hair_colour"))
        img.alpha_composite(main, (photo_box[0], photo_box[1]))
        d.rectangle(photo_box, outline=(55, 65, 81, 255), width=2)

    # Ghost image (always the genuine holder's portrait — so a swapped main
    # photo no longer matches it).
    ghost = portrait((110, 140), (0, 0, 0, 0), (90, 90, 120, 70), hair=p.get("hair", "short"),
                     hair_colour=(90, 90, 120, 70))
    img.alpha_composite(ghost, (W - 160, 110))

    lf = font(13, "sans", True)
    vf = font(23, "sans", True)

    def field(label: str, value: str, fx: int, fy: int) -> None:
        d.text((fx, fy), label.upper(), font=lf, fill=(107, 114, 128, 255))
        d.text((fx, fy + 16), value, font=vf, fill=(30, 27, 75, 255))

    x = 330
    field("Type", "P", x, 120)
    field("Code", "AUS", x + 90, 120)
    field("Passport No.", p["number"], x + 210, 120)
    field("Surname", p["surname"].upper(), x, 178)
    field("Given names", p["given"].upper(), x, 236)
    field("Nationality", "AUSTRALIAN", x, 294)
    field("Date of birth", dmy_mrz(p["dob"]), x, 352)
    field("Sex", p["sex"], x + 300, 352)
    field("Date of issue", dmy_mrz(p["issue"]), x, 410)
    field("Date of expiry", dmy_mrz(p["expiry"]), x + 300, 410)
    d.text((x, 470), "Authority: AUSTRALIA (specimen)   ·   Specimen layout — not a real government design",
           font=font(13, "sans"), fill=(107, 114, 128, 255))

    line1, line2 = td3_mrz(surname=p["surname"], given=p["given"], number=p["number"], nationality="AUS",
                           dob=p["dob"], sex=p["sex"], expiry=p["expiry"])
    if photo_swap:
        line2 = corrupt_check_digits(line2)
    d.rectangle((40, H - 170, W - 40, H - 60), fill=(255, 251, 235, 255))
    mf = font(29, "mono", True)
    d.text((56, H - 160), line1, font=mf, fill=(30, 27, 75, 255))
    d.text((56, H - 116), line2, font=mf, fill=(30, 27, 75, 255))

    if p.get("certified"):
        jp_stamp(img, p["certified"], H)

    save(specimen(img), name)
    return line1, line2


# ───────────────────────── Bank statement ─────────────────────────
def bank_statement(name: str, s: dict) -> None:
    W, H = 900, 660 + 34 * len(s["transactions"]) + 170
    img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    brand = s["brand_colour"]
    d.rectangle((0, 0, W, 120), fill=brand + (255,))
    d.polygon([(48, 92), (92, 28), (112, 72)], fill=(255, 255, 255, 230))
    d.text((128, 30), s["bank"].upper(), font=font(34, "sans", True), fill=(255, 255, 255, 255))
    d.text((128, 76), s["bank_tagline"], font=font(16, "sans"), fill=(226, 232, 240, 255))

    d.text((48, 150), s["title"], font=font(28, "sans", True), fill=INK + (255,))
    d.text((48, 190), f"Statement period: {s['period']}", font=font(17, "sans"), fill=MUTED + (255,))
    d.text((W - 210, 190), "Page 1 of 1", font=font(17, "sans"), fill=MUTED + (255,))

    d.rounded_rectangle((48, 230, W - 48, 420), radius=10, fill=(248, 250, 252, 255), outline=(203, 213, 225, 255))
    rows = [
        ("Account name", s["account_name"]),
        ("Account type", s["account_type"]),
        ("BSB / account", s["bsb_account"]),
        (s["opened_label"], s["opened"]),
        ("Statement date", s["statement_date"]),
    ]
    y = 248
    for k, v in rows:
        d.text((72, y), k, font=font(16, "sans", True), fill=MUTED + (255,))
        d.text((300, y), v, font=font(19, "sans", True), fill=INK + (255,))
        y += 33

    # Transactions
    y = 450
    cols = (48, 190, 590, 690, 790)
    d.rectangle((48, y, W - 48, y + 36), fill=(241, 245, 249, 255))
    for cx, head in zip(cols, ("Date", "Description", "Debit", "Credit", "Balance")):
        d.text((cx + 10, y + 8), head, font=font(16, "sans", True), fill=INK + (255,))
    y += 46
    tf = font(16, "sans")
    for dt, desc, debit, credit, bal in s["transactions"]:
        d.text((cols[0] + 10, y), dt, font=tf, fill=INK + (255,))
        d.text((cols[1] + 10, y), desc, font=tf, fill=INK + (255,))
        if debit:
            d.text((cols[2] + 10, y), debit, font=tf, fill=INK + (255,))
        if credit:
            d.text((cols[3] + 10, y), credit, font=tf, fill=INK + (255,))
        d.text((cols[4] + 10, y), bal, font=tf, fill=INK + (255,))
        y += 34
        d.line((48, y - 8, W - 48, y - 8), fill=(226, 232, 240, 255), width=1)

    y += 14
    d.text((48, y), f"Closing balance: {s['closing']}", font=font(20, "sans", True), fill=INK + (255,))
    d.text((48, H - 120), s["footer"], font=font(14, "sans"), fill=MUTED + (255,))
    d.text((48, H - 96), f"{s['bank']} is a fictional bank. Specimen layout — demo only.",
           font=font(14, "sans"), fill=MUTED + (255,))
    save(specimen(img), name)


# ───────────────────────── SMSF registration extract ─────────────────────────
def smsf_registration(name: str, s: dict) -> None:
    W, H = 900, 1080
    img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 110), fill=(30, 58, 95, 255))
    d.text((48, 26), "BUSINESS REGISTER EXTRACT", font=font(30, "sans", True), fill=(255, 255, 255, 255))
    d.text((48, 70), "Self-managed superannuation fund — registration details (specimen layout)",
           font=font(17, "sans"), fill=(203, 213, 225, 255))

    d.text((48, 140), s["fund_name"], font=font(30, "sans", True), fill=INK + (255,))
    d.text((48, 182), f"Extract printed {s['printed']} — supplied with the rollover request",
           font=font(16, "sans"), fill=MUTED + (255,))

    rows = [
        ("ABN", s["abn"]),
        ("ABN status", f"Active from {s['registered_long']}"),
        ("Entity type", "ATO regulated self-managed superannuation fund"),
        ("Regulation status", "Registered — compliance status not yet determined"),
        ("Electronic service address (ESA)", s["esa"]),
        ("Trustee arrangement", "Individual trustee (as declared by the applicant)"),
        ("Member named on the request", s["member_named"]),
        ("Main business location", "Not shown on this extract"),
    ]
    y = 230
    for k, v in rows:
        d.rectangle((48, y, W - 48, y + 62), outline=(226, 232, 240, 255), width=1)
        d.text((64, y + 10), k, font=font(15, "sans", True), fill=MUTED + (255,))
        d.text((64, y + 32), v, font=font(20, "sans", True), fill=INK + (255,))
        y += 62

    y += 30
    d.rounded_rectangle((48, y, W - 48, y + 150), radius=10, fill=(239, 246, 255, 255), outline=(147, 197, 253, 255))
    note = [
        "This extract shows registration details only.",
        "It does not confirm who the fund's members are or which bank account belongs",
        "to the fund. Before rolling super over to an SMSF, the paying fund must use the",
        "ATO SMSF verification service (SVS) to confirm the member is linked to the fund",
        "and that the bank details and ESA match.",
    ]
    for i, ln in enumerate(note):
        d.text((68, y + 16 + i * 25), ln, font=font(16, "sans", i == 0), fill=(30, 58, 138, 255))

    d.text((48, H - 96), "Specimen layout — not a real government register. Demo only.",
           font=font(14, "sans"), fill=MUTED + (255,))
    save(specimen(img), name)


# ───────────────────────── Death certificate (certified copy) ─────────────────────────
def death_certificate(name: str, c: dict) -> None:
    W, H = 900, 1220
    img = Image.new("RGBA", (W, H), (253, 251, 245, 255))
    d = ImageDraw.Draw(img)
    d.rectangle((20, 20, W - 20, H - 20), outline=(120, 113, 92, 255), width=3)
    d.rectangle((32, 32, W - 32, H - 32), outline=(180, 170, 140, 255), width=1)
    guilloche(d, (40, 40, W - 40, 150), (226, 218, 196, 255), rows=6, amp=5, period=80)

    def centred(text: str, y: int, f, fill) -> None:
        d.text(((W - text_width(d, text, f)) / 2, y), text, font=f, fill=fill)

    centred("BIRTHS, DEATHS AND MARRIAGES — VICTORIA", 60, font(24, "serif", True), (68, 64, 60, 255))
    centred("DEATH CERTIFICATE", 100, font(40, "serif", True), INK + (255,))
    centred("Specimen layout — not a real certificate", 152, font(15, "sans"), MUTED + (255,))
    d.text((60, 196), f"Registration number  {c['registration']}", font=font(20, "mono", True), fill=INK + (255,))

    rows = [
        ("Surname", c["surname"]),
        ("Given names", c["given"]),
        ("Sex", c["sex"]),
        ("Date of death", c["date_of_death"]),
        ("Place of death", c["place_of_death"]),
        ("Date of birth", c["date_of_birth"]),
        ("Age", c["age"]),
        ("Marital status", c["marital_status"]),
        ("Children (name, age)", c["children"]),
        ("Informant", c["informant"]),
        ("Date of registration", c["date_registered"]),
    ]
    y = 246
    for k, v in rows:
        d.text((60, y), k, font=font(16, "sans", True), fill=MUTED + (255,))
        d.text((330, y - 2), v, font=font(21, "serif"), fill=INK + (255,))
        d.line((60, y + 34, W - 60, y + 34), fill=(226, 220, 205, 255), width=1)
        y += 50

    # Registrar signature and seal
    y += 30
    d.text((60, y), "Registrar", font=font(14, "sans", True), fill=MUTED + (255,))
    d.text((60, y + 18), "M. Okafor", font=font(30, "script"), fill=(30, 41, 59, 255))
    d.line((60, y + 66, 330, y + 66), fill=(148, 163, 184, 255), width=1)
    seal = (W - 250, y - 20, W - 90, y + 140)
    d.ellipse(seal, outline=(161, 98, 7, 255), width=4)
    d.ellipse((seal[0] + 14, seal[1] + 14, seal[2] - 14, seal[3] - 14), outline=(161, 98, 7, 255), width=2)
    sf = font(15, "sans", True)
    for i, ln in enumerate(("REGISTRY", "SEAL", "SPECIMEN")):
        d.text(((seal[0] + seal[2]) / 2 - text_width(d, ln, sf) / 2, seal[1] + 52 + i * 20), ln, font=sf,
               fill=(161, 98, 7, 255))

    st = rotated_stamp(["CERTIFIED TRUE COPY OF THE ORIGINAL", "A. Nguyen JP (Vic) · Reg. 14422",
                        f"Sighted {c['certified']}"], (29, 78, 216), size=17, angle=6)
    img.alpha_composite(st, (60, H - st.height - 70))
    d.text((60, H - 60), "Security features: certified-copy stamp · registry seal · guilloche border",
           font=font(13, "sans"), fill=MUTED + (255,))
    save(specimen(img), name)


# ───────────────────────── Confirmation of income support letter ─────────────────────────
def income_support_letter(name: str, l: dict) -> None:
    W, H = 900, 1180
    img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 16), fill=(4, 120, 87, 255))
    d.text((48, 44), "Services Australia", font=font(30, "sans", True), fill=(6, 78, 59, 255))
    d.text((48, 84), "Centrelink  ·  specimen layout", font=font(17, "sans"), fill=MUTED + (255,))
    d.text((W - 300, 52), l["date_long"], font=font(18, "sans"), fill=INK + (255,))

    y = 150
    for ln in l["address_block"]:
        d.text((48, y), ln, font=font(19, "sans"), fill=INK + (255,))
        y += 28

    d.rounded_rectangle((520, 150, W - 48, 260), radius=8, fill=(240, 253, 244, 255), outline=(134, 239, 172, 255))
    d.text((540, 162), "Customer reference number", font=font(14, "sans", True), fill=MUTED + (255,))
    d.text((540, 182), l["crn"], font=font(21, "mono", True), fill=INK + (255,))
    d.text((540, 214), "Date of birth", font=font(14, "sans", True), fill=MUTED + (255,))
    d.text((540, 232), l["dob_long"], font=font(18, "sans", True), fill=INK + (255,))

    y = 300
    d.text((48, y), "Confirmation of income support", font=font(26, "sans", True), fill=INK + (255,))
    y += 40
    d.text((48, y), "for early release of superannuation on severe financial hardship grounds",
           font=font(18, "sans"), fill=MUTED + (255,))
    y += 56
    body = [
        f"Dear {l['salutation']},",
        "",
        f"This letter confirms that you have received {l['payment']} continuously since",
        f"{l['since_long']} ({l['weeks']} weeks to the date of this letter) and that you are",
        "currently receiving this payment.",
        "",
        "You can give this letter to your super fund to support an application for early",
        "release of super on severe financial hardship grounds. Funds usually need this",
        "letter to be dated within 21 days of your application.",
        "",
        "This letter does not confirm the amount of any payment you may receive from",
        "your super fund. Your fund will assess your application under its own rules.",
        "",
        "Yours sincerely,",
    ]
    for ln in body:
        d.text((48, y), ln, font=font(19, "sans"), fill=INK + (255,))
        y += 30
    d.text((48, y + 6), "Income Support Confirmations Team", font=font(19, "sans", True), fill=INK + (255,))
    d.text((48, y + 36), f"Letter reference {l['reference']}", font=font(16, "mono"), fill=MUTED + (255,))
    d.text((48, H - 96), "Specimen layout — not a real government letter. Demo only.",
           font=font(14, "sans"), fill=MUTED + (255,))
    save(specimen(img), name)


# ───────────────────────── Case data (canon) ─────────────────────────
GRACE = {
    "name": "Grace Williams",
    "address": "27 Seaview Parade, Williamstown VIC 3016",
    "licence_no": "038 641 207",
    "dob": date(1963, 7, 22),
    "dob_shown": date(1968, 7, 22),
    "issue": date(2021, 8, 16),
    "expiry": date(2031, 8, 16),
    "signature": "G. Williams",
    "hair": "long",
    "hair_colour": (148, 148, 160, 255),
}
PRIYA_DL = {
    "name": "Priya Natarajan",
    "address": "1408/88 Riverbank Walk, Southbank VIC 3006",
    "licence_no": "071 330 958",
    "dob": date(1992, 2, 14),
    "issue": date(2024, 2, 14),
    "expiry": date(2034, 2, 14),
    "signature": "P. Natarajan",
    "hair": "long",
    "hair_colour": (30, 27, 30, 255),
}
GEORGE_DL = {
    "name": "George Papadopoulos",
    "address": "16 Elmswood Grove, Oakleigh VIC 3166",
    "licence_no": "029 554 871",
    "dob": date(1960, 4, 3),
    "issue": date(2020, 4, 3),
    "expiry": date(2030, 4, 3),
    "signature": "G. Papadopoulos",
    "hair": "bald",
}
LILY_DL = {
    "name": "Lily Chen",
    "address": "5 Wattlebird Court, Doncaster VIC 3108",
    "licence_no": "052 917 344",
    "dob": date(1977, 5, 11),
    "issue": date(2023, 5, 11),
    "expiry": date(2033, 5, 11),
    "signature": "Lily Chen",
    "hair": "bun",
    "hair_colour": (25, 25, 30, 255),
    "certified": date(2026, 11, 10),
}
ROBERT_PP = {
    "surname": "Chen",
    "given": "Robert",
    "number": "PE4417302",
    "dob": date(1974, 1, 30),
    "sex": "M",
    "issue": date(2022, 3, 14),
    "expiry": date(2032, 3, 14),
    "hair": "short",
    "certified": date(2026, 11, 10),
}
PRIYA_PP = {
    "surname": "Natarajan",
    "given": "Priya",
    "number": "PA9081556",
    "dob": date(1992, 2, 14),
    "sex": "F",
    "issue": date(2021, 9, 1),
    "expiry": date(2031, 9, 1),
    "hair": "long",
    "hair_colour": (30, 27, 30, 255),
}

GW_HOLDINGS_STATEMENT = {
    "bank": "Kestrel Bank",
    "bank_tagline": "Business banking · fictional bank for demonstration",
    "brand_colour": (55, 48, 163),
    "title": "Interim statement — Business Transaction Account",
    "period": "30 Oct 2026 to 05 Nov 2026",
    "account_name": "G WILLIAMS HOLDINGS PTY LTD",
    "account_type": "Business Transaction Account",
    "bsb_account": "062-***   ****7781",
    "opened_label": "Account opened",
    "opened": "30 Oct 2026",
    "statement_date": "05 Nov 2026 (printed on request)",
    "transactions": [
        ("30 Oct 2026", "Account opened — opening deposit (cash)", "", "10.00", "10.00"),
        ("05 Nov 2026", "Closing balance", "", "", "10.00"),
    ],
    "closing": "$10.00",
    "footer": "Interim statement printed at a branch on request. No other transactions in the period.",
}
TOM_STATEMENT = {
    "bank": "Laneway Credit Union",
    "bank_tagline": "Member-owned banking · fictional credit union for demonstration",
    "brand_colour": (15, 118, 110),
    "title": "Statement — Everyday Account",
    "period": "01 Oct 2026 to 31 Oct 2026",
    "account_name": "THOMAS BRADLEY",
    "account_type": "Everyday Account · Coburg VIC 3058",
    "bsb_account": "033-***   ****5120",
    "opened_label": "Customer since",
    "opened": "14 Mar 2011",
    "statement_date": "31 Oct 2026",
    "transactions": [
        ("01 Oct 2026", "Opening balance", "", "", "1,204.30"),
        ("02 Oct 2026", "JobSeeker Payment", "", "781.20", "1,985.50"),
        ("05 Oct 2026", "Home loan repayment", "1,640.00", "", "345.50"),
        ("09 Oct 2026", "Supermarket — Coburg", "118.35", "", "227.15"),
        ("16 Oct 2026", "JobSeeker Payment", "", "781.20", "1,008.35"),
        ("19 Oct 2026", "Home loan repayment — DISHONOURED", "", "", "1,008.35"),
        ("19 Oct 2026", "Dishonour fee", "15.00", "", "993.35"),
        ("23 Oct 2026", "Electricity — part payment", "250.00", "", "743.35"),
        ("27 Oct 2026", "Supermarket — Coburg", "134.80", "", "608.55"),
        ("30 Oct 2026", "JobSeeker Payment", "", "781.20", "1,389.75"),
    ],
    "closing": "$1,389.75",
    "footer": "Home loan arrears notices are sent separately. Call us early if you are in financial difficulty.",
}
GWFSF = {
    "fund_name": "GW Family Superannuation Fund",
    "abn": "98 765 432 109",
    "registered_long": "28 October 2026",
    "esa": "smsfmsg-gwfsf",
    "member_named": "Grace Williams",
    "printed": "05 Nov 2026",
}
MEI_CERT = {
    "registration": "2026/031874",
    "surname": "CHEN",
    "given": "Mei",
    "sex": "Female",
    "date_of_death": "12 October 2026",
    "place_of_death": "Box Hill, Victoria",
    "date_of_birth": "5 June 1945",
    "age": "81 years",
    "marital_status": "Widowed",
    "children": "Robert (52), Lily (49)",
    "informant": "Robert Chen, son",
    "date_registered": "19 October 2026",
    "certified": "10/11/2026",
}
TOM_LETTER = {
    "date_long": "9 November 2026",
    "address_block": ["Mr Thomas Bradley", "Coburg VIC 3058"],
    "crn": "302 418 557K",
    "dob_long": "19 August 1979",
    "salutation": "Mr Bradley",
    "payment": "JobSeeker Payment",
    "since_long": "6 April 2026",
    "weeks": 31,
    "reference": "ISC-2026-1109-48217",
}


# ───────────────────────── Manifest ─────────────────────────
def manifest(robert_mrz: tuple[str, str], priya_mrz: tuple[str, str]) -> list[dict]:
    return [
        # Scenario 2 — Grace Williams (rollover out to an SMSF — identity takeover)
        {
            "id": "dl-grace-tampered",
            "label": "Driver licence — Grace Williams (supplied with the rollover request)",
            "kind": "driver-licence",
            "src": SRC_PREFIX + "driver-licence-grace-tampered.png",
            "expected": "fake",
            "description": "Licence image attached to the 06/11/2026 rollover request. The date of birth has been "
                           "re-typed in a different font (22/07/1968 — the record on file is 22/07/1963), the "
                           "holographic band is missing and the issuer name is misspelt.",
            "expectedHolderName": "Grace Williams",
            "documentNumber": "038 641 207",
            "issuer": "Road Licensing Victroia",
            "expectedIssueDate": "2021-08-16",
            "expectedExpiryDate": "2031-08-16",
            "expectedDateOfBirth": "1968-07-22",
            "securityFeatures": "no",
            "tamperIndicators": "Date of birth printed in a different typeface, weight and baseline from the other "
                                "fields over a patched background; holographic security band missing although the "
                                "card lists one; issuer name misspelt ('Victroia'); photo shows a cut-out halo.",
            "electronicVerification": "No match — the date of birth does not match the issuer's record for this "
                                      "licence number",
        },
        {
            "id": "bank-gw-holdings",
            "label": "Bank statement — G Williams Holdings Pty Ltd (account nominated for the rollover)",
            "kind": "bank-statement",
            "src": SRC_PREFIX + "bank-statement-gw-holdings.png",
            "expected": "suspicious",
            "description": "Interim statement for the account nominated to receive the rollover. The account is in "
                           "a company's name — neither the member nor the SMSF — and was opened on 30/10/2026 "
                           "with a $10 cash deposit, seven days before the request.",
            "expectedHolderName": "G Williams Holdings Pty Ltd",
            "documentNumber": "062-*** ****7781",
            "issuer": "Kestrel Bank",
            "expectedTotal": 10.00,
            "expectedIssueDate": "2026-11-05",
            "accountOpenedDate": "2026-10-30",
            "securityFeatures": "n/a",
            "tamperIndicators": "none",
        },
        {
            "id": "smsf-gwfsf",
            "label": "SMSF registration extract — GW Family Superannuation Fund",
            "kind": "smsf-registration",
            "src": SRC_PREFIX + "smsf-registration-gwfsf.png",
            "expected": "suspicious",
            "description": "Registration details supplied with the rollover request: ABN 98 765 432 109 registered "
                           "on 28/10/2026 (nine days before the request), ESA smsfmsg-gwfsf. The extract itself looks "
                           "unaltered, but the ATO SMSF verification service shows Grace's TFN is not linked to "
                           "this fund.",
            "expectedHolderName": "GW Family Superannuation Fund",
            "documentNumber": "98 765 432 109",
            "issuer": "Business register extract (printed by the requester)",
            "expectedIssueDate": "2026-11-05",
            "registrationDate": "2026-10-28",
            "securityFeatures": "n/a",
            "tamperIndicators": "none",
        },
        {
            "id": "dl-grace-genuine",
            "label": "Driver licence — Grace Williams (copy on the member file)",
            "kind": "driver-licence",
            "src": SRC_PREFIX + "driver-licence-grace-genuine.png",
            "expected": "legit",
            "description": "The licence copy verified when Grace joined Caldova. Attach it to compare with the "
                           "licence image supplied with the rollover request.",
            "expectedHolderName": "Grace Williams",
            "documentNumber": "038 641 207",
            "issuer": "Road Licensing Victoria",
            "expectedIssueDate": "2021-08-16",
            "expectedExpiryDate": "2031-08-16",
            "expectedDateOfBirth": "1963-07-22",
            "securityFeatures": "yes",
            "tamperIndicators": "none",
            "electronicVerification": "Match — verified when the member joined",
        },
        # Scenario 1 — Priya Natarajan (new account & consolidation)
        {
            "id": "dl-priya",
            "label": "Driver licence — Priya Natarajan (verified via DVS by her adviser)",
            "kind": "driver-licence",
            "src": SRC_PREFIX + "driver-licence-priya-natarajan.png",
            "expected": "legit",
            "description": "Victoria-style specimen licence used for Priya's identity check. Her adviser verified it "
                           "electronically through the Document Verification Service (DVS) on 28/10/2026.",
            "expectedHolderName": "Priya Natarajan",
            "documentNumber": "071 330 958",
            "issuer": "Road Licensing Victoria",
            "expectedIssueDate": "2024-02-14",
            "expectedExpiryDate": "2034-02-14",
            "expectedDateOfBirth": "1992-02-14",
            "securityFeatures": "yes",
            "tamperIndicators": "none",
            "electronicVerification": "Match — verified by the adviser via DVS on 28/10/2026",
        },
        {
            "id": "passport-priya-photo-swap",
            "label": "Passport — Priya Natarajan (photo-swap specimen)",
            "kind": "passport",
            "src": SRC_PREFIX + "passport-priya-photo-swap.png",
            "expected": "fake",
            "description": "Training specimen of a counterfeit bio page built from Priya's real details with a "
                           "different photo pasted in. The data would pass an electronic DVS check, but the photo "
                           "area has been re-pasted and the MRZ check digits are inconsistent — the kind of "
                           "tampering only an image check catches.",
            "expectedHolderName": "Priya Natarajan",
            "documentNumber": "PA9081556",
            "issuer": "Australia (specimen layout)",
            "expectedIssueDate": "2021-09-01",
            "expectedExpiryDate": "2031-09-01",
            "expectedDateOfBirth": "1992-02-14",
            "mrz": "\n".join(priya_mrz),
            "securityFeatures": "partial",
            "tamperIndicators": "Photo area re-pasted (white halo, slight rotation, different lighting and "
                                "backdrop); guilloche pattern interrupted around the photo; ghost image does not "
                                "match the main photo; MRZ check digits inconsistent with the printed data.",
            "electronicVerification": "Match (data only) — DVS checks the document details, not the photo",
        },
        # Scenario 3 — George Papadopoulos (pension commencement)
        {
            "id": "dl-george",
            "label": "Driver licence — George Papadopoulos",
            "kind": "driver-licence",
            "src": SRC_PREFIX + "driver-licence-george-papadopoulos.png",
            "expected": "legit",
            "description": "Victoria-style specimen licence on George's member file.",
            "expectedHolderName": "George Papadopoulos",
            "documentNumber": "029 554 871",
            "issuer": "Road Licensing Victoria",
            "expectedIssueDate": "2020-04-03",
            "expectedExpiryDate": "2030-04-03",
            "expectedDateOfBirth": "1960-04-03",
            "securityFeatures": "yes",
            "tamperIndicators": "none",
            "electronicVerification": "Match — verified when the member joined",
        },
        # Scenario 4 — Tom Bradley (financial hardship)
        {
            "id": "bank-tom-bradley",
            "label": "Bank statement — Thomas Bradley (hardship payment account)",
            "kind": "bank-statement",
            "src": SRC_PREFIX + "bank-statement-tom-bradley.png",
            "expected": "legit",
            "description": "October 2026 statement for the account Tom nominated for the hardship payment — in his "
                           "legal name, open since 2011, showing JobSeeker deposits and a dishonoured home loan "
                           "repayment.",
            "expectedHolderName": "Thomas Bradley",
            "documentNumber": "033-*** ****5120",
            "issuer": "Laneway Credit Union",
            "expectedTotal": 1389.75,
            "expectedIssueDate": "2026-10-31",
            "accountOpenedDate": "2011-03-14",
            "securityFeatures": "n/a",
            "tamperIndicators": "none",
        },
        {
            "id": "income-support-tom",
            "label": "Confirmation of income support — Tom Bradley (Services Australia, 09/11/2026)",
            "kind": "income-support-letter",
            "src": SRC_PREFIX + "income-support-letter-tom-bradley.png",
            "expected": "legit",
            "description": "Specimen confirmation letter: JobSeeker Payment received continuously since 06/04/2026 "
                           "(31 weeks), dated 09/11/2026 — within 21 days of the hardship application.",
            "expectedHolderName": "Thomas Bradley",
            "documentNumber": "302 418 557K",
            "issuer": "Services Australia (specimen layout)",
            "expectedIssueDate": "2026-11-09",
            "expectedDateOfBirth": "1979-08-19",
            "incomeSupportSince": "2026-04-06",
            "securityFeatures": "n/a",
            "tamperIndicators": "none",
        },
        # Scenario 5 — Robert Chen for Mei Chen (death benefit)
        {
            "id": "death-cert-mei-chen",
            "label": "Death certificate (certified copy) — Mei Chen",
            "kind": "death-certificate",
            "src": SRC_PREFIX + "death-certificate-mei-chen.png",
            "expected": "legit",
            "description": "Certified copy of a Victoria-style death certificate, registration 2026/031874: Mei Chen, "
                           "born 05/06/1945, died 12/10/2026. Certified by a Justice of the Peace on 10/11/2026.",
            "expectedHolderName": "Mei Chen",
            "documentNumber": "2026/031874",
            "issuer": "Births, Deaths and Marriages Victoria",
            "expectedIssueDate": "2026-10-19",
            "expectedDateOfBirth": "1945-06-05",
            "dateOfDeath": "2026-10-12",
            "registrationDate": "2026-10-19",
            "securityFeatures": "yes",
            "tamperIndicators": "none",
        },
        {
            "id": "passport-robert-chen",
            "label": "Passport — Robert Chen (claimant, certified copy)",
            "kind": "passport",
            "src": SRC_PREFIX + "passport-robert-chen.png",
            "expected": "legit",
            "description": "Certified copy of an Australia-style specimen passport bio page for the claimant, Robert "
                           "Chen. Printed data and MRZ check digits are consistent.",
            "expectedHolderName": "Robert Chen",
            "documentNumber": "PE4417302",
            "issuer": "Australia (specimen layout)",
            "expectedIssueDate": "2022-03-14",
            "expectedExpiryDate": "2032-03-14",
            "expectedDateOfBirth": "1974-01-30",
            "mrz": "\n".join(robert_mrz),
            "securityFeatures": "yes",
            "tamperIndicators": "none",
            "electronicVerification": "Match",
        },
        {
            "id": "dl-lily-chen",
            "label": "Driver licence — Lily Chen (claimant, certified copy)",
            "kind": "driver-licence",
            "src": SRC_PREFIX + "driver-licence-lily-chen.png",
            "expected": "legit",
            "description": "Certified copy of a Victoria-style specimen licence for the second claimant, Lily Chen.",
            "expectedHolderName": "Lily Chen",
            "documentNumber": "052 917 344",
            "issuer": "Road Licensing Victoria",
            "expectedIssueDate": "2023-05-11",
            "expectedExpiryDate": "2033-05-11",
            "expectedDateOfBirth": "1977-05-11",
            "securityFeatures": "yes",
            "tamperIndicators": "none",
            "electronicVerification": "Match",
        },
    ]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    driver_licence("driver-licence-grace-tampered.png", GRACE, tampered=True)
    driver_licence("driver-licence-grace-genuine.png", GRACE)
    driver_licence("driver-licence-priya-natarajan.png", PRIYA_DL)
    driver_licence("driver-licence-george-papadopoulos.png", GEORGE_DL)
    driver_licence("driver-licence-lily-chen.png", LILY_DL)
    robert_mrz = passport("passport-robert-chen.png", ROBERT_PP)
    priya_mrz = passport("passport-priya-photo-swap.png", PRIYA_PP, photo_swap=True)
    bank_statement("bank-statement-gw-holdings.png", GW_HOLDINGS_STATEMENT)
    bank_statement("bank-statement-tom-bradley.png", TOM_STATEMENT)
    smsf_registration("smsf-registration-gwfsf.png", GWFSF)
    death_certificate("death-certificate-mei-chen.png", MEI_CERT)
    income_support_letter("income-support-letter-tom-bradley.png", TOM_LETTER)

    samples = manifest(robert_mrz, priya_mrz)
    (OUT_DIR / "manifest.json").write_text(
        json.dumps({"samples": samples}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(samples)} samples and manifest.json to {OUT_DIR}")


if __name__ == "__main__":
    main()
