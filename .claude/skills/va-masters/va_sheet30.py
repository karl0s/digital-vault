# sheet30.py TAG FOLDER STEP OUT  -> frames every STEP*5 s per titleset, chapter starts outlined red
import sys, json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw
tag, folder, step, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
F=Path('/private/tmp/claude-501/-Users-ko-Desktop-Projects-the-vault/04c2dca9-7845-47fe-a09f-01d22d4e0a08/scratchpad/va/f5')/tag
ch=json.loads(subprocess.run(['python3',str(Path.home()/'VaultShots/dvd_chapters.py'),'/Volumes/Live Music/'+folder,'--json'],capture_output=True,text=True).stdout or '{}')
fs=sorted(F.glob('*.jpg')); by={}
for f in fs: by.setdefault(f.name.split('_')[0][1:],[]).append(f)
cols,tw,th=14,160,120; tiles=[]
for v,l in sorted(by.items()):
    starts=[c[0] for c in ch.get(v,{}).get('chapters',[])]
    sel=l[::step]
    for f in sel:
        t=(int(f.stem.split('_')[1])-1)*5
        mark=any(t<=s<t+step*5 for s in starts)
        tiles.append((v,t,f,mark))
rows=(len(tiles)+cols-1)//cols
img=Image.new('RGB',(cols*tw,rows*(th+12)),'black'); d=ImageDraw.Draw(img)
for i,(v,t,f,mark) in enumerate(tiles):
    x=(i%cols)*tw; y=(i//cols)*(th+12)
    im=Image.open(f); im.thumbnail((tw,th)); img.paste(im,(x,y+12))
    d.text((x+2,y),f"v{v} {t//3600}:{t//60%60:02d}:{t%60:02d}",fill='red' if mark else 'yellow')
    if mark: d.rectangle([x,y+12,x+tw-1,y+11+th],outline='red',width=2)
img.save(out,quality=78); print(out,img.size,len(tiles))
