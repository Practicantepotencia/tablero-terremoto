"""Verifica el JSON contra cada celda del anexo sin dependencias externas en CI."""
import hashlib
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


class FiscalTests(unittest.TestCase):
    def test_snapshot_matches_official_workbook_cell_by_cell(self):
        data = json.loads((ROOT / 'data/idf_municipal_2023.json').read_text(encoding='utf-8'))
        source = ROOT / data['file']
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), data['sha256'])
        self.assertEqual(len(data['rows']), 1102)
        self.assertEqual(len({r['code'] for r in data['rows']}), 1102)
        with zipfile.ZipFile(source) as book:
            strings = [''.join(e.itertext()) for e in ET.fromstring(book.read('xl/sharedStrings.xml')).findall('s:si', NS)]
            cells = ET.fromstring(book.read('xl/worksheets/sheet2.xml')).findall('.//s:c', NS)
            def value(cell):
                v = cell.find('s:v', NS)
                if v is None:
                    return None
                return strings[int(v.text)] if cell.get('t') == 's' else float(v.text)
            values = {c.get('r'): value(c) for c in cells}
            self.assertEqual(values['AE7'], 'Nuevo IDF')
            for row in data['rows']:
                line = row['cell'][2:]
                self.assertEqual(row['code'], str(values['A' + line]))
                self.assertEqual(row['value'], values[row['cell']])
                self.assertEqual(row['year'], 2023)
                self.assertTrue(0 <= row['value'] <= 100)
        pereira = next(r for r in data['rows'] if r['code'] == '66001')
        self.assertAlmostEqual(pereira['value'], 75.23225403040647)


if __name__ == '__main__':
    unittest.main()
