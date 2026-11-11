"""Строит точечный шрифт для сайта из обычного шрифта.

Каждая буква раскладывается на сетку точек; размер точки зависит от того,
сколько буквы попало в клетку, поэтому края получаются мягкими, а не ступенчатыми.

Запуск: python3 scripts/make-dotfont.py путь/к/шрифту.woff2 > lib/dotfont.ts
"""
import io, sys
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROWS = 9          # точек на высоту заглавной буквы
CELL = 24         # пикселей на клетку при растеризации
WEIGHT = 480
CHARS = "0123456789SMLXONEF"

src = TTFont(sys.argv[1])
src.flavor = None
buf = io.BytesIO()
src.save(buf)
cap = src["OS/2"].sCapHeight / src["head"].unitsPerEm
size = round(ROWS * CELL / cap)

def font():
    buf.seek(0)
    f = ImageFont.truetype(buf, size)
    f.set_variation_by_axes([WEIGHT])
    return f

f = font()
out = {}
for ch in CHARS:
    im = Image.new("L", (size * 2, size * 2), 0)
    ImageDraw.Draw(im).text((size // 2, size * 2 - size // 2), ch, font=f, fill=255, anchor="ls")
    box = im.getbbox()
    base = size * 2 - size // 2
    top = base - ROWS * CELL
    cols = max(1, round((box[2] - box[0]) / CELL))
    # центрируем букву в целом числе колонок
    x0 = box[0] - (cols * CELL - (box[2] - box[0])) // 2
    rows = []
    for r in range(ROWS):
        row = ""
        for c in range(cols):
            cell = im.crop((x0 + c * CELL, top + r * CELL, x0 + (c + 1) * CELL, top + (r + 1) * CELL))
            cov = sum(cell.getdata()) / (255 * CELL * CELL)
            row += str(min(9, round(9 * cov ** 0.7)))
        rows.append(row)
    out[ch] = rows

print("// Сгенерировано scripts/make-dotfont.py — руками не править.")
print("// Каждая цифра — размер точки от 0 (пусто) до 9 (полная).")
print("export const DOT_ROWS = %d;" % ROWS)
print("export const DOT_FONT: Record<string, string[]> = {")
for ch, rows in out.items():
    print('  "%s": [%s],' % (ch, ", ".join('"%s"' % r for r in rows)))
print("};")
