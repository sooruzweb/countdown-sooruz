"""
Génère netlify/functions/countdown/glyphs.mjs à partir de SooruzFont.otf.
À relancer uniquement si tu changes les textes, la taille ou les couleurs.
Usage : python3 tools/build_assets.py   (Pillow requis)
"""
import base64, json, math, zlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = str(ROOT / "tools" / "SooruzFont.otf")
OUT = ROOT / "netlify" / "functions" / "countdown" / "glyphs.mjs"

# ---- Réglages ----------------------------------------------------------
W, H = 1200, 360                    # rendu retina, affiché en 600x180 dans l'email
BG, FG = (0x00, 0x00, 0x00), (0xFF, 0xDD, 0x00)
LEVELS = 16                         # 16 niveaux d'anticrénelage = palette GIF 16 couleurs
TXT_TOP_LIVE = "FIN DES FRENCH DAYS DANS"
TXT_TOP_ENDED = "LES FRENCH DAYS SONT TERMINÉS"
LABELS = ["HEURES", "MINUTES", "SECONDES"]
TOP_SIZE, DIGIT_SIZE, LABEL_SIZE = 38, 190, 30
TOP_Y, DIGIT_BASELINE, LABEL_Y = 34, 250, 290   # haut du texte / ligne de base des chiffres
DIGIT_GAP, COLON_W = 8, 84
# -----------------------------------------------------------------------


def quantize(img_l):
    return img_l.point(lambda p: round(p * (LEVELS - 1) / 255)).tobytes()


def pack(b):
    return base64.b64encode(zlib.compress(b, 9)).decode()


f_digit = ImageFont.truetype(FONT, DIGIT_SIZE)
f_top = ImageFont.truetype(FONT, TOP_SIZE)
f_label = ImageFont.truetype(FONT, LABEL_SIZE)

# Chiffres proportionnels dans la police -> cellules de largeur fixe (sinon le compteur "danse")
cell_w = math.ceil(max(f_digit.getlength(c) for c in "0123456789"))
asc, desc = f_digit.getmetrics()
cell_y = DIGIT_BASELINE - asc
cell_h = asc + desc


def glyph(ch, w):
    im = Image.new("L", (w, cell_h), 0)
    d = ImageDraw.Draw(im)
    d.text(((w - f_digit.getlength(ch)) / 2, asc), ch, font=f_digit, fill=255, anchor="ls")
    return pack(quantize(im))


glyphs = {c: glyph(c, cell_w) for c in "0123456789"}
glyphs[":"] = glyph(":", COLON_W)

pair_w = cell_w * 2 + DIGIT_GAP
total = pair_w * 3 + COLON_W * 2
x0 = (W - total) // 2
pair_x = [x0 + i * (pair_w + COLON_W) for i in range(3)]
digit_x = [px + k * (cell_w + DIGIT_GAP) for px in pair_x for k in (0, 1)]
colon_x = [pair_x[0] + pair_w, pair_x[1] + pair_w]


def layer(top_text):
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    d.text((W / 2, TOP_Y), top_text, font=f_top, fill=255, anchor="mt")
    for px, lab in zip(pair_x, LABELS):
        d.text((px + pair_w / 2, LABEL_Y), lab, font=f_label, fill=255, anchor="mt")
    return pack(quantize(im))


palette = []
for i in range(LEVELS):
    t = i / (LEVELS - 1)
    palette += [round(BG[c] + (FG[c] - BG[c]) * t) for c in range(3)]

layout = dict(cellW=cell_w, cellH=cell_h, cellY=cell_y, colonW=COLON_W, digitX=digit_x, colonX=colon_x)
js = (
    "// Fichier généré par tools/build_assets.py — ne pas éditer à la main.\n"
    f"export const W = {W};\nexport const H = {H};\n"
    f"export const PALETTE = {json.dumps(palette)};\n"
    f"export const LAYOUT = {json.dumps(layout)};\n"
    f"export const GLYPHS = {json.dumps(glyphs)};\n"
    f"export const LAYERS = {json.dumps({'live': layer(TXT_TOP_LIVE), 'ended': layer(TXT_TOP_ENDED)})};\n"
)
OUT.write_text(js, encoding="utf-8")
print(f"OK -> {OUT.name} ({len(js) // 1024} Ko) | layout {layout}")
