"""Unit checks and reproducible checks against the downloaded provider originals."""
import hashlib
import json
import unittest

import actualizar_fuentes_nuevas as sources


class ImportRules(unittest.TestCase):
    def test_zero_is_data_but_dash_null_nan_and_negative_are_not(self):
        self.assertEqual(sources.number('0'), 0)
        for value in ('-', None, '', 'NaN', '-1'):
            self.assertIsNone(sources.number(value))

    def test_men_rates_are_already_percentage_points(self):
        record = {'c_digo_municipio': '76001', 'a_o': '2024', 'departamento': 'Valle del Cauca',
                  'municipio': 'Cali', 'cobertura_neta': '78.77', 'deserci_n': '0'}
        rows = sources.parse_men([record], {}, '2024', 'https://www.datos.gov.co/d/nudc-7mev')
        self.assertEqual({r['id']: r['v'] for r in rows}, {'men_cobertura_neta': 78.77, 'men_deserci_n': 0})
        self.assertTrue(all(r['period'] == '2024' and r['external'] for r in rows))
        with self.assertRaises(ValueError):
            sources.parse_men([record, record], {}, '2024', '')
        with self.assertRaises(ValueError):
            sources.parse_men([record], {}, '2023', '')


@unittest.skipUnless((sources.DIRECTORY / 'datos.json').exists(), 'Run the downloader to check provider originals')
class OriginalSourceChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = json.loads((sources.DIRECTORY / 'datos.json').read_text(encoding='utf-8'))

    def test_all_downloaded_originals_match_published_manifest_hashes(self):
        for artifact in self.pack['artifacts']:
            content = (sources.ROOT / artifact['file']).read_bytes()
            self.assertEqual(len(content), artifact['bytes'])
            self.assertEqual(hashlib.sha256(content).hexdigest(), artifact['sha256'])

    def test_dane_and_ops_reproduce_original_tables(self):
        originals = sources.DIRECTORY / 'originales'
        dane, geo, departments = sources.parse_dane((originals / 'dane_ipm_2018.xlsx').read_bytes())
        self.assertEqual(len(geo), 1122)
        armenia = next(r for r in dane if r['code'] == '63001' and r['id'] == 'dane_ipm_total')
        self.assertEqual(armenia['v'], 14.4)
        self.assertEqual(armenia['locator'], '4_IPM Mpio dominios!C821')
        ops, checks = sources.parse_ops((originals / 'ops_sitrep7_2026-09-04.pdf').read_bytes(), departments)
        health = {r['code']: r['v'] for r in ops if r['id'] == 'ops_centros_salud'}
        self.assertEqual(health['76'], 103)
        self.assertEqual(health['54'], 0)  # Explicit zero in the original table.
        self.assertFalse(any(r['code'] == '66' and r['id'] == 'ops_personas' for r in ops))  # Dash, not zero.
        self.assertEqual(next(c['difference'] for c in checks if c['indicator'] == 'Desaparecidos'), 1)
        self.assertEqual(sum(health.values()), 400)
        self.assertTrue(all('Fechas discordantes' in r['period_note'] for r in ops if r['id'] == 'ops_centros_salud'))
        actual = [{k: v for k, v in r.items() if k != 'date'} for r in self.pack['rows'] if r['f'] in ('DANE-CNPV2018', 'OPS-Sitrep7')]
        self.assertEqual(actual, dane + ops)

    def test_men_reproduces_the_saved_api_response(self):
        records = json.loads((sources.DIRECTORY / 'originales/men_datos.json').read_text(encoding='utf-8'))
        info = self.pack['sources']['MEN-Estadisticas']
        rows = sources.parse_men(records, {}, info['period'], info['download'])
        self.assertEqual(len(records), 1122)
        expected = {(r['code'], r['id']): r['v'] for r in self.pack['rows'] if r['f'] == 'MEN-Estadisticas'}
        self.assertEqual(expected, {(r['code'], r['id']): r['v'] for r in rows})
        if info['period'] == '2024':
            self.assertEqual(expected['76001', 'men_cobertura_neta'], 78.77)


if __name__ == '__main__':
    unittest.main()
