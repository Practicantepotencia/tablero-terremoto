import copy
import unittest
import cepal
from generar_tablero_recuperacion import prepare_payload
from test_tablero_recuperacion import sample


def damage(**changes):
    return dict(id='a', code='66001', sector='Educación', source='Evaluación sectorial',
                locator='Ficha 1', baseline_source='Inventario previo', baseline_locator='Fila 1',
                baseline_date='2026-07-01', observed_at='2026-09-01', attribution='verified',
                attribution_evidence='Inspección comparativa', reviewed_by='Equipo sectorial',
                price_basis='COP constantes julio 2026', effect='damage', agent='local_government',
                currency='COP', coverage_keys=['activo:1'], quantity=2, baseline_quantity=3,
                physical_unit='aulas', unit_price=100, price_date='2026-07-01',
                valuation='equivalent_replacement', preexisting_deficit_excluded=True,
                resilience_upgrade_excluded=True) | changes


def evaluate(*rows):
    return cepal.evaluate({'event_date': '2026-08-10', 'records': rows})


class CepalTests(unittest.TestCase):
    def test_unknown_is_not_zero_and_index_is_not_an_account(self):
        result = evaluate()
        self.assertEqual(result['status'], 'not_evaluated')
        self.assertFalse(result['totals'])
        self.assertTrue(all(a['value'] is None for a in result['accounts'].values()))

    def test_damage_quantity_price_and_observed_zero(self):
        result = evaluate(damage(), damage(id='b', coverage_keys=['activo:2'], quantity=0))
        self.assertEqual([r['amount'] for r in result['records']], [200, 0])
        self.assertEqual(result['totals'][0]['amount'], 200)
        self.assertIsNone(result['accounts']['loss']['value'])

    def test_damage_rejects_post_event_price_deficits_and_unknown_stock(self):
        for change in ({'price_date': '2026-08-10'}, {'baseline_date': '2026-09-01'},
                       {'quantity': 4}, {'unit_price': None}, {'quantity': True},
                       {'preexisting_deficit_excluded': False}, {'resilience_upgrade_excluded': False},
                       {'attribution': 'unverified'}, {'currency': 'USD'}):
            with self.subTest(change=change):
                result = evaluate(damage(**change))
                self.assertFalse(result['records'])
                self.assertTrue(result['issues'])

    def test_deduplicates_exact_copy_rejects_shared_units_between_sources_and_totals(self):
        a = damage()
        self.assertEqual(evaluate(a, copy.deepcopy(a))['deduplicated'], 1)
        for b in (damage(id='b', source='Otra fuente'), damage(id='b', coverage_keys=['activo:1', 'activo:2'])):
            result = evaluate(a, b)
            self.assertFalse(result['records'])
            self.assertEqual(len(result['issues']), 2)

    def test_periods_and_institutional_agents_remain_distinct(self):
        loss = damage(effect='loss', period='2026-08', baseline_flow=100, post_disaster_flow=40,
                      scenario_basis='Proyección sectorial', flow_treatment='lost')
        second = loss | {'id': 'b', 'period': '2026-09', 'post_disaster_flow': 120}
        deferred = loss | {'id': 'c', 'coverage_keys': ['actividad:2'], 'flow_treatment': 'deferred'}
        cost = damage(id='d', effect='additional_cost', period='2026-08', incremental_expenditure=30,
                      expenditure_status='incurred', payer_agent='central_government', excludes_asset_replacement=True)
        result = evaluate(loss, second, deferred, cost)
        self.assertEqual([r['amount'] for r in result['records']], [60, -20, 60, 30])
        self.assertEqual(len(result['totals']), 4)
        self.assertNotIn('total', result)
        self.assertFalse(evaluate(cost | {'expenditure_status': 'planned'})['records'])
        self.assertFalse(evaluate(loss | {'period': '2026-07'})['records'])

    def test_different_price_bases_not_summed(self):
        result = evaluate(damage(), damage(id='b', coverage_keys=['activo:2'], price_basis='COP constantes junio 2026'))
        self.assertEqual(len(result['totals']), 2)

    def test_malformed_record_and_numeric_overflow_are_excluded(self):
        result = evaluate(None, damage(effect=[]), damage(quantity=1e308, baseline_quantity=1e308, unit_price=1e308))
        self.assertFalse(result['records'])
        self.assertEqual(len(result['issues']), 3)

    def test_monetary_import_keeps_value_and_original_label_without_claiming_lost_flows(self):
        row = sample(fuente='PNUD', indicador_id='pnud_tot_cop', indicador='Costo total estimado (COP)',
                     dimension='Pérdidas económicas', unidad='COP', valor='123')
        result = prepare_payload([row])
        actual = result['rows'][0]
        self.assertEqual(actual['v'], 123)
        self.assertEqual(result['cepal']['catalog']['PNUD|pnud_tot_cop']['original_dimension'], 'Pérdidas económicas')
        self.assertEqual(actual['dim'], 'Estimaciones monetarias')
        self.assertIsNone(actual.get('observed_at'))
        self.assertEqual(result['cepal']['catalog']['PNUD|pnud_tot_cop']['status'], 'pending_valuation')
        self.assertFalse(result['cepal']['records'])

    def test_observation_date_is_not_capture_and_conflicting_versions_are_not_silently_selected(self):
        row = sample(fecha_observacion='2026-08-31', version_fuente='v1')
        result = prepare_payload([row])['rows'][0]
        self.assertEqual(result['observed_at'], '2026-08-31')
        self.assertEqual(result['date'], '2026-09-07')
        self.assertFalse(prepare_payload([row, row | {'version_fuente': 'v2'}])['rows'])
        self.assertIsNone(prepare_payload([row | {'fecha_observacion': 'ayer'}])['rows'][0].get('observed_at'))


if __name__ == '__main__':
    unittest.main()
