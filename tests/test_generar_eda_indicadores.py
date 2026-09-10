import csv
import tempfile
import unittest
from pathlib import Path

import generar_eda_indicadores as eda
import actualizar_indice_terremoto as indice


def sample(value="12.5", date="2026-09-04"):
    return {
        "divipola": "27001", "nivel": "municipal", "departamento": "Chocó",
        "municipio": "Quibdó", "dimension": "Vulnerabilidad",
        "indicador_id": "undp_rapida_mpi", "indicador": "IPM", "unidad": "Índice",
        "fuente": "UNDP-RAPIDA", "valor": value, "fecha_corte": date,
    }


class EdaTests(unittest.TestCase):
    def test_decree_departments_come_from_normative_indicator(self):
        rows = [
            {**sample(), "departamento": "Chocó", "municipio": "", "nivel": "departamental", "indicador_id": "en_decreto_1171", "valor": "1"},
            {**sample(), "departamento": "Córdoba", "municipio": "", "nivel": "departamental", "indicador_id": "en_decreto_1171", "valor": "0"},
        ]
        self.assertEqual(eda.decree_departments(rows), ["Chocó"])

    def test_history_builds_decree_only_series(self):
        rows = [sample("10"), {**sample("20"), "departamento": "Córdoba", "municipio": "Lorica"}]
        history = eda.history_summary(rows, ["Chocó"])
        decree = [r for r in history if r["departamento"] == "__DECRETO__"]
        self.assertEqual(len(decree), 1)
        self.assertEqual(decree[0]["mediana"], 10)

    def test_audit_accepts_clean_numeric_row(self):
        report = eda.audit([sample()])
        counts = {c["check"]: c["count"] for c in report["checks"]}
        self.assertEqual(counts["Valores no numéricos"], 0)
        self.assertEqual(counts["IPM fuera de 0–100"], 0)

    def test_history_replaces_same_key_and_date(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "history.csv"
            eda.update_history(path, [sample("10")])
            rows = eda.update_history(path, [sample("20")])
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["valor"], "20")

    def test_history_keeps_distinct_dates(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "history.csv"
            eda.update_history(path, [sample("10", "2026-09-04")])
            rows = eda.update_history(path, [sample("20", "2026-09-05")])
            self.assertEqual(len(rows), 2)

    def test_export_preserves_municipal_divipola_and_date(self):
        with tempfile.TemporaryDirectory() as tmp:
            full = Path(tmp) / "full.csv"
            raw = Path(tmp) / "raw.csv"
            indice.export_formato_largo(
                [], [], full, no_calculo_csv_path=raw,
                datos_undp_por_municipio={
                    ("Chocó", "Quibdó"): {"mpi": 12.5, "_divipola": "27001"}
                },
            )
            with raw.open(encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            self.assertEqual(rows[0]["divipola"], "27001")
            self.assertTrue(rows[0]["fecha_corte"])


if __name__ == "__main__":
    unittest.main()


