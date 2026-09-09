#!/usr/bin/env python3
"""Descarga fuentes públicas y convierte sus tablas, sin introducir observaciones manuales.

python actualizar_fuentes_nuevas.py           # descarga y valida
python actualizar_fuentes_nuevas.py --offline # reproduce las copias verificadas
"""
import argparse
from collections import Counter
import hashlib
import io
import json
import math
from pathlib import Path
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
DIRECTORY = ROOT / 'data/fuentes_nuevas'
DANE_URL = 'https://www.dane.gov.co/files/investigaciones/condiciones_vida/pobreza/2018/informacion-censal/anexo-censal-pobreza-municipal-2018.xlsx'
DANE_PAGE = 'https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/pobreza-y-desigualdad/medida-de-pobreza-multidimensional-de-fuente-censal'
MEN_PAGE = 'https://www.datos.gov.co/d/nudc-7mev'
MEN_CATALOG = 'https://api.us.socrata.com/api/catalog/v1?domains=www.datos.gov.co&ids=nudc-7mev'
OPS_PAGE = 'https://www.paho.org/es/documentos/informe-situacion-7-colombia-terremoto-agosto-2026-4-septiembre-2026'
OPS_URL = 'https://www.paho.org/sites/default/files/2026/09/sitrep7-colombia-sismo-04092026-es.pdf'
OIM_PAGE = 'https://reliefweb.int/report/colombia/oim-tablero-mapeo-de-alojamientos-colectivos'
OIM_URL = 'https://reliefweb.int/attachments/655510cf-7438-4c33-9023-f27cd24c3f97/Microsoft-Power-BI-08-19-2026_07_30_AM.pdf'
OIM_BOARD = 'https://app.powerbi.com/view?r=eyJrIjoiMTk3NDc1NTctMThkNS00M2U5LTllMzQtNjljOWM4NTlmMWU0IiwidCI6IjE1ODgyNjJkLTIzZmItNDNiNC1iZDZlLWJjZTQ5YzhlNjE4NiIsImMiOjh9'
MEN_FIELDS = {
 'poblaci_n_5_16': ('Población escolar', 'Población de 5 a 16 años', 'Personas'),
 'tasa_matriculaci_n_5_16': ('Matrícula', 'Tasa de matriculación de 5 a 16 años', '%'),
 'cobertura_neta': ('Cobertura neta', 'Cobertura neta total', '%'),
 'cobertura_neta_transici_n': ('Cobertura neta', 'Cobertura neta en transición', '%'),
 'cobertura_neta_primaria': ('Cobertura neta', 'Cobertura neta en primaria', '%'),
 'cobertura_neta_secundaria': ('Cobertura neta', 'Cobertura neta en secundaria', '%'),
 'cobertura_neta_media': ('Cobertura neta', 'Cobertura neta en media', '%'),
 'deserci_n': ('Permanencia', 'Deserción total', '%'),
 'deserci_n_primaria': ('Permanencia', 'Deserción en primaria', '%'),
 'deserci_n_secundaria': ('Permanencia', 'Deserción en secundaria', '%'),
 'deserci_n_media': ('Permanencia', 'Deserción en media', '%'),
 'repitencia': ('Permanencia', 'Repitencia total', '%'),
}
DANE_DIMS = [
 'Educación', 'Educación', 'Niñez y juventud', 'Salud', 'Trabajo', 'Vivienda',
 'Agua y saneamiento', 'Niñez y juventud', 'Vivienda', 'Vivienda',
 'Niñez y juventud', 'Agua y saneamiento', 'Salud', 'Niñez y juventud', 'Trabajo',
]


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) and n >= 0 else None
    except (TypeError, ValueError):
        return None


def slug(value):
    import unicodedata
    return re.sub(r'[^a-z0-9]+', '_', ''.join(c for c in unicodedata.normalize('NFD', value.lower())
                                               if unicodedata.category(c) != 'Mn')).strip('_')


def acquire(name, url, offline=False):
    path = DIRECTORY / 'originales' / name
    if offline:
        content = path.read_bytes()
    else:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'tablero-terremoto/1.0'}), timeout=90) as r:
            content = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + '.tmp')
        temporary.write_bytes(content)
        temporary.replace(path)
    return content, {'file': path.relative_to(ROOT).as_posix(), 'url': url,
                     'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}


def observation(code, dep, mun, source, ident, label, dimension, value, unit, period, locator, download, **extra):
    value = number(value)
    if value is None:
        return None
    level = 'municipal' if len(code) == 5 else 'departamental'
    return {'code': code, 'geo': level + ':' + code, 'lv': level, 'd': dep, 'm': mun,
            'f': source, 'id': ident, 'i': label, 'dim': dimension, 'v': value, 'u': unit,
            'period': period, 'locator': locator, 'download': download, 'external': True,
            'join': 'DIVIPOLA', **extra}


def parse_dane(content):
    import openpyxl
    book = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    refs = list(book['TB_REF'].values)
    departments = {str(r[0]).zfill(2): str(r[1]).title() for r in refs[1:] if r[0] and r[1]}
    # Exact department codes; display spelling uses the existing inventory when available.
    import csv
    inventory = ROOT / 'indicadores_largo_no_calculo.csv'
    if inventory.exists():
        with inventory.open(encoding='utf-8-sig', newline='') as handle:
            for r in csv.DictReader(handle):
                code = r.get('divipola', '')
                if code.isdigit() and len(code) in (2, 5):
                    departments[code[:2]] = r['departamento']
    rows, geo = [], {}
    sheet = '4_IPM Mpio dominios'
    for rownum, r in enumerate(book[sheet].values, 1):
        code = str(r[0])
        if not re.fullmatch(r'\d{5}', code):
            continue
        dep, mun = departments[code[:2]], str(r[1]).title()
        geo[code] = (dep, mun)
        for col, ident, label in [(2, 'total', 'IPM censal total'), (3, 'cabecera', 'IPM censal cabeceras'),
                                  (4, 'rural', 'IPM censal centros poblados y rural disperso')]:
            rows.append(observation(code, dep, mun, 'DANE-CNPV2018', 'dane_ipm_' + ident,
                        label, 'Pobreza multidimensional', r[col], '%', '2018',
                        f'{sheet}!{chr(65+col)}{rownum}', DANE_URL, role='Línea base'))
    sheet = '6_Privaciones IPM Dpt-Mpio'
    values = iter(book[sheet].values)
    next(values)
    headers = next(values)
    if headers[2:4] != ('Analfabetismo', 'Bajo logro educativo'):
        raise ValueError('Cambió la estructura del anexo DANE')
    for rownum, r in enumerate(values, 3):
        code = str(r[0])
        if code not in geo:
            continue
        dep, mun = geo[code]
        for col in range(2, 17):
            label = headers[col]
            rows.append(observation(code, dep, mun, 'DANE-CNPV2018', 'dane_priv_' + slug(label),
                        label, DANE_DIMS[col-2], r[col], '%', '2018',
                        f'{sheet}!{chr(65+col)}{rownum}', DANE_URL, role='Línea base'))
    book.close()
    return [r for r in rows if r is not None], geo, departments


def parse_men(records, geo, period, url):
    rows = []
    seen = set()
    for record in records:
        code = str(record['c_digo_municipio']).zfill(5)
        if code in seen:
            raise ValueError('Municipio duplicado en MEN: ' + code)
        seen.add(code)
        if record['a_o'] != period or not re.fullmatch(r'\d{5}', code):
            raise ValueError('Año o código inesperado en MEN')
        dep, mun = geo.get(code, (record['departamento'], record['municipio']))
        for field, (dimension, name, unit) in MEN_FIELDS.items():
            row = observation(code, dep, mun, 'MEN-Estadisticas', 'men_' + field, name,
                              dimension, record.get(field), unit, period,
                              f'nudc-7mev: a_o={period}; c_digo_municipio={code}; {field}', url, role='Línea base')
            if row:
                rows.append(row)
    return rows


def parse_ops(content, departments):
    from pypdf import PdfReader
    book = PdfReader(io.BytesIO(content))
    reverse = {slug(name): (code, name) for code, name in departments.items()}
    rows, controls = [], []
    specs = [
      (1, 6, [('municipios', 'Municipios afectados', 'Afectación territorial', 'Municipios'),
               ('personas', 'Personas afectadas', 'Personas', 'Personas'),
               ('fallecidos', 'Fallecidos', 'Personas', 'Personas'),
               ('heridos', 'Heridos', 'Personas', 'Personas'),
               ('desaparecidos', 'Desaparecidos', 'Personas', 'Personas'),
               ('rescatados', 'Rescatados', 'Respuesta de rescate', 'Personas')]),
      (2, 1, [('centros_salud', 'Centros de salud afectados (UNGRD)', 'Salud', 'Establecimientos')]),
    ]
    for page_index, width, fields in specs:
        text = book.pages[page_index].extract_text()
        start = text.index('Tabla ' + str(page_index))
        text = text[start:]
        matched, reported_totals = [], None
        for line in text.splitlines():
            m = re.fullmatch(r'(.+?)\s+((?:[\d.]+|-)(?:\s+(?:[\d.]+|-)){' + str(width-1) + r'})\s*', line)
            if not m:
                continue
            name, tokens = m.group(1).strip(), m.group(2).split()
            if name.startswith('Tabla '):
                continue
            vals = [None if token == '-' else int(token.replace('.', '')) for token in tokens]
            if name == 'Total':
                reported_totals = vals
                break
            if slug(name) not in reverse:
                raise ValueError('Departamento desconocido en OPS: ' + name)
            code, dep = reverse[slug(name)]
            matched.append(vals)
            for (ident, label, dim, unit), value in zip(fields, vals):
                row = observation(code, dep, '', 'OPS-Sitrep7', 'ops_' + ident, label, dim, value,
                                  unit, '2026-09-04', f'Página {page_index+1}, tabla {page_index}, {name}',
                                  OPS_URL, role='Reporte del terremoto',
                                  period_note=('Encabezado: 04/09/2026; pie de tabla cita UNGRD 01/09/2026. Fechas discordantes.'
                                               if page_index == 2 else 'UNGRD No. 067; 04/09/2026 06:30, hora de Colombia'))
                if row:
                    rows.append(row)
        if len(matched) != 16 or reported_totals is None:
            raise ValueError(f'Tabla OPS incompleta: página {page_index+1}, {len(matched)} departamentos')
        for i, field in enumerate(fields):
            computed = sum(v[i] for v in matched if v[i] is not None)
            controls.append({'indicator': field[1], 'sum_available': computed,
                             'reported_total': reported_totals[i], 'difference': reported_totals[i] - computed})
    return rows, controls


def build(offline=False):
    artifacts = []
    dane, meta = acquire('dane_ipm_2018.xlsx', DANE_URL, offline); artifacts.append(meta)
    rows, geo, departments = parse_dane(dane)
    metadata, meta = acquire('men_metadata.json', 'https://www.datos.gov.co/api/views/nudc-7mev.json', offline); artifacts.append(meta)
    metadata = json.loads(metadata)
    catalog, meta = acquire('men_catalogo.json', MEN_CATALOG, offline); artifacts.append(meta)
    entries = json.loads(catalog)['results']
    entry = next(e for e in entries if e['resource']['id'] == 'nudc-7mev')
    creator = entry['creator']['display_name']
    if 'ministerio' not in creator.casefold() or 'educaci' not in creator.casefold():
        raise ValueError('El catálogo MEN no acredita al creador esperado: ' + creator)
    # Use the provider's published series, with a single common reference year.
    latest_url = 'https://www.datos.gov.co/resource/nudc-7mev.json?' + urllib.parse.urlencode({'$select': 'max(a_o) as year'})
    latest, meta = acquire('men_latest.json', latest_url, offline); artifacts.append(meta)
    year = str(json.loads(latest)[0]['year'])
    url = 'https://www.datos.gov.co/resource/nudc-7mev.json?' + urllib.parse.urlencode({'$where': f'a_o="{year}"', '$limit': 5000, '$order': 'c_digo_municipio'})
    men, meta = acquire('men_datos.json', url, offline); artifacts.append(meta)
    records = json.loads(men)
    if len(records) == 5000 or len(records) < 1000:
        raise ValueError('Cobertura MEN incompleta o paginación necesaria')
    rows.extend(parse_men(records, geo, year, url))
    ops, meta = acquire('ops_sitrep7_2026-09-04.pdf', OPS_URL, offline); artifacts.append(meta)
    ops_rows, controls = parse_ops(ops, departments); rows.extend(ops_rows)
    _, meta = acquire('oim_alojamientos_2026-08-19.pdf', OIM_URL, offline); artifacts.append(meta)
    metadata_rows_date = datetime.fromtimestamp(metadata['rowsUpdatedAt'], timezone.utc).isoformat()
    sources = {
      'DANE-CNPV2018': {'label': 'DANE · IPM censal 2018', 'kind': 'Línea base municipal', 'url': DANE_PAGE,
        'download': DANE_URL, 'local': 'data/fuentes_nuevas/originales/dane_ipm_2018.xlsx', 'period': '2018',
        'note': 'IPM total, cabeceras y rural; 15 privaciones. Hogares particulares efectivamente censados (CNPV 2018). No mide daños del sismo ni sustituye el IPM de RAPIDA. Geografía censal de 2018: incluye áreas no municipalizadas.'},
      'MEN-Estadisticas': {'label': 'MEN · línea base educativa', 'kind': 'Estadísticas educativas municipales', 'url': MEN_PAGE,
        'download': url, 'local': 'data/fuentes_nuevas/originales/men_datos.json', 'period': year,
        'updated': metadata_rows_date, 'catalog': MEN_CATALOG, 'creator': creator,
        'attribution': metadata.get('attribution'),
        'note': 'Cobertura, permanencia y población escolar del año ' + year + '. Valores de la API en puntos porcentuales: no se multiplican por 100. Una cobertura puede superar 100%. Creador del conjunto: Ministerio de Educación Nacional; el campo atribución del portal identifica Alcaldía de Pitalito y se conserva como discrepancia de metadatos. No mide afectación por el sismo.'},
      'OPS-Sitrep7': {'label': 'OPS/OMS · situación del terremoto', 'kind': 'Tablas departamentales del reporte 7', 'url': OPS_PAGE,
        'download': OPS_URL, 'local': 'data/fuentes_nuevas/originales/ops_sitrep7_2026-09-04.pdf', 'period': '2026-09-04',
        'note': 'Tablas 1 y 2, páginas 2–3. OPS reproduce reportes UNGRD: no es corroboración independiente. Los guiones se tratan como no disponibles. Salud: el encabezado dice 4 de septiembre y el pie cita 1 de septiembre. Se conservan las diferencias entre sumas y totales del documento.'},
    }
    keys = [(r['f'], r['id'], r['geo'], r['period']) for r in rows]
    if len(keys) != len(set(keys)):
        raise ValueError('Identidades duplicadas en nuevas fuentes')
    for r in rows:
        if r['f'] == 'DANE-CNPV2018' and not 0 <= r['v'] <= 100:
            raise ValueError('Porcentaje DANE fuera de rango')
    payload = {'retrieved_at': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'rows': rows,
      'sources': sources, 'artifacts': artifacts, 'checks': controls,
      'documents': [{'label': 'OIM · mapeo de alojamientos colectivos', 'url': OIM_PAGE, 'viewer': OIM_BOARD,
        'download': OIM_URL, 'local': 'data/fuentes_nuevas/originales/oim_alojamientos_2026-08-19.pdf',
        'period': 'Publicación: 2026-08-19; tablero vivo con su propio corte',
        'note': 'Levantamiento desde el 15 de agosto en Valle del Cauca, Risaralda, Caldas y Chocó. Se consulta el tablero original de OIM. El PDF de publicación solo contiene la portada; no se extrajeron cifras municipales.'}]}
    if offline:
        old = DIRECTORY / 'datos.json'
        if old.exists():
            payload['retrieved_at'] = json.loads(old.read_text(encoding='utf-8'))['retrieved_at']
    for r in rows:
        r['date'] = payload['retrieved_at'][:10]
    target = DIRECTORY / 'datos.json'
    temp = target.with_suffix('.tmp')
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    temp.replace(target)
    print(json.dumps({'rows': len(rows), 'by_source': dict(Counter(r['f'] for r in rows)), 'checks': controls}, ensure_ascii=False))
    return payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    build(parser.parse_args().offline)
