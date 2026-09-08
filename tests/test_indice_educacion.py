import unittest

import generar_indice_educacion as educacion


def row(indicator_id, value, municipality="Quibdó", department="Chocó", level="municipal", dimension="Educación"):
    return {
        "divipola": ("27001" if municipality == "Quibdó" else "27361") if level == "municipal" else "27",
        "nivel": level,
        "departamento": department,
        "municipio": municipality if level == "municipal" else "",
        "dimension": dimension,
        "indicador_id": indicator_id,
        "indicador": indicator_id,
        "unidad": "Número",
        "fuente": "Prueba",
        "valor": str(value),
        "fecha_corte": "2026-09-08",
    }


class EducationIndexTests(unittest.TestCase):
    def test_uses_exactly_eight_equal_weight_municipal_variables(self):
        self.assertEqual(len(educacion.MUNICIPAL_INDICATORS), 8)
        self.assertEqual(len(set(educacion.MUNICIPAL_INDICATORS)), 8)

    def test_midrank_percentile_handles_ties(self):
        self.assertAlmostEqual(educacion.percentile_midrank([0, 0, 10], 0), 100 / 3)
        self.assertAlmostEqual(educacion.percentile_midrank([0, 0, 10], 10), 250 / 3)

    def test_score_rewards_coverage_without_treating_missing_as_observed_zero(self):
        rows = [
            row("pnud_cedu", 10),
            row("pnud_edu_cop", 20),
            row("pnud_cedu", 0, "Istmina"),
            row("pnud_edu_cop", 0, "Istmina"),
            row("3is_educativos", 30, "Istmina"),
        ]
        profiles = {item["municipality"]: item for item in educacion.build_index(rows)}
        quibdo = profiles["Quibdó"]
        self.assertEqual(quibdo["observed"], 2)
        self.assertEqual(quibdo["coverage"], 2 / 8)
        self.assertAlmostEqual(quibdo["score"], sum(
            variable["percentile"] for variable in quibdo["variables"].values()
        ) / 8)
        self.assertNotIn("3is_educativos", quibdo["variables"])

    def test_explicitly_includes_undp_education_even_when_dimension_is_infrastructure(self):
        selected = educacion.education_rows([
            row("undp_rapida_bdg_edu_aff", 3, dimension="Infraestructura"),
            row("3is_acueductos", 99, dimension="Infraestructura"),
        ])
        self.assertEqual([item["indicador_id"] for item in selected], ["undp_rapida_bdg_edu_aff"])

    def test_department_naboo_is_inventory_only(self):
        rows = [row("educacion_n", 7, level="departamental")]
        self.assertEqual(len(educacion.education_rows(rows)), 1)
        self.assertEqual(educacion.build_index(rows), [])

    def test_html_contains_method_and_embedded_payload(self):
        html = educacion.build_html([row("pnud_cedu", 10)])
        self.assertIn("Índice =", html)
        self.assertIn("application/json", html)
        self.assertNotIn("return 'Sin dato\"", html)


if __name__ == "__main__":
    unittest.main()

