import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('capacidad', ROOT / 'scripts/reconstruir_capacidad_presion.py')
capacidad = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capacidad)


class CapacidadPresionTests(unittest.TestCase):
    def test_camas_reps_2022_se_reconstruyen_desde_esta_rama(self):
        cfg = json.loads(capacidad.TARGET.read_text(encoding='utf-8'))
        result = capacidad.reconstruct(capacidad.EXTRACT.read_bytes(), cfg)
        self.assertEqual(result['municipalities'], len(cfg['capacity']['rows']))
        self.assertEqual(result['records'], cfg['audit']['records'])

    def test_un_extracto_distinto_se_rechaza(self):
        cfg = json.loads(capacidad.TARGET.read_text(encoding='utf-8'))
        with self.assertRaises(ValueError):
            capacidad.reconstruct(capacidad.EXTRACT.read_bytes() + b' ', cfg)


if __name__ == '__main__':
    unittest.main()
