#!/usr/bin/env python3
"""Tablero unificado. Comparaciones por fuente, indicador, unidad y captura.

Prepara observaciones y línea base para un compuesto con límites por faltantes.
La fecha del inventario nunca se presenta como fecha de observación del sismo.
"""
import argparse
from collections import Counter, defaultdict
import csv
from datetime import date, datetime, timezone
import html
import json
import math
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parent
CURRENT = "indicadores_largo_no_calculo.csv"
HISTORY = "historial_indicadores_no_calculo.csv"
RECOVERY = "undp_rapida_recovery_needs"
IPM = "undp_rapida_mpi"
RAPIDA = "UNDP-RAPIDA"
BASELINE = ROOT / 'data/linea_base_priorizacion.json'
# Equivalencias explícitas por departamento. El código debe existir en DANE.
GEO_ALIASES = {
    ('valle del cauca', 'santiago de cali'): '76001',
    ('valle del cauca', 'cali'): '76001',
    ('valle del cauca', 'anserma nuevo'): '76041',
    ('valle del cauca', 'calima (darien)'): '76126',
    ('choco', 'canton de san pablo'): '27135',
    ('choco', 'carmen de atrato'): '27245',
    ('choco', 'litoral de san juan'): '27250',
}
SOURCES = {
    RAPIDA: {"label": "UNDP · RAPIDA", "kind": "Evaluación y modelación", "url": "https://geosmart.undp.org/arcgis/apps/storymaps/stories/9d0ef01099a64edda2caecbd34135d7e", "note": "Se conservan los valores publicados por PNUD/UNGRD; la cobertura depende del indicador y del ámbito seleccionado. El StoryMap documenta la estructura de pesos de la necesidad de recuperación temprana (50% impactos, 30% vulnerabilidad socioeconómica, 20% vulnerabilidad física) pero no su normalización interna, tratamiento de faltantes ni la combinación exacta de subindicadores -- no alcanza para reproducir el puntaje publicado. Su campo de IPM se describe como proyección de PNUD a 2025 sobre datos DANE, sin metodología de proyección publicada ni confirmación de que corresponda al campo descargado -- no sustituye la línea base DANE censal 2018 de nuestro modelo sin antes validar ambas cosas. Detalle: docs/investigacion_undp_geosmart.md. El puntaje original se consulta sin añadirle IPM."},
    "PNUD": {"label": "PNUD · estimación de daños", "kind": "Estimación", "url": "https://pnudco.github.io/Respuesta-a-crisis-y-recuperaci-n-temprana/", "note": "Vivienda y daño económico coinciden con RAPIDA en la cobertura común auditada. No constituyen corroboración independiente ni se suman entre fuentes."},
    "3iS-Sheets": {"label": "3iS · reportes territoriales", "kind": "Reportes consolidados", "url": "https://docs.google.com/spreadsheets/d/1fQ-LTlIEljzOKvW23epwevJeWLWORi88xL7XxkpTMzY", "note": "Cobertura de reportes por territorio. Su corte operativo no está conservado fila por fila en este inventario."},
    "FundacionExe": {"label": "Fundación ExE · sedes educativas", "kind": "Inventario de sedes", "url": "data/sedes_educativas_afectadas_ago2026.csv", "note": "Necesidades educativas de alcance amplio. Estar dentro de un departamento del decreto no prueba que el daño de cada sede sea causado por el sismo. Fuera de ese ámbito: no atribuida al sismo."},
    "Naboo": {"label": "Naboo · puntos reportados", "kind": "Registro de puntos", "url": "https://www.mapadelterremoto.com/datos/registro.json", "note": "Mide puntos registrados; intensidad de reporte y daño pueden confundirse. Un cero no acredita ausencia de afectación."},
    "Naboo/UNGRD": {"label": "Listado municipal · gravedad", "kind": "Clasificación del listado", "url": "data/municipios_afectados_terremoto_colombia_ago2026.csv", "note": "El valor 0 significa sin clasificación oficial en el listado, no sin daño. Las categorías no son cantidades sumables."},
    "Camaras": {"label": "Cámaras · empresarios", "kind": "Reporte empresarial", "url": "data/camaras_comercio_empresarios_afectados_ago2026.csv", "note": "Cobertura departamental parcial. Empresarios reportados no equivalen a pérdida de producción ni a empleo perdido."},
    "Decreto1171": {"label": "Ámbito del Decreto 1171", "kind": "Marco territorial", "url": "data/decreto_1171_11ago2026.pdf", "note": "Filtro por departamentos nombrados en el inventario. No es una delimitación municipal del daño ni una prueba de atribución causal."},
}


def read_rows(path):
    if not path or not Path(path).exists():
        return []
    with open(path, encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def normalized(value):
    return " ".join("".join(c for c in unicodedata.normalize("NFD", value.strip().casefold())
                             if unicodedata.category(c) != "Mn").split())


def prepare_payload(current, history=()):
    from migrar_clasificacion_3is import normalize
    current = [normalize(r) for r in current]
    history = [normalize(r) for r in history]
    baseline = json.loads(BASELINE.read_text(encoding='utf-8')) if BASELINE.exists() else {'rows': []}
    population_path = ROOT / 'data/poblacion_relativa.json'
    population = json.loads(population_path.read_text(encoding='utf-8')) if population_path.exists() else {'rows': []}
    denominator_path = ROOT / 'data/denominadores_sectoriales.json'
    denominators = json.loads(denominator_path.read_text(encoding='utf-8')) if denominator_path.exists() else {'rows': []}
    reference_names = defaultdict(set)
    reference_codes = {r['code']: r for r in baseline['rows']}
    for r in baseline['rows']:
        reference_names[(normalized(r['d']), normalized(r['m']))].add(r['code'])
    # A current capture replaces the WHOLE capture of that date, including
    # missing sources. Old values must not resurrect a failed download.
    current_dates = {r.get("fecha_corte", "") for r in current}
    raw = [r for r in history if r.get("fecha_corte", "") not in current_dates] + list(current)
    capture_dates = set()
    for r in raw:
        try:
            capture_dates.add(date.fromisoformat(r.get("fecha_corte", "")).isoformat())
        except (TypeError, ValueError):
            pass
    issues = Counter()
    clean = []
    invalid_names = set()
    for r in raw:
        if r.get("fuente") == "Calculo":
            continue
        required = ("nivel", "departamento", "dimension", "indicador_id", "indicador", "unidad", "fuente")
        if any(not r.get(k, "").strip() for k in required) or r.get("nivel") not in {"municipal", "departamental"}:
            issues["Filas sin metadatos obligatorios"] += 1
            continue
        if r["nivel"] == "municipal" and not r.get("municipio", "").strip():
            issues["Municipios sin nombre"] += 1
            continue
        try:
            value = float(r["valor"])
            if not math.isfinite(value) or value < 0:
                raise ValueError()
            date.fromisoformat(r.get("fecha_corte", ""))
        except (KeyError, TypeError, ValueError):
            issues["Valor o fecha de captura inválidos"] += 1
            continue
        if r["indicador_id"] == IPM and value > 100:
            issues["IPM fuera de 0–100"] += 1
            continue
        code = r.get("divipola", "").strip()
        expected = 5 if r["nivel"] == "municipal" else 2
        code = code if code.isdigit() and len(code) == expected else ""
        original_code = code
        if r['nivel'] == 'municipal':
            name_key = (normalized(r['departamento']), normalized(r['municipio']))
            known = reference_names.get(name_key, set())
            alias = GEO_ALIASES.get(name_key)
            resolved = alias if alias in reference_codes else next(iter(known), '') if len(known) == 1 else ''
            if code and resolved and code != resolved:
                issues['Código incompatible con la referencia DANE'] += 1
                invalid_names.add(name_key)
                continue
            code = code or resolved
        clean.append({"lv": r["nivel"], "d": r["departamento"].strip(), "m": r.get("municipio", "").strip(),
                      "dim": r["dimension"], "id": r["indicador_id"], "i": r["indicador"],
                      "u": r["unidad"], "f": r["fuente"], "v": value,
                      "date": r["fecha_corte"], "code": code,
                      "identity_note": 'Equivalencia municipal explícita' if r['nivel']=='municipal' and name_key in GEO_ALIASES else 'Referencia DANE' if code and not original_code else ''})
    # Only unambiguous codes are shared between spelling-normalized names.
    codes = defaultdict(set)
    for r in clean:
        if r["code"]:
            codes[(r["lv"], normalized(r["d"]), normalized(r["m"]))].add(r["code"])
    grouped = defaultdict(list)
    for r in clean:
        key = (r["lv"], normalized(r["d"]), normalized(r["m"]))
        if r['lv']=='municipal' and key[1:] in invalid_names:
            issues['Filas con identidad geográfica ambigua'] += 1
            continue
        known = codes[key]
        if len(known) > 1:
            issues["Filas con identidad geográfica ambigua"] += 1
            continue
        code = next(iter(known), "")
        r["geo"] = r["lv"] + ":" + (code or "|".join(key[1:]))
        r["join"] = "DIVIPOLA" if code else "Departamento + municipio normalizados"
        r["code"] = code
        # Same entity/indicator/source/date may not silently select a unit.
        grouped[(r["geo"], r["f"], r["id"], r["date"])].append(r)
    rows = []
    for group in grouped.values():
        variants = {(r["v"], r["u"], r["dim"], r["i"]) for r in group}
        if len(variants) > 1:
            issues["Observaciones conflictivas excluidas"] += len(group)
            continue
        issues["Copias idénticas deduplicadas"] += len(group) - 1
        rows.append(group[0])
    rows.sort(key=lambda r: (r["date"], r["f"], r["id"], r["geo"]))
    dates = sorted(capture_dates)
    latest = max((d for d in current_dates if d in dates), default=dates[-1] if dates else "")
    return {"rows": rows, "dates": dates, "latest": latest, "sources": SOURCES, "baseline": baseline, "population": population, "denominators": denominators,
            "issues": [{"label": k, "n": v} for k, v in sorted(issues.items()) if v],
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def build_html(current, history=()):
    payload = prepare_payload(current, history)
    template = (ROOT / "web" / "tablero.html").read_text(encoding="utf-8")
    for marker, filename in (("__STYLE__", "tablero.css"), ("__MODEL__", "modelo.js"), ("__DENOMINATORS__", "denominadores.js"), ("__PRIORITY_MODEL__", "priorizacion.js"), ("__RADAR__", "radar.js"), ("__RELATIVE__", "relativo.js"), ("__COMPARISON__", "comparacion.js"), ("__APP__", "tablero.js")):
        template = template.replace(marker, (ROOT / "web" / filename).read_text(encoding="utf-8"))
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return template.replace("__DATA__", data.replace("<", "\\u003c"))


def generate(input_path=CURRENT, history_path=HISTORY, out="index.html", eda_redirect="eda_indicadores.html", update_history=False):
    current, history = read_rows(input_path), read_rows(history_path)
    if not current:
        raise ValueError(f"No hay inventario para generar el tablero: {input_path}")
    if update_history:
        # Retain the raw schema, and replace complete capture dates atomically.
        dates = {r.get("fecha_corte", "") for r in current}
        history = [r for r in history if r.get("fecha_corte", "") not in dates] + current
        target = Path(history_path)
        temporary = target.with_suffix(target.suffix + ".tmp")
        with temporary.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(current[0]), lineterminator="\n")
            writer.writeheader()
            writer.writerows(history)
        temporary.replace(target)
    output = Path(out)
    output.write_text(build_html(current, history), encoding="utf-8")
    if eda_redirect and Path(eda_redirect).resolve() != output.resolve():
        import os
        url = Path(os.path.relpath(output, Path(eda_redirect).parent)).as_posix()
        safe = html.escape(url, quote=True)
        Path(eda_redirect).write_text(f'<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={safe}"><title>Tablero territorial</title><p>El EDA y el índice se integraron en el <a href="{safe}">tablero territorial</a>.</p></html>', encoding="utf-8")
    return output


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", default=CURRENT)
    ap.add_argument("--history", default=HISTORY)
    ap.add_argument("--out", default="index.html")
    ap.add_argument("--eda-redirect", default="eda_indicadores.html")
    ap.add_argument("--update-history", action="store_true")
    args = ap.parse_args()
    output = generate(args.input, args.history, args.out, args.eda_redirect, args.update_history)
    print(f"Tablero unificado generado: {output}")


if __name__ == "__main__":
    main()

