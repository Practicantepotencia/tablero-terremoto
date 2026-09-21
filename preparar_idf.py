"""Extrae el Nuevo IDF municipal 2023 del anexo original del DNP, sin redondear.

Uso: python preparar_idf.py
El XLSX se conserva en data/fuentes; no requiere descargarlo en cada actualización.
"""
import hashlib
import json
import math
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'data/fuentes/ResultadosIDF_Nueva_MetodologIa_2023_Act.xlsx'
OUTPUT = ROOT / 'data/idf_municipal_2023.json'
URL = 'https://colaboracion.dnp.gov.co/CDT/Desarrollo%20Territorial/Desempeno_Fiscal/ResultadosIDF_Nueva_MetodologIa_2023_Act.xlsx'
PAGE = 'https://www.dnp.gov.co/LaEntidad_/subdireccion-general-descentralizacion-desarrollo-territorial/direccion-descentralizacion-fortalecimiento-fiscal/Paginas/informacion-fiscal-y-financiera.aspx'


def extract(path=SOURCE):
    book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = book['Municipios 2023']
        header = [str(c.value or '').strip() for c in sheet[7]]
        columns = {name: header.index(name) for name in ['Código', 'Departamento', 'Municipio', 'Nuevo IDF']}
        rows, codes = [], set()
        for line, cells in enumerate(sheet.iter_rows(min_row=8, values_only=True), 8):
            raw = cells[columns['Código']]
            if raw is None or not str(raw).strip().isdigit():
                continue  # Notas al pie, no registros municipales.
            code = str(raw).strip().zfill(5)
            value = cells[columns['Nuevo IDF']]
            if len(code) != 5 or code in codes:
                raise ValueError(f'Código inválido o repetido en fila {line}: {code}')
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100:
                raise ValueError(f'Nuevo IDF inválido en fila {line}: {value!r}')
            codes.add(code)
            rows.append({'code': code, 'd': cells[columns['Departamento']],
                         'm': cells[columns['Municipio']], 'value': value, 'year': 2023,
                         'cell': f'AE{line}'})
        if len(rows) != 1102:
            raise ValueError(f'Cambió la cobertura del anexo: {len(rows)} (esperados 1102)')
        return {'label': 'DNP · Nuevo IDF municipal 2023', 'year': 2023, 'unit': 'Índice 0–100',
                'url': URL, 'page': PAGE, 'sheet': 'Municipios 2023', 'column': 'Nuevo IDF',
                'downloaded': '2026-09-21', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'file': SOURCE.relative_to(ROOT).as_posix(), 'rows': sorted(rows, key=lambda r: r['code'])}
    finally:
        book.close()


if __name__ == '__main__':
    result = extract()
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(result["rows"])} municipios → {OUTPUT.name}; SHA256 {result["sha256"]}')
