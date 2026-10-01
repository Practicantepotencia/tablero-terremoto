import json
import unittest
from pathlib import Path

from scripts.preparar_educacion_men import aggregate, count

ROOT = Path(__file__).resolve().parents[1]


class MenTests(unittest.TestCase):
    def record(self, **kwargs):
        return dict(code='66001', d='Risaralda', m='Pereira', site='166001000001',
                    institution='166001000001', damage='colapso parcial',
                    enrollment=30, service='yes', zone='urbana', **kwargs)

    def test_numeric_text_is_parsed_without_filling_blanks(self):
        self.assertEqual(count(' 17 '),17)
        for value in ['', 'sin dato', '-1', True, 1.5]:
            self.assertIsNone(count(value))

    def test_duplicate_site_requires_reconciliation(self):
        with self.assertRaisesRegex(ValueError, 'duplicado'):
            aggregate([self.record(), self.record()])

    def test_critical_and_operating_are_independent(self):
        r = aggregate([self.record()])[0]
        self.assertEqual(r['critical_enrollment'], 30)
        self.assertEqual(r['critical_service_yes_sites'], 1)
        self.assertEqual(r['service_no_enrollment'], 0)

    def test_missing_enrollment_or_classification_is_not_zero(self):
        for change in [{'enrollment': None}, {'damage': ''}]:
            r = self.record(); r.update(change)
            self.assertIsNone(aggregate([r])[0]['critical_enrollment'])
        r = self.record(); r['damage'] = 'afectacion menor'
        self.assertEqual(aggregate([r])[0]['critical_enrollment'], 0)

    def test_real_delivery_control_totals_and_five_department_gaps(self):
        data = json.loads((ROOT/'data/educacion_men.json').read_text('utf-8'))
        self.assertEqual(data['totals']['reported_sites'], 5537)
        self.assertEqual(data['totals']['critical_enrollment'], 187505)
        self.assertEqual(data['totals']['service_no_sites'], 28)
        self.assertEqual(data['totals']['critical_service_yes_sites'], 987)
        self.assertEqual(data['source']['sha256'], 'eaa1342470b270fd3e5880da44378f24a673947d3657fb628bec2ad7d105d781')
        roster = {r['code'] for r in data['roster']}
        rows = [r for r in data['municipalities'] if r['code'] in roster]
        self.assertEqual((len(roster),len(rows)), (126,121))
        self.assertEqual(sum(r['reported_sites'] for r in rows),3113)
        self.assertEqual(sum(r['enrollment'] for r in rows),570091)
        self.assertEqual(sum(r['critical_enrollment'] for r in rows),149471)
        self.assertEqual(roster-{r['code'] for r in rows}, {'27006','27495','27660','66075','66456'})
        self.assertEqual(sum(r['unclassified_sites'] for r in rows),0)

    def test_context_keeps_distinct_units_and_overlap(self):
        sources=json.loads((ROOT/'data/fuentes_educacion_contexto.json').read_text('utf-8'))['sources']
        icbf,pei,pereira,plan=sources
        total=lambda s,k:sum(r.get(k,0) for r in s['municipalities'])
        self.assertEqual((total(icbf,'units'), total(icbf,'beneficiaries_reported'),total(icbf,'missing_beneficiaries')),(3448,79676,174))
        self.assertEqual((total(pei,'units'),total(pei,'men_matches'),total(pei,'damage_disagreements'),total(pei,'enrollment_disagreements')),(172,172,84,148))
        self.assertEqual((total(pereira,'records'),total(pereira,'units')),(102,63))
        self.assertEqual((total(plan,'records'),total(plan,'units'),total(plan,'men_matches')),(16,12,12))
        self.assertTrue(all(s['source_date'] is None for s in sources))
