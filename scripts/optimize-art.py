#!/usr/bin/env python3
"""Build web-sized illustrations from the master PNGs in art-src/.

Writes public/art/<name>-1600.webp, <name>-800.webp and public/art/placeholders.json
(tiny blurred data URLs used while the real picture loads). Run once after changing
any master image; the outputs are committed.
"""
import base64, io, json, pathlib
from PIL import Image, ImageFilter

root = pathlib.Path(__file__).resolve().parent.parent
src, out = root / 'art-src', root / 'public' / 'art'
out.mkdir(parents=True, exist_ok=True)
placeholders = {}
for path in sorted(src.glob('*.png')):
    name = path.stem
    image = Image.open(path).convert('RGB')
    for width in (1600, 800):
        resized = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
        resized.save(out / f'{name}-{width}.webp', 'WEBP', quality=82 if width == 1600 else 78, method=6)
    tiny = image.resize((32, round(image.height * 32 / image.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    buffer = io.BytesIO(); tiny.save(buffer, 'WEBP', quality=60, method=6)
    placeholders[name] = 'data:image/webp;base64,' + base64.b64encode(buffer.getvalue()).decode()
    print(name, [(out / f'{name}-{w}.webp').stat().st_size for w in (1600, 800)], len(placeholders[name]))
(out / 'placeholders.json').write_text(json.dumps(placeholders, indent=0))
