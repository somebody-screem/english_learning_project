from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

root = Path(__file__).resolve().parents[1]
image = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((16, 16, 496, 496), radius=120, fill='#207861')
font_path = Path('C:/Windows/Fonts/georgiab.ttf')
font = ImageFont.truetype(str(font_path), 420) if font_path.exists() else ImageFont.truetype('DejaVuSerif-Bold.ttf', 420)
draw.text((110, -56), 'p', font=font, fill='white')
draw.ellipse((345, 88, 410, 153), fill='#c5deb4')
(root / 'build').mkdir(exist_ok=True)
image.save(root / 'build' / 'icon.png')
image.save(root / 'build' / 'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
