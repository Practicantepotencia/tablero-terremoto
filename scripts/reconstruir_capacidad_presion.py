"""Reproduce the observed municipal denominators from immutable repository extracts."""
import hashlib,json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
target=root/'data/presion_salud.json'
cfg=json.loads(target.read_text(encoding='utf-8'))
commit=cfg['audit']['source_commit']
url=f"https://raw.githubusercontent.com/Practicantepotencia/tablero-terremoto/{commit}/data/salud_capacidad_reps_2022.json"
raw=urllib.request.urlopen(url,timeout=60).read()
cap=json.loads(raw)
assert cap['config']['id']==cfg['mode']
groups={}
seen=set()
for r in cap['records']:
    key=(r['code'],r['site'],r['group'],r['description'],r['reference_date'])
    assert key not in seen
    seen.add(key)
    assert isinstance(r['value'],int) and r['value']>=0 and r['reference_date']=='2022-11-05'
    groups.setdefault(r['code'],[]).append(r)
actual={r['code']:r for r in cfg['capacity']['rows']}
assert set(actual)==set(groups)
for code,rs in groups.items():
    assert actual[code]['value']==sum(r['value'] for r in rs)
    assert actual[code]['site_count']==len({r['site'] for r in rs})
    assert actual[code]['records']==[r['record'] for r in rs]
print(json.dumps({'municipalities':len(groups),'records':len(seen),'source_url':url,'download_sha256':hashlib.sha256(raw).hexdigest()}))
