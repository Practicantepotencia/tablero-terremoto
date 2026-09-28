"""Reproduce los denominadores de camas (REPS 2022) desde el extracto guardado en esta rama.

El extracto llegó desde la rama salud-relativa-hospitalizacion (commit d9124b4); ahora vive en
data/salud_capacidad_reps_2022.json y se verifica por hash, sin descargar nada.
"""
import hashlib, json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
TARGET = root / 'data/presion_salud.json'
EXTRACT = root / 'data/salud_capacidad_reps_2022.json'
SHA256 = '0633032bad1117c370a36e1279fc6621646667cbc8d43746485b4d675c4e4aff'


def reconstruct(raw, cfg):
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError('El extracto de camas REPS 2022 cambió: revisar antes de usarlo')
    cap = json.loads(raw)
    assert cap['config']['id'] == cfg['mode']
    groups, seen = {}, set()
    for r in cap['records']:
        key = (r['code'], r['site'], r['group'], r['description'], r['reference_date'])
        assert key not in seen
        seen.add(key)
        assert isinstance(r['value'], int) and r['value'] >= 0 and r['reference_date'] == '2022-11-05'
        groups.setdefault(r['code'], []).append(r)
    actual = {r['code']: r for r in cfg['capacity']['rows']}
    assert set(actual) == set(groups)
    for code, rs in groups.items():
        assert actual[code]['value'] == sum(r['value'] for r in rs)
        assert actual[code]['site_count'] == len({r['site'] for r in rs})
        assert actual[code]['records'] == [r['record'] for r in rs]
    return {'municipalities': len(groups), 'records': len(seen), 'source_file': EXTRACT.relative_to(root).as_posix(), 'sha256': SHA256}


if __name__ == '__main__':
    print(json.dumps(reconstruct(EXTRACT.read_bytes(), json.loads(TARGET.read_text(encoding='utf-8')))))
