"""Comprobaciones del notebook sin requerir acceso a red ni entrenar modelos.

Ejecutar: python -m unittest discover -s tests -p "test_notebook_salud.py" -v
Las pruebas numéricas sintéticas se omiten si NumPy no está instalado.
No sustituye ejecutar el notebook completo con sus datos congelados.
"""
import ast
import json
from pathlib import Path
import unittest
import warnings

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "notebooks" / "salud_urgencias_ml_paso_a_paso.ipynb"


class NotebookSaludTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        cls.codes = ["".join(c["source"]) for c in cls.nb["cells"] if c["cell_type"] == "code"]

    def test_notebook_structure_and_honest_outputs(self):
        self.assertEqual(self.nb["nbformat"], 4)
        self.assertEqual(self.nb["nbformat_minor"], 5)
        ids = [c["id"] for c in self.nb["cells"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(self.nb["metadata"]["source_commit"],
                         "a350ca6591174542e76b08d108e4d4e15c629b4c")
        for cell in self.nb["cells"]:
            if cell["cell_type"] == "code":
                self.assertIsNone(cell["execution_count"])
                self.assertEqual(cell["outputs"], [])

    def test_python_syntax_every_code_cell(self):
        for i, code in enumerate(self.codes):
            with self.subTest(code_cell=i):
                ast.parse(code, filename=f"notebook-cell-{i}")

    def test_no_implicit_install_or_export(self):
        joined = "\n".join(self.codes)
        self.assertIn("EXPORTAR = False", joined)
        self.assertNotIn("subprocess", joined)
        self.assertNotIn("os.system", joined)
        self.assertIn("if EXPORTAR:", joined)
        self.assertIn("destino.mkdir(exist_ok=False)", joined)

    def test_synthetic_poisson_and_metrics(self):
        try:
            import numpy as np
        except ImportError:
            self.skipTest("NumPy no instalado; sintaxis y estructura sí se verifican.")
        namespace = {"np": np, "warnings": warnings}
        wanted = {"ajustar_poisson", "metricas"}
        for code in self.codes:
            tree = ast.parse(code)
            for node in tree.body:
                if isinstance(node, ast.FunctionDef) and node.name in wanted:
                    module = ast.Module(body=[node], type_ignores=[])
                    exec(compile(ast.fix_missing_locations(module), "<function>", "exec"), namespace)
        fitted = namespace["ajustar_poisson"](np.zeros((40, 2)), np.full(40, 3.))
        self.assertTrue(fitted["converged"])
        self.assertAlmostEqual(float(np.exp(fitted["beta"][0])), 3., places=7)
        self.assertAlmostEqual(namespace["metricas"]([1, 100], [2, 200])["mean_absolute_log_error"],
                               float(np.log(2)), places=7)
        self.assertEqual(namespace["metricas"]([1, 2, 3], [1, 2, 3])["r2"], 1.)

    def test_revision_has_four_methods_and_targeted_selection(self):
        joined = "\n".join(self.codes)
        for method in ["siempre_1", "mediana_comparables", "poisson_demografia", "poisson_capacidades"]:
            self.assertIn(method, joined)
        self.assertIn('mascara & grupo_principal(frame)', joined)
        self.assertIn('ancla_nueva = p["presion_nueva"].max()', joined)
        self.assertIn('bootstrap_departamentos', joined)
        self.assertEqual(self.nb["metadata"]["revision"]["version"], 2)
        self.assertFalse(self.nb["metadata"]["revision"]["dashboard_modified"])



if __name__ == "__main__":
    unittest.main()
