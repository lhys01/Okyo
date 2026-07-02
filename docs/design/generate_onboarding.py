"""
Okyo Onboarding Screen Generator
5 screens adapting BitePal's structure to Okyo's brand.
"""
from PIL import Image, ImageDraw, ImageFont
import math
import os

FONT_DIR = os.path.expanduser(
    "~/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/"
    "2fe1947b-4595-42fb-af26-9b33d8896394/40221a32-f98f-417d-9c38-8adb7b560f60/"
    "skills/canvas-design/canvas-fonts/"
)
OUT = os.path.dirname(os.path.abspath(__file__))

# iPhone-ish @ 2x
W, H = 390, 844

# ── Okyo palette ──────────────────────────────────────────
CORAL       = (232,  98,  42)
CORAL_SOFT  = (255, 235, 218)
CORAL_DEEP  = (170,  55,  10)
CREAM       = (255, 253, 248)
CREAM_WARM  = (248, 240, 226)
CREAM_DEEP  = (237, 224, 204)
CHARCOAL    = ( 45,  36,  23)
MUTED       = (152, 124,  92)
GREEN       = ( 48, 148,  82)
GREEN_SOFT  = (208, 240, 218)
GREEN_DEEP  = ( 28,  98,  52)
CARD        = (255, 255, 255)
BORDER      = (228, 214, 192)


# ── Font loader ───────────────────────────────────────────
def fonts():
    def f(name, size):
        try:
            return ImageFont.truetype(FONT_DIR + name, size)
        except Exception:
            return ImageFont.load_default()
    return {
        "dXL":   f("BigShoulders-Bold.ttf",        88),
        "dLG":   f("BigShoulders-Bold.ttf",         72),
        "dMD":   f("BigShoulders-Bold.ttf",         56),
        "dSM":   f("BigShoulders-Bold.ttf",         42),
        "hLG":   f("InstrumentSans-Bold.ttf",       30),
        "hMD":   f("InstrumentSans-Bold.ttf",       24),
        "hSM":   f("InstrumentSans-Bold.ttf",       20),
        "body":  f("InstrumentSans-Regular.ttf",    22),
        "bodyB": f("InstrumentSans-Bold.ttf",       22),
        "lbl":   f("InstrumentSans-Regular.ttf",    18),
        "lblB":  f("InstrumentSans-Bold.ttf",       18),
        "sm":    f("InstrumentSans-Regular.ttf",    14),
        "smB":   f("InstrumentSans-Bold.ttf",       14),
        "xs":    f("InstrumentSans-Regular.ttf",    11),
        "hand":  f("NothingYouCouldDo-Regular.ttf", 22),
        "serif": f("YoungSerif-Regular.ttf",         20),
    }


# ── Drawing helpers ────────────────────────────────────────
def rr(d, x1, y1, x2, y2, r, fill=None, outline=None, ow=1):
    d.rounded_rectangle([x1, y1, x2, y2], radius=r, fill=fill,
                        outline=outline, width=ow)

def text_cx(d, text, y, font, fill, W=W):
    bb = font.getbbox(text)
    x = (W - (bb[2] - bb[0])) // 2
    d.text((x, y), text, font=font, fill=fill)
    return bb[3] - bb[1]

def wrap_cx(d, text, y, font, fill, max_w, lh_extra=6, W=W):
    words = text.split()
    lines, cur = [], []
    for w in words:
        test = " ".join(cur + [w])
        if font.getbbox(test)[2] - font.getbbox(test)[0] <= max_w:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [w]
    if cur:
        lines.append(" ".join(cur))
    offset = 0
    for line in lines:
        bb = font.getbbox(line)
        lh = bb[3] - bb[1]
        text_cx(d, line, y + offset, font, fill, W)
        offset += lh + lh_extra
    return offset

def dot_bar(d, screen, total=5, y=72):
    gap = 20
    x = (W - (total * gap - gap)) // 2
    for i in range(total):
        cx = x + i * gap
        if i == screen:
            rr(d, cx - 10, y - 5, cx + 10, y + 5, 5, CHARCOAL)
        else:
            d.ellipse([cx - 4, y - 4, cx + 4, y + 4], fill=CREAM_DEEP)

def pill(d, text, x, y, font, bg, fg, pad_x=14, pad_y=8, r=20):
    bb = font.getbbox(text)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x2 = x + tw + pad_x * 2
    y2 = y + th + pad_y * 2
    rr(d, x, y, x2, y2, r, bg)
    d.text((x + pad_x, y + pad_y), text, font=font, fill=fg)
    return x2 - x, y2 - y

def cta_button(d, fnt, label, y, x1=28, x2=W-28, r=32):
    rr(d, x1, y, x2, y + 62, r, CORAL)
    bb = fnt.getbbox(label)
    tx = (x1 + x2 - (bb[2] - bb[0])) // 2
    d.text((tx, y + 20), label, font=fnt, fill=CARD)

def ghost_button(d, fnt, label, y, x1=28, x2=W-28, r=32):
    rr(d, x1, y, x2, y + 62, r, fill=None, outline=BORDER, ow=2)
    bb = fnt.getbbox(label)
    tx = (x1 + x2 - (bb[2] - bb[0])) // 2
    d.text((tx, y + 20), label, font=fnt, fill=CHARCOAL)

def back_chevron(d, x=24, y=56):
    pts = [(x + 14, y), (x, y + 12), (x + 14, y + 24)]
    d.line([pts[0], pts[1]], fill=CHARCOAL, width=2)
    d.line([pts[1], pts[2]], fill=CHARCOAL, width=2)

def status_bar(d, fnt):
    d.text((28, 16), "9:41", font=fnt["smB"], fill=CHARCOAL)
    bx = W - 28
    d.rectangle([bx - 22, 17, bx - 1, 25], outline=CHARCOAL, width=1)
    d.rectangle([bx, 19, bx + 2, 23], fill=CHARCOAL)
    d.rectangle([bx - 20, 18, bx - 3, 24], fill=CHARCOAL)


# ── Kiko mascot (cute fox-ish circle face) ─────────────────
def kiko(img, cx, cy, size, bg=CORAL_SOFT, wave=False, happy=False):
    d = ImageDraw.Draw(img)
    r = size // 2

    # Body
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=bg)

    # Ears
    ear_c = bg
    inner_ear = (255, 210, 185)
    for sign in (-1, 1):
        ex = cx + sign * int(r * 0.52)
        ey_top = cy - int(r * 0.88)
        pts_outer = [(ex, cy - int(r*0.65)), (cx + sign*int(r*0.85), ey_top - int(r*0.18)), (cx + sign*int(r*0.22), cy - int(r*0.72))]
        d.polygon(pts_outer, fill=ear_c)
        # inner ear
        pts_inner = [(ex, cy - int(r*0.60)), (cx + sign*int(r*0.72), ey_top - int(r*0.05)), (cx + sign*int(r*0.28), cy - int(r*0.65))]
        d.polygon(pts_inner, fill=inner_ear)

    # Face circle
    fr = int(r * 0.74)
    d.ellipse([cx-fr, cy-fr, cx+fr, cy+fr], fill=(255, 247, 238))

    # Eyes
    ey = cy - int(r * 0.12)
    er = max(3, int(r * 0.11))
    for sign in (-1, 1):
        ex = cx + sign * int(r * 0.28)
        d.ellipse([ex-er, ey-er, ex+er, ey+er], fill=CHARCOAL)
        # Shine
        ss = max(2, int(er * 0.38))
        d.ellipse([ex - er + 2, ey - er + 1, ex - er + 2 + ss, ey - er + 1 + ss], fill=CARD)

    # Nose
    ny = cy + int(r * 0.06)
    d.ellipse([cx-4, ny-3, cx+4, ny+4], fill=CORAL)

    # Mouth
    if happy:
        my = cy + int(r * 0.22)
        d.arc([cx - int(r*0.24), my - 10, cx + int(r*0.24), my + 6], 10, 170, fill=CORAL_DEEP, width=2)
    else:
        my = cy + int(r * 0.2)
        d.arc([cx - int(r*0.18), my - 7, cx + int(r*0.18), my + 4], 15, 165, fill=CORAL_DEEP, width=2)

    # Cheeks
    ck_r = int(r * 0.16)
    for sign in (-1, 1):
        ckx = cx + sign * int(r * 0.48)
        cky = ey + int(r * 0.18)
        d.ellipse([ckx - ck_r, cky - ck_r//2, ckx + ck_r, cky + ck_r//2],
                  fill=(255, 185, 145))

    # Wave arm
    if wave:
        arm_x = cx + int(r * 0.85)
        arm_y = cy + int(r * 0.05)
        d.line([(cx + int(r*0.6), arm_y), (arm_x, arm_y - int(r*0.4))],
               fill=bg, width=max(6, int(r*0.18)))
        d.ellipse([arm_x - int(r*0.12), arm_y - int(r*0.52) - int(r*0.12),
                   arm_x + int(r*0.12), arm_y - int(r*0.52) + int(r*0.12)],
                  fill=bg)


# ── Food illustrations ─────────────────────────────────────
def draw_ramen_bowl(d, cx, cy, r=130):
    # Shadow
    d.ellipse([cx-r-4, cy-r//3+6, cx+r+4, cy+r//2+10], fill=(220, 210, 195))
    # Bowl outer
    d.ellipse([cx-r, cy-r//3, cx+r, cy+r//2+4], fill=(230, 215, 195))
    # Broth
    br = int(r * 0.88)
    d.ellipse([cx-br, cy-int(r*0.26), cx+br, cy+int(r*0.44)], fill=(195, 145, 72))
    # Noodles (swirl arcs)
    for angle_step in range(0, 360, 20):
        rad = math.radians(angle_step)
        x1 = cx + int(50 * math.cos(rad))
        y1 = cy + int(30 * math.sin(rad) * 0.5)
        x2 = cx + int(80 * math.cos(rad + 0.4))
        y2 = cy + int(48 * math.sin(rad + 0.4) * 0.5)
        d.line([(x1, y1), (x2, y2)], fill=(240, 208, 140), width=3)
    # Toppings
    # Egg
    d.ellipse([cx+14, cy-18, cx+50, cy+22], fill=(252, 232, 170))
    d.ellipse([cx+20, cy-12, cx+44, cy+16], fill=(255, 208, 80))
    # Tomato slices
    d.ellipse([cx-50, cy-28, cx-20, cy], fill=(210, 55, 40))
    d.ellipse([cx-48, cy-26, cx-22, cy-2], fill=(235, 80, 65))
    # Green herb
    d.ellipse([cx-18, cy-38, cx+16, cy-16], fill=(65, 155, 72))
    # Bowl rim highlight
    d.arc([cx-r, cy-r//3, cx+r, cy+r//2+4], start=200, end=340, fill=(255,255,255), width=3)

def draw_burger(d, cx, cy, scale=1.0):
    s = scale
    # Bun bottom
    d.ellipse([int(cx-70*s), int(cy+10*s), int(cx+70*s), int(cy+52*s)], fill=(210, 155, 60))
    # Patty
    d.ellipse([int(cx-65*s), int(cy-8*s), int(cx+65*s), int(cy+28*s)], fill=(110, 62, 24))
    # Cheese
    d.rectangle([int(cx-60*s), int(cy-22*s), int(cx+60*s), int(cy-10*s)], fill=(252, 196, 44))
    # Lettuce
    d.arc([int(cx-68*s), int(cy-38*s), int(cx+68*s), int(cy+6*s)], 185, 355, fill=(72, 158, 62), width=9)
    # Tomato
    d.arc([int(cx-60*s), int(cy-50*s), int(cx+60*s), int(cy-16*s)], 190, 350, fill=(210, 50, 36), width=8)
    # Bun top
    d.ellipse([int(cx-72*s), int(cy-92*s), int(cx+72*s), int(cy-18*s)], fill=(220, 160, 56))
    d.ellipse([int(cx-58*s), int(cy-98*s), int(cx+58*s), int(cy-48*s)], fill=(200, 138, 44))
    # Sesame seeds
    for sx, sy in [(-22, -84), (8, -92), (30, -80), (-42, -74)]:
        d.ellipse([int(cx+sx*s-4), int(cy+sy*s-2), int(cx+sx*s+4), int(cy+sy*s+2)],
                  fill=(248, 235, 195))

def draw_pasta(d, cx, cy, scale=1.0):
    s = scale
    # Plate shadow
    d.ellipse([int(cx-90*s)+4, int(cy-42*s)+6, int(cx+90*s)+4, int(cy+52*s)+6],
              fill=(218, 208, 194))
    # Plate
    d.ellipse([int(cx-90*s), int(cy-42*s), int(cx+90*s), int(cy+52*s)], fill=(248, 244, 236))
    # Pasta nest
    for angle in range(0, 360, 18):
        rad = math.radians(angle)
        x1 = cx + int(48*s * math.cos(rad))
        y1 = cy + int(32*s * math.sin(rad) * 0.6)
        x2 = cx + int(72*s * math.cos(rad + 0.5))
        y2 = cy + int(50*s * math.sin(rad + 0.5) * 0.6)
        d.line([(x1, y1), (x2, y2)], fill=(225, 170, 88), width=3)
    # Sauce
    d.ellipse([int(cx-38*s), int(cy-22*s), int(cx+38*s), int(cy+22*s)],
              fill=(195, 55, 35))
    # Basil
    d.ellipse([int(cx-8*s), int(cy-38*s), int(cx+8*s), int(cy-22*s)], fill=(52, 138, 56))
    # Parmesan specs
    for sx, sy in [(-28, 8), (20, -12), (-10, 20), (32, 10)]:
        d.ellipse([int(cx+sx*s-3), int(cy+sy*s-2), int(cx+sx*s+3), int(cy+sy*s+2)],
                  fill=(245, 235, 208))

def draw_tacos(d, cx, cy, scale=1.0):
    s = scale
    # Two tacos side by side
    for i, (dx, col) in enumerate([(-30, (215, 165, 60)), (20, (210, 158, 52))]):
        tx = cx + int(dx * s)
        ty = cy
        # Shell
        pts = [(tx, ty - int(50*s)), (tx - int(35*s), ty + int(30*s)), (tx + int(35*s), ty + int(30*s))]
        d.polygon(pts, fill=col)
        # Filling
        d.ellipse([tx - int(25*s), ty - int(18*s), tx + int(25*s), ty + int(18*s)],
                  fill=(160, 72, 30))
        # Lettuce
        d.arc([tx - int(26*s), ty - int(24*s), tx + int(26*s), ty + int(12*s)],
              190, 350, fill=(68, 155, 62), width=6)
        # Cheese
        for j in range(3):
            d.ellipse([tx - int((18-j*6)*s), ty - int((32-j*4)*s),
                       tx - int((10-j*6)*s), ty - int((24-j*4)*s)],
                      fill=(252, 200, 48))


# ══════════════════════════════════════════════════════════
# SCREEN 1 — Welcome Hero
# ══════════════════════════════════════════════════════════
def screen1(F):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # Gradient upper half: coral → cream
    for y in range(H * 55 // 100):
        t = (y / (H * 0.55)) ** 1.4
        r = int(CORAL[0] * (1-t) * 0.38 + CREAM[0] * (0.62 + t * 0.38))
        g = int(CORAL[1] * (1-t) * 0.38 + CREAM[1] * (0.62 + t * 0.38))
        b = int(CORAL[2] * (1-t) * 0.38 + CREAM[2] * (0.62 + t * 0.38))
        d.line([(0, y), (W, y)], fill=(r, g, b))

    status_bar(d, F)

    # Big food circle — slightly smaller to leave room for text below
    bcx, bcy, br = W // 2, 204, 128
    # Drop shadow
    d.ellipse([bcx - br + 4, bcy - br + 6, bcx + br + 4, bcy + br + 6],
              fill=(200, 175, 145))
    # Circle bg
    d.ellipse([bcx - br, bcy - br, bcx + br, bcy + br], fill=(228, 215, 196))
    draw_ramen_bowl(d, bcx, bcy, r=106)

    # Small floating savings pill (left)
    pill(d, "Save $14 per meal", 22, bcy + 44, F["smB"],
         CARD, GREEN, pad_x=10, pad_y=7, r=14)
    d.ellipse([32, bcy + 56, 40, bcy + 64], fill=GREEN)

    # Kiko peeking from bottom-right of bowl
    kiko(img, bcx + 90, bcy + 98, 64, bg=CORAL_SOFT, happy=True)

    # Drawn hearts (PIL arcs — no emoji)
    def heart(dx, dy, size, col):
        hw = size
        # two bumps + bottom point
        d.arc([dx, dy, dx + hw, dy + hw//2], 180, 360, fill=col, width=2)
        d.arc([dx + hw, dy, dx + hw*2, dy + hw//2], 180, 360, fill=col, width=2)
        d.line([(dx, dy + hw//4), (dx + hw, dy + hw + hw//4)], fill=col, width=2)
        d.line([(dx + hw*2, dy + hw//4), (dx + hw, dy + hw + hw//4)], fill=col, width=2)

    heart(bcx + 62, bcy - 118, 10, (255, 110, 110))
    heart(bcx + 88, bcy - 98, 7, (255, 160, 140))

    # Headline — dMD (56px) fits 2 lines comfortably within the space
    hy = 360
    used = wrap_cx(d, "Remake restaurant meals at home.",
                   hy, F["dMD"], CHARCOAL, W - 40, lh_extra=4)

    # Subtitle
    wrap_cx(d, "Scan any dish · get the recipe · save every time",
            hy + used + 8, F["lbl"], MUTED, W - 60)

    # CTAs
    cta_button(d, F["bodyB"], "Get started", H - 188)
    ghost_button(d, F["body"], "I already have an account", H - 112)

    # Terms
    wrap_cx(d, "By continuing you agree to our Terms and Privacy Policy",
            H - 36, F["xs"], MUTED, W - 80)

    img.save(os.path.join(OUT, "okyo_onboarding_01_welcome.png"), quality=96)
    print("✓ Screen 1 saved")


# ══════════════════════════════════════════════════════════
# SCREEN 2 — Scan Feature
# ══════════════════════════════════════════════════════════
def screen2(F):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    status_bar(d, F)
    back_chevron(d)
    dot_bar(d, 0)

    # Feature card
    cx, cy = W // 2, 96
    cw, ch = W - 48, 292
    rr(d, cx - cw//2, cy, cx + cw//2, cy + ch, 28, CARD)

    # Food photo area inside card
    px, py = cx - cw//2 + 12, cy + 12
    pw, ph = cw - 24, ch - 80
    rr(d, px, py, px + pw, py + ph, 18, CREAM_WARM)

    # Burger inside photo
    draw_burger(d, px + pw//2, py + ph//2 + 10, scale=0.82)

    # Scan corner brackets
    corner = 22
    bc = 3
    for (bx, by, dx, dy) in [
        (px+10, py+10, 1, 1), (px+pw-10, py+10, -1, 1),
        (px+10, py+ph-10, 1, -1), (px+pw-10, py+ph-10, -1, -1)
    ]:
        d.line([(bx, by), (bx + dx*corner, by)], fill=CORAL, width=bc)
        d.line([(bx, by), (bx, by + dy*corner)], fill=CORAL, width=bc)

    # Floating price pills on photo
    rr(d, px+8, py+8, px+132, py+42, 10, CARD)
    d.text((px+16, py+12), "Restaurant", font=F["sm"], fill=MUTED)
    d.text((px+16, py+25), "$18.50", font=F["lblB"], fill=CHARCOAL)

    rr(d, px+pw-140, py+8, px+pw-8, py+42, 10, CARD)
    d.text((px+pw-134, py+12), "At home", font=F["sm"], fill=MUTED)
    d.text((px+pw-134, py+25), "$4.20", font=F["lblB"], fill=GREEN)

    # Kiko peeking up from bottom of card
    kiko(img, W//2, cy + ch - 52, 82, bg=CORAL_SOFT, happy=True)

    # Headline
    hy = cy + ch + 40
    wrap_cx(d, "Scan the dish,", hy, F["dSM"], CHARCOAL, W - 48, lh_extra=0)
    wrap_cx(d, "skip the guesswork.", hy + 52, F["dSM"], CHARCOAL, W - 48, lh_extra=0)

    # Body
    wrap_cx(d, "Point your camera at any restaurant meal\nand Kiko builds the recipe instantly.",
            hy + 116, F["lbl"], MUTED, W - 64)

    cta_button(d, F["bodyB"], "Next →", H - 108)

    img.save(os.path.join(OUT, "okyo_onboarding_02_scan.png"), quality=96)
    print("✓ Screen 2 saved")


# ══════════════════════════════════════════════════════════
# SCREEN 3 — Savings Proof
# ══════════════════════════════════════════════════════════
def screen3(F):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # Soft green gradient at top
    for y in range(210):
        t = (y / 210) ** 0.9
        r = int(GREEN_SOFT[0] * (1-t) + CREAM[0] * t)
        g = int(GREEN_SOFT[1] * (1-t) + CREAM[1] * t)
        b = int(GREEN_SOFT[2] * (1-t) + CREAM[2] * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))

    status_bar(d, F)
    back_chevron(d)
    dot_bar(d, 1)

    # Sparkle accents
    d.text((W - 46, 54), "✦", font=F["hMD"], fill=GREEN)
    d.text((18, 184), "✦", font=F["lblB"], fill=GREEN)

    # Headline
    wrap_cx(d, "Okyo saves you", 86, F["dSM"], CHARCOAL, W - 40, lh_extra=0)
    wrap_cx(d, "real money.", 136, F["dSM"], CHARCOAL, W - 40, lh_extra=0)

    # Chart card
    cardx, cardy, cardw, cardh = 24, 194, W - 48, 246
    rr(d, cardx, cardy, cardx + cardw, cardy + cardh, 24, CARD,
       outline=BORDER, ow=1)

    d.text((cardx + 22, cardy + 18), "Average meal cost comparison",
           font=F["sm"], fill=MUTED)

    base_y = cardy + cardh - 44
    bw = 80
    gap = 58

    # Restaurant bar
    rx = cardx + 52
    rest_h = 152
    rr(d, rx, base_y - rest_h, rx + bw, base_y, 10, CREAM_DEEP)
    d.text((rx + 10, base_y - rest_h - 24), "$18.50", font=F["lblB"], fill=CHARCOAL)
    d.text((rx + 8, base_y + 8), "Restaurant", font=F["sm"], fill=MUTED)

    # Home bar
    hx = rx + bw + gap
    home_h = 44
    rr(d, hx, base_y - home_h, hx + bw, base_y, 10, GREEN)
    d.text((hx + 22, base_y - home_h - 24), "$4.20", font=F["lblB"], fill=GREEN)
    d.text((hx + 18, base_y + 8), "At home", font=F["sm"], fill=MUTED)

    # Savings bracket
    sx = hx + bw + 14
    mid_y = base_y - (rest_h + home_h) // 2
    d.line([(rx + bw + 6, base_y - rest_h), (rx + bw + 6, base_y - home_h)],
           fill=CORAL, width=1)
    rr(d, sx, mid_y - 14, sx + 70, mid_y + 14, 8, CORAL_SOFT)
    d.text((sx + 6, mid_y - 10), "−$14.30", font=F["smB"], fill=CORAL)

    # Kiko celebrating below card
    ky = cardy + cardh + 68
    kiko(img, W // 2, ky, 70, bg=CORAL_SOFT, happy=True)
    # Arms up
    ar = 35
    d.line([(W//2 - ar, ky + 6), (W//2 - ar - 22, ky - 22)], fill=CORAL_SOFT, width=9)
    d.line([(W//2 + ar, ky + 6), (W//2 + ar + 22, ky - 22)], fill=CORAL_SOFT, width=9)

    # Stat chip
    stat_y = ky + 52
    chip_text = "72% of Okyo cooks save $50+ a week"
    rr(d, 24, stat_y, W - 24, stat_y + 38, 19, GREEN_SOFT)
    d.ellipse([40, stat_y + 13, 50, stat_y + 23], fill=GREEN)
    d.text((58, stat_y + 10), chip_text, font=F["smB"], fill=GREEN_DEEP)

    cta_button(d, F["bodyB"], "Next →", H - 108)

    img.save(os.path.join(OUT, "okyo_onboarding_03_savings.png"), quality=96)
    print("✓ Screen 3 saved")


# ══════════════════════════════════════════════════════════
# SCREEN 4 — How It Works (three tilted cards)
# ══════════════════════════════════════════════════════════
def screen4(F):
    img = Image.new("RGB", (W, H), CORAL_SOFT)
    d = ImageDraw.Draw(img)

    # Warm gradient bg
    for y in range(H):
        t = y / H
        r = int(CORAL_SOFT[0] - t * 18)
        g = int(CORAL_SOFT[1] - t * 12)
        b = int(CORAL_SOFT[2] - t * 8)
        d.line([(0, y), (W, y)], fill=(max(0, r), max(0, g), max(0, b)))

    status_bar(d, F)
    back_chevron(d, 24, 54)
    dot_bar(d, 2)

    # Headline — smaller font so cards don't collide
    wrap_cx(d, "How Okyo works", 82, F["dMD"], CHARCOAL, W - 40, lh_extra=2)

    # Three tilted cards — pushed down so headline is clear
    cards = [
        dict(label="Step 1", title="Snap the\nrestaurant meal",
             bg=CORAL, fg=CARD, icon="📷", angle=-7, ox=-18, oy=0),
        dict(label="Step 2", title="Get the\nhomemade recipe",
             bg=CARD, fg=CHARCOAL, icon="📖", angle=6, ox=14, oy=52),
        dict(label="Step 3", title="Save money,\nevery single cook",
             bg=GREEN, fg=CARD, icon="🛒", angle=-4, ox=-8, oy=108),
    ]

    cw, ch = 252, 144
    start_y = 278

    for i, card in enumerate(cards):
        # Build card on RGBA canvas
        c_img = Image.new("RGBA", (cw + 24, ch + 24), (0, 0, 0, 0))
        cd = ImageDraw.Draw(c_img)
        rr(cd, 8, 8, cw + 16, ch + 16, 22, card["bg"])

        # Step label
        label_col = (255, 255, 255, 160) if card["fg"] == CARD else (*MUTED, 255)
        cd.text((22, 18), card["label"], font=F["smB"],
                fill=(*label_col[:3],) if len(label_col) == 4 else label_col)

        # Card title lines
        ty = 42
        for line in card["title"].split("\n"):
            cd.text((18, ty), line, font=F["hMD"], fill=card["fg"])
            ty += 32

        # Icon placeholder (circle)
        icon_cx, icon_cy = cw - 32, ch - 22
        cd.ellipse([icon_cx - 18, icon_cy - 18, icon_cx + 18, icon_cy + 18],
                   fill=(*CARD, 25) if card["fg"] == CARD else (*CORAL_SOFT, 200))

        # Rotate card
        rotated = c_img.rotate(card["angle"], expand=True, resample=Image.BICUBIC)

        px = W // 2 - rotated.width // 2 + card["ox"]
        py = start_y + i * 52 + card["oy"] - rotated.height // 2
        img.paste(rotated, (px, py), rotated)

    # Kiko at bottom
    kiko(img, W // 2, H - 188, 60, bg=CORAL_SOFT, wave=True)

    cta_button(d, F["bodyB"], "Let's go →", H - 108)

    img.save(os.path.join(OUT, "okyo_onboarding_04_how_it_works.png"), quality=96)
    print("✓ Screen 4 saved")


# ══════════════════════════════════════════════════════════
# SCREEN 5 — Social Proof / CTA
# ══════════════════════════════════════════════════════════
def screen5(F):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # Soft blue-tinted gradient top
    for y in range(260):
        t = y / 260
        r = int(218 * (1 - t) + CREAM[0] * t)
        g = int(232 * (1 - t) + CREAM[1] * t)
        b = int(248 * (1 - t) + CREAM[2] * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))

    status_bar(d, F)
    back_chevron(d)
    # No dot bar on the final CTA screen — gives cleaner look

    # Savings coin illustration — moved down to avoid status bar
    coin_cx, coin_cy, coin_r = W // 2, 215, 96
    # Outer ring segments
    seg_count = 80
    for i in range(seg_count):
        angle = (i / seg_count) * 360 - 90
        rad = math.radians(angle)
        t_seg = i / seg_count
        seg_col = GREEN if t_seg < 0.72 else CREAM_DEEP
        x1 = coin_cx + int((coin_r + 14) * math.cos(rad))
        y1 = coin_cy + int((coin_r + 14) * math.sin(rad))
        x2 = coin_cx + int((coin_r + 26) * math.cos(rad))
        y2 = coin_cy + int((coin_r + 26) * math.sin(rad))
        d.line([(x1, y1), (x2, y2)], fill=seg_col, width=4)

    # Coin body
    d.ellipse([coin_cx - coin_r, coin_cy - coin_r,
               coin_cx + coin_r, coin_cy + coin_r], fill=GREEN_SOFT)
    d.ellipse([coin_cx - coin_r + 10, coin_cy - coin_r + 10,
               coin_cx + coin_r - 10, coin_cy + coin_r - 10],
              outline=GREEN, width=2)

    # $ text
    bb = F["dMD"].getbbox("$")
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    d.text((coin_cx - tw//2, coin_cy - th//2 - 4), "$", font=F["dMD"], fill=GREEN)

    # Percentage label
    pct_y = coin_cy + coin_r + 20
    d.text((coin_cx - 12, pct_y), "72%", font=F["hLG"], fill=GREEN)

    # Headline
    hy = pct_y + 40
    wrap_cx(d, "Home cooking costs", hy, F["dSM"], CHARCOAL, W - 40, lh_extra=0)
    wrap_cx(d, "60% less than", hy + 52, F["dSM"], CHARCOAL, W - 40, lh_extra=0)

    # "eating out" in coral
    text_cx(d, "eating out.", hy + 104, F["dSM"], CORAL)

    # Subtext
    wrap_cx(d,
            "Okyo gives you the recipe, grocery list,\nand real savings estimate — every time.",
            hy + 158, F["lbl"], MUTED, W - 64, lh_extra=4)

    # Proof card
    proof_y = hy + 232
    rr(d, 24, proof_y, W - 24, proof_y + 78, 20, CARD, outline=BORDER, ow=1)

    kiko(img, 58, proof_y + 39, 46, bg=CORAL_SOFT, happy=True)

    d.text((92, proof_y + 12), "Kiko says:", font=F["smB"], fill=CORAL)
    wrap_cx(d,
            "The average Okyo cook recreates 3 restaurant meals per week, saving $42.",
            proof_y + 30, F["sm"], CHARCOAL, W - 140)

    cta_button(d, F["bodyB"], "Let's go →", H - 108)

    img.save(os.path.join(OUT, "okyo_onboarding_05_proof.png"), quality=96)
    print("✓ Screen 5 saved")


# ── Run ───────────────────────────────────────────────────
if __name__ == "__main__":
    F = fonts()
    screen1(F)
    screen2(F)
    screen3(F)
    screen4(F)
    screen5(F)
    print("\nAll 5 Okyo onboarding screens generated in", OUT)
