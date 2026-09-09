import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch
from contextlib import ExitStack, redirect_stdout, redirect_stderr
import io
import os

import actualizar_indice_terremoto as updater

import generar_tablero_recuperacion as tablero


def sample(**changes):
    row = dict(nivel="municipal", departamento="Chocó", municipio="Quibdó", divipola="27001",
               dimension="Recuperación", indicador_id=tablero.RECOVERY, indicador="Recuperación",
               fuente=tablero.RAPIDA, unidad="Índice", valor="0.6", fecha_corte="2026-09-07")
    return {**row, **changes}


class PreparationTests(unittest.TestCase):
    def test_zero_is_retained_missing_and_invalid_excluded(self):
        result = tablero.prepare_payload([sample(valor="0"), sample(municipio="B", valor=""), sample(municipio="C", valor="nan")])
        self.assertEqual([r["v"] for r in result["rows"]], [0])
        self.assertTrue(result["issues"])

    def test_capture_replaces_whole_snapshot_without_resurrecting_source(self):
        history = [sample(fuente="PNUD"), sample(fecha_corte="2026-09-06", fuente="PNUD")]
        result = tablero.prepare_payload([sample()], history)
        self.assertEqual({r["f"] for r in result["rows"] if r["date"] == "2026-09-07"}, {tablero.RAPIDA})
        self.assertEqual(len(result["dates"]), 2)

    def test_conflicting_duplicate_is_excluded_not_selected_or_summed(self):
        result = tablero.prepare_payload([sample(), sample(valor="0.8")])
        self.assertEqual(result["rows"], [])

    def test_exact_duplicate_is_counted_once(self):
        result = tablero.prepare_payload([sample(), sample()])
        self.assertEqual(len(result["rows"]), 1)

    def test_distinct_units_are_not_merged(self):
        result = tablero.prepare_payload([sample(), sample(unidad="Porcentaje")])
        self.assertEqual(result["rows"], [])

    def test_homonyms_remain_distinct(self):
        result = tablero.prepare_payload([sample(divipola="", municipio="Armenia"), sample(divipola="", municipio="Armenia", departamento="Quindío")])
        self.assertEqual(len({r["geo"] for r in result["rows"]}), 2)

    def test_accent_normalization_uses_unambiguous_code(self):
        result = tablero.prepare_payload([sample(), sample(municipio="QUIBDO", divipola="", fuente="PNUD")])
        self.assertEqual(len({r["geo"] for r in result["rows"]}), 1)
        self.assertTrue(all(r["code"] == "27001" for r in result["rows"]))

    def test_ambiguous_identity_is_not_joined(self):
        result = tablero.prepare_payload([sample(), sample(divipola="27002", fuente="PNUD")])
        self.assertEqual(result["rows"], [])

    def test_missing_date_does_not_become_today(self):
        self.assertEqual(tablero.prepare_payload([sample(fecha_corte="")])["rows"], [])

    def test_cali_alias_joins_reports_and_rapida_without_changing_values(self):
        result = tablero.prepare_payload([
            sample(departamento='Valle del Cauca', municipio='Cali', divipola='',
                   fuente='3iS-Sheets', indicador_id='3is_colapsos', dimension='Infraestructura',
                   indicador='Colapsos de edificaciones', unidad='Número', valor='515'),
            sample(departamento='Valle del Cauca', municipio='Santiago de Cali', divipola='76001')])
        self.assertEqual({r['geo'] for r in result['rows']}, {'municipal:76001'})
        self.assertEqual(next(r['v'] for r in result['rows'] if r['id']=='3is_colapsos'),515)

    def test_baseline_only_territories_do_not_expand_damage_universe(self):
        result=tablero.prepare_payload([sample()])
        self.assertEqual(len({r['geo'] for r in result['rows']}),1)
        self.assertGreater(len(result['baseline']['rows']),1000)

    def test_invalid_current_snapshot_is_not_replaced_by_older_valid_values(self):
        result = tablero.prepare_payload([sample(valor="nan")], [sample(fecha_corte="2026-09-06")])
        self.assertEqual(result["latest"], "2026-09-07")
        self.assertFalse(any(r["date"] == result["latest"] for r in result["rows"]))

    def test_html_escapes_script_content_and_excludes_legacy_scores(self):
        source = tablero.build_html([sample(indicador="</script><script>alert(1)</script>"), sample(fuente="Calculo", indicador_id="indice_compuesto")])
        data = json.loads(re.search(r"const DATA=(.*?);</script>", source).group(1))
        self.assertEqual(len(data["rows"]), 1)
        self.assertNotIn("<script>alert(1)", source)
        self.assertEqual(source.count('role="tabpanel"'), 3)
        self.assertNotIn("__DATA__", source)

    def test_generate_preserves_raw_input_and_history_by_default(self):
        import csv
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ("input.csv", "history.csv"):
                with (root / name).open("w", encoding="utf-8", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=list(sample()))
                    writer.writeheader()
                    writer.writerow(sample())
            before = [(root / name).read_bytes() for name in ("input.csv", "history.csv")]
            tablero.generate(root / "input.csv", root / "history.csv", root / "index.html", root / "eda_indicadores.html")
            self.assertEqual(before, [(root / name).read_bytes() for name in ("input.csv", "history.csv")])
            self.assertIn('url=index.html', (root / "eda_indicadores.html").read_text(encoding="utf-8"))

    def test_default_update_generates_unified_dashboard_without_cascade_or_naboo(self):
        mocks = {
            "load_dep_population": {"Chocó": 1000}, "load_municipios": [], "load_resumen_meta": {},
            "load_historial_previo": (None, {}), "load_empresarios_afectados": {},
            "load_3is_datos_territoriales": (None, {}, None, {}), "load_sedes_educativas_afectadas": {},
            "load_pnud_perdidas_economicas": ({}, {}),
            "load_undp_geosmart_rapida": ({}, {("Chocó", "Quibdó"): {"recovery_needs": .6, "mpi": 12, "_divipola": "27001"}}),
        }
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            previous = os.getcwd()
            os.chdir(tmp)
            stack.callback(os.chdir, previous)
            for name, value in mocks.items():
                stack.enter_context(patch.object(updater, name, return_value=value))
            stack.enter_context(patch.object(updater, "load_registro", side_effect=OSError("offline")))
            cascade = stack.enter_context(patch.object(updater, "compute_indice_ajustado", side_effect=AssertionError("Cascada inesperada")))
            stack.enter_context(patch("sys.argv", ["actualizar_indice_terremoto.py"]))
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                updater.main()
            cascade.assert_not_called()
            source = Path("index.html").read_text(encoding="utf-8")
            self.assertIn('id="prioridades"', source)
            raw = tablero.read_rows(tablero.CURRENT)
            self.assertTrue(any(r["indicador_id"] == tablero.RECOVERY for r in raw))
            self.assertFalse(any(r["fuente"] == "Naboo" for r in raw))
            self.assertFalse(Path("indice_ajustado_municipio.csv").exists())
            self.assertFalse(Path("historial_indice.csv").exists())


if __name__ == "__main__":
    unittest.main()
