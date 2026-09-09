"""Corrige la categoría histórica de 3iS sin alterar sus valores observados."""
import csv
from pathlib import Path


def normalize(row):
    row = dict(row)
    if row.get('fuente') == '3iS-Sheets' and row.get('indicador_id') == '3is_colapsos':
        row['dimension'] = 'Infraestructura'
        row['indicador'] = 'Colapsos de edificaciones (3iS, oficial)'
    return row


def migrate(path):
    path = Path(path)
    if not path.exists():
        return
    with path.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        original = list(reader)
    rows = [normalize(r) for r in original]
    if rows == original:
        return
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


if __name__ == '__main__':
    for name in ('indicadores_largo.csv', 'indicadores_largo_no_calculo.csv', 'historial_indicadores_no_calculo.csv'):
        migrate(name)
