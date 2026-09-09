"""Extrae proyección total municipal DANE 2026, con URL, hash y fila de origen.

Requiere openpyxl solo para actualizar la referencia; generar el HTML usa el JSON.
"""
import argparse
import hashlib
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

URL = 'https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx'
PAGE = 'https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion'
ROOT = Path(__file__).resolve().parent


def extract(raw, year=2026):
    import openpyxl
    book = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    sheet = book['PobMunicipalxÁrea']
    rows = []
    excluded = []
    codes = set()
    for line, values in enumerate(sheet.iter_rows(values_only=True), 1):
        dep, department, code, municipality, period, area, total = values
        if period != year or area != 'Total':
            continue
        code = str(code).zfill(5)
        if len(code) != 5 or not code.isdigit() or code in codes:
            raise ValueError(f'Código inválido o repetido: {code}')
        if not isinstance(total, (int, float)) or not math.isfinite(total) or total <= 0:
            excluded.append(dict(code=code, m=municipality, year=year, reason='Sin población positiva utilizable'))
            continue
        codes.add(code)
        rows.append(dict(code=code, d=department, m=municipality, year=year,
                         population=total, locator=f'PobMunicipalxÁrea!A{line}:G{line}'))
    book.close()
    if len(rows) < 1100:
        raise ValueError(f'Cobertura inesperada: {len(rows)} municipios')
    return dict(source='DANE · Proyecciones municipales por área 2018–2042',
                url=URL, page=PAGE, publication='2025-08-08', workbook_updated='2025-07-30',
                downloaded=datetime.now(timezone.utc).isoformat(timespec='seconds'),
                sha256=hashlib.sha256(raw).hexdigest(), year=year,
                area='Total', unit='Habitantes', excluded=excluded, rows=sorted(rows, key=lambda r:r['code']))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--year', type=int, default=2026)
    args = parser.parse_args()
    raw = urlopen(URL, timeout=60).read()
    payload = extract(raw, args.year)
    target = ROOT / 'data/poblacion_relativa.json'
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(payload["rows"])} municipios; proyección {args.year}; SHA256 {payload["sha256"]}')
