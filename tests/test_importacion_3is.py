import io
import unittest
from unittest.mock import patch
import actualizar_indice_terremoto as app
from migrar_clasificacion_3is import normalize


class Importacion3isTests(unittest.TestCase):
    def test_september_is_later_than_august_after_full_module_import(self):
        self.assertGreater(app._clave_orden_corte('8 Sep 06:30'), app._clave_orden_corte('30 Ago 18:30'))
        self.assertEqual(app._clave_orden_corte('8  sep 06:30'), (9, 8, 6, 30))

    def test_live_shape_selects_latest_cut_separately_per_level(self):
        csv = ('Reporte,Nivel,Departamento,Municipio,Colapsos,VivAveriadas,VivDestruidas\n'
               '30 Ago 18:30,Municipio,Valle del Cauca,Cali,422,,\n'
               '8 Sep 06:30,Municipio,Valle del Cauca,Cali,515,,0\n'
               '7 Sep 06:30,Departamento,Valle del Cauca,,600,10,0\n')
        with patch.object(app.urllib.request, 'urlopen', return_value=io.BytesIO(csv.encode())):
            dep_cut, deps, mun_cut, munis = app.load_3is_datos_territoriales('https://example.org/test.csv')
        self.assertEqual(dep_cut, '7 Sep 06:30')
        self.assertEqual(mun_cut, '8 Sep 06:30')
        cali = munis['Valle del Cauca', 'Cali']
        self.assertEqual(cali['Colapsos'], 515)
        self.assertIsNone(cali['VivAveriadas'])
        self.assertEqual(cali['VivDestruidas'], 0)

    def test_missing_invalid_and_nonfinite_counts_are_not_zero(self):
        for raw in ('', None, 'N/D', 'nan', 'inf', '-1'):
            self.assertIsNone(app._valores_3is({'Colapsos': raw})['Colapsos'])
        self.assertEqual(app._valores_3is({'Colapsos': '0'})['Colapsos'], 0)

    def test_outage_cannot_publish_a_successful_empty_source(self):
        with patch.object(app.urllib.request, 'urlopen', side_effect=OSError('offline')):
            with self.assertRaises(RuntimeError):
                app.load_3is_datos_territoriales('https://example.org/test.csv')
        self.assertEqual(app.load_3is_datos_territoriales(None), (None, {}, None, {}))

    def test_partial_housing_is_not_a_complete_total_in_cascade(self):
        self.assertEqual(app._cascada_valor_y_fuente('x', [('3iS', {'x': {'a': None, 'b': 4}}, ['a', 'b'])]), (None, None))
        self.assertEqual(app._cascada_valor_y_fuente('x', [('3iS', {'x': {'a': 0, 'b': 0}}, ['a', 'b'])]), (0, '3iS'))

    def test_reclassification_preserves_values_and_housing_categories(self):
        row = {'fuente': '3iS-Sheets', 'indicador_id': '3is_colapsos', 'dimension': 'Vivienda', 'valor': '422', 'fecha_corte': '2026-09-08'}
        updated = normalize(row)
        self.assertEqual(updated['dimension'], 'Infraestructura')
        self.assertEqual(updated['valor'], '422')
        self.assertEqual(updated['fecha_corte'], row['fecha_corte'])
        self.assertEqual(app.DIMENSION_3IS_POR_CAMPO['Colapsos'], 'Infraestructura')
        self.assertEqual(app.DIMENSION_3IS_POR_CAMPO['VivAveriadas'], 'Vivienda')
