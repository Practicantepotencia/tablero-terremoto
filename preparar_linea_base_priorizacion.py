"""Extrae el IPM censal total 2018 del anexo municipal DANE guardado en el repositorio.

python preparar_linea_base_priorizacion.py            # usa data/originales/dane_ipm_2018.xlsx
python preparar_linea_base_priorizacion.py --download # vuelve a bajar el anexo y exige el mismo SHA-256

Requiere openpyxl solo para regenerar la referencia; generar el tablero usa el JSON.
No transforma el IPM de RAPIDA ni imputa municipios.
"""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
ORIGINAL = ROOT / 'data/originales/dane_ipm_2018.xlsx'
TARGET = ROOT / 'data/linea_base_priorizacion.json'
INVENTORY = ROOT / 'indicadores_largo_no_calculo.csv'
SHA256 = 'a3ac3a60498ad1b19a9aa64e27c8810e4251377ce93effcf7d53fe756f8c826f'
URL = 'https://www.dane.gov.co/files/investigaciones/condiciones_vida/pobreza/2018/informacion-censal/anexo-censal-pobreza-municipal-2018.xlsx'
PAGE = 'https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/pobreza-y-desigualdad/medida-de-pobreza-multidimensional-de-fuente-censal'
SHEET = '4_IPM Mpio dominios'
SOURCE = {'label': 'DANE · IPM censal 2018', 'kind': 'Línea base municipal', 'url': PAGE, 'download': URL,
          'local': ORIGINAL.relative_to(ROOT).as_posix(), 'period': '2018',
          'note': 'IPM total, cabeceras y rural; 15 privaciones. Hogares particulares efectivamente censados (CNPV 2018). No mide daños del sismo ni sustituye el IPM de RAPIDA. Geografía censal de 2018: incluye áreas no municipalizadas.'}


def departments(book, inventory=INVENTORY):
    # Códigos oficiales del anexo; la grafía visible sigue al inventario cuando existe.
    names = {str(r[0]).zfill(2): str(r[1]).title() for r in list(book['TB_REF'].values)[1:] if r[0] and r[1]}
    if Path(inventory).exists():
        with open(inventory, encoding='utf-8-sig', newline='') as handle:
            for r in csv.DictReader(handle):
                code = r.get('divipola', '')
                if code.isdigit() and len(code) in (2, 5):
                    names[code[:2]] = r['departamento']
    return names


def extract(raw, inventory=INVENTORY):
    import openpyxl
    book = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    names = departments(book, inventory)
    rows, codes = [], set()
    for line, values in enumerate(book[SHEET].values, 1):
        code = str(values[0])
        if not re.fullmatch(r'\d{5}', code):
            continue
        if code in codes:
            raise ValueError(f'Código DANE repetido: {code}')
        value = values[2]
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
            raise ValueError(f'IPM fuera de 0–100 en {SHEET}!C{line}')
        codes.add(code)
        rows.append({'code': code, 'd': names[code[:2]], 'm': str(values[1]).title(), 'v': float(value),
                     'period': '2018', 'locator': f'{SHEET}!C{line}', 'download': URL})
    book.close()
    if len(rows) < 1100:
        raise ValueError(f'Cobertura inesperada: {len(rows)} municipios')
    return rows


def build(download=False):
    if download:
        with urlopen(Request(URL, headers={'User-Agent': 'tablero-terremoto/1.0'}), timeout=90) as response:
            raw = response.read()
    else:
        raw = ORIGINAL.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != SHA256:
        # Un anexo distinto se revisa antes de reemplazar la referencia auditada.
        raise ValueError(f'El anexo DANE cambió (SHA-256 {digest}); revisar antes de regenerar')
    rows = extract(raw)
    payload = {'source': SOURCE,
               'artifacts': [{'file': SOURCE['local'], 'url': URL, 'sha256': digest, 'bytes': len(raw)}],
               'rows': rows}
    TARGET.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(rows)} territorios. IPM censal 2018. SHA-256 {digest}.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true', help='descargar el anexo desde DANE en vez de usar la copia local')
    build(parser.parse_args().download)
