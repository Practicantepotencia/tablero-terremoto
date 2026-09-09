"""Extrae únicamente IPM censal y geografía de la fuente ya auditada.

python preparar_linea_base_priorizacion.py --ref origin/fuentes-nuevas
No descarga nuevas observaciones ni transforma el IPM de RAPIDA.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent


def build(ref):
    commit = subprocess.check_output(['git', 'rev-parse', ref], cwd=ROOT, text=True).strip()
    raw = subprocess.check_output(['git', 'show', commit + ':data/fuentes_nuevas/datos.json'], cwd=ROOT)
    data = json.loads(raw)
    rows = [r for r in data['rows'] if r['f'] == 'DANE-CNPV2018' and r['id'] == 'dane_ipm_total']
    if len({r['code'] for r in rows}) != len(rows) or not rows:
        raise ValueError('Referencia DANE vacía o con códigos duplicados')
    payload = {'source': data['sources']['DANE-CNPV2018'], 'origin_commit': commit,
               'origin_path': 'data/fuentes_nuevas/datos.json', 'origin_sha256': hashlib.sha256(raw).hexdigest(),
               'artifacts': [a for a in data['artifacts'] if a['file'].endswith('dane_ipm_2018.xlsx')],
               'rows': [{k: r[k] for k in ('code','d','m','v','period','locator','download')} for r in rows]}
    target = ROOT / 'data/linea_base_priorizacion.json'
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(rows)} territorios. IPM censal 2018. Origen {commit}.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ref', default='origin/fuentes-nuevas')
    build(parser.parse_args().ref)
