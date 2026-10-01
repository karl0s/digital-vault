"""snap_picks.py STATE OUT.json PICKS.json - picks given as {ShowID: "t1 t2 t3 t4"}; each time snapped to the nearest captured frame."""
import json, sys, re
from pathlib import Path
st={e['ShowID']:e['key'] for e in json.load(open(sys.argv[1]))['shows']}
P=json.load(open(sys.argv[3])); W=Path.home()/'VaultShots/work'; out={}; sec=lambda t: sum(int(x)*k for x,k in zip(t.split('-'),(3600,60,1)))
for sid,v in P.items():
    av=[re.search(r'_t([\d-]+)\.jpg',f.name).group(1) for f in (W/st[sid]).glob('*_t*.jpg')]
    ts=[min(av,key=lambda a: abs(sec(a)-sec(t))) for t in v.split()]
    out[st[sid]]=[['A close-up',ts[0]],['B two or more',ts[1]],['C wide',ts[2]],['spare hand-picked',ts[3]]]
    moved=[(a,b) for a,b in zip(v.split(),ts) if a!=b]
    if moved: print(sid,'snapped',moved)
json.dump(out,open(sys.argv[2],'w'),indent=1); print(len(out),'shows')
