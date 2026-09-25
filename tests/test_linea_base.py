import hashlib
import importlib.util
import json
import unittest

import preparar_linea_base_priorizacion as linea_base


class LineaBaseTests(unittest.TestCase):
    def setUp(self):
        self.raw = linea_base.ORIGINAL.read_bytes()
        self.payload = json.loads(linea_base.TARGET.read_text(encoding='utf-8'))

    def test_original_file_is_the_audited_dane_annex(self):
        digest = hashlib.sha256(self.raw).hexdigest()
        self.assertEqual(digest, linea_base.SHA256)
        self.assertEqual(self.payload['artifacts'], [{'file': 'data/originales/dane_ipm_2018.xlsx', 'url': linea_base.URL,
                                                      'sha256': digest, 'bytes': len(self.raw)}])

    @unittest.skipUnless(importlib.util.find_spec('openpyxl'), 'openpyxl no instalado')
    def test_reference_is_reproduced_from_the_annex(self):
        self.assertEqual(linea_base.extract(self.raw), self.payload['rows'])


if __name__ == '__main__':
    unittest.main()
