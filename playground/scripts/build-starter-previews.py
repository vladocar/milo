"""Render sampled Milo scenes to bundled gallery thumbnails (requires Pillow)."""
import base64
import io
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
SCALE=2
font_path=ROOT/'dist/assets/manrope.ttf'
def font(size): return ImageFont.truetype(str(font_path),int(size*SCALE))
def box(x,y,w,h): return ((x-w/2)*SCALE,(y-h/2)*SCALE,(x+w/2)*SCALE,(y+h/2)*SCALE)
def render(record):
    scene=record['scene'];im=Image.new('RGB',(500*SCALE,500*SCALE),scene['background']);d=ImageDraw.Draw(im)
    for shape in scene['shapes']:
        kind=shape['type'];color=shape['color'];fill=shape.get('fill');width=max(1,round(shape['width']*SCALE))
        if kind=='line':
            d.line([(shape['x1']*SCALE,shape['y1']*SCALE),(shape['x2']*SCALE,shape['y2']*SCALE)],fill=color,width=width)
        elif kind in ('circle','dot'):
            r=shape['radius'];d.ellipse(box(shape['x'],shape['y'],2*r,2*r),fill=color if kind=='dot' else fill,outline=None if kind=='dot' else color,width=width)
        elif kind=='rectangle':d.rectangle(box(shape['x'],shape['y'],shape['w'],shape['h']),fill=fill,outline=color,width=width)
        elif kind=='polygon':
            points=[(p['x']*SCALE,p['y']*SCALE) for p in shape['points']]
            if fill:d.polygon(points,fill=fill)
            d.line(points+[points[0]],fill=color,width=width,joint='curve')
        elif kind=='text':d.text((shape['x']*SCALE,shape['y']*SCALE),shape['text'],fill=color,font=font(20),anchor='ls')
    for sprite in scene['sprites']:
        if not sprite['visible']:continue
        x,y,color=sprite['x'],sprite['y'],sprite['color'];outline='#355344'
        if sprite['shape']=='circle':d.ellipse(box(x,y,40,40),fill=color,outline=outline,width=3)
        elif sprite['shape']=='square':d.rectangle(box(x,y,28,28),fill=color,outline=outline,width=3)
        elif sprite['shape']=='star':
            points=[((x+math.cos(math.radians(-90+i*36))*(9 if i%2 else 20))*SCALE,(y+math.sin(math.radians(-90+i*36))*(9 if i%2 else 20))*SCALE) for i in range(10)]
            d.polygon(points,fill=color);d.line(points+[points[0]],fill=outline,width=3,joint='curve')
        else:
            for dx,dy in [(-12,-9),(12,-9),(-12,9),(12,9),(0,-16)]:d.ellipse(box(x+dx,y+dy,8,8),fill=color,outline=outline,width=3)
            d.ellipse(box(x,y,24,28),fill=color,outline=outline,width=3);d.ellipse(box(x,y,14,18),outline='#d9ece7',width=3)
            for dx in [-1.5,1.5]:d.ellipse(box(x+dx,y-17,2,2),fill=outline)
    if not scene['shapes'] and not scene['sprites']:
        im=Image.new('RGB',im.size,'#eef4e5');d=ImageDraw.Draw(im)
        d.text((40*SCALE,110*SCALE),'PROGRAM MESSAGES',fill='#64836c',font=font(14))
        lines=record['output'][:3]
        if record['notes']:lines=[record['output'][0], '  '.join(str(n) for n in record['notes'][:4]),'  '.join(str(n) for n in record['notes'][4:8])]
        for i,line in enumerate(lines):d.text((40*SCALE,(155+i*48)*SCALE),line[:35],fill='#1f604b',font=font(20))
    data=io.BytesIO();im.resize((320,320),Image.Resampling.LANCZOS).save(data,format='PNG',optimize=True)
    return 'data:image/png;base64,'+base64.b64encode(data.getvalue()).decode()
records=json.loads(Path(sys.argv[1]).read_text())
previews={record['id']:render(record) for record in records}
(ROOT/'dist/starter-previews.js').write_text('// Generated from actual Milo runs. See scripts/build-starter-previews.py.\nexport const starterPreviews = '+json.dumps(previews,separators=(',',':'))+';\n')
print('Generated',len(previews),'starter thumbnails.')
