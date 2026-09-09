#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera un EDA autocontenido del inventario crudo de indicadores.

No calcula ni reemplaza el índice de impacto. Su propósito es hacer visibles
la cobertura, las necesidades sectoriales, la vulnerabilidad previa (IPM),
los rankings y las limitaciones de comparabilidad de las fuentes.
Los selectores conservan el indicador activo al cambiar el universo territorial.
"""
import argparse
import csv
import html
import json
import math
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from migrar_clasificacion_3is import normalize


CURRENT_DEFAULT = "indicadores_largo_no_calculo.csv"
FULL_DEFAULT = "indicadores_largo.csv"
HISTORY_DEFAULT = "historial_indicadores_no_calculo.csv"
OUTPUT_DEFAULT = "eda_indicadores.html"
DECREE_INDICATOR_ID = "en_decreto_1171"
FIELDS = [
    "divipola", "nivel", "departamento", "municipio", "dimension",
    "indicador_id", "indicador", "unidad", "fuente", "valor", "fecha_corte",
]


def read_csv(path):
    if not path or not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [normalize(r) for r in csv.DictReader(f)]


def as_number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def row_key(row, include_date=True):
    fields = ["nivel", "departamento", "municipio", "indicador_id", "fuente"]
    if include_date:
        fields.append("fecha_corte")
    return tuple(row.get(k, "") for k in fields)


def enrich_current(rows, full_rows):
    """Recupera DIVIPOLA/fecha del CSV completo para snapshots antiguos."""
    by_key = {row_key(r, include_date=False): r for r in full_rows if r.get("fuente") != "Calculo"}
    fallback_date = next((r.get("fecha_corte") for r in full_rows if r.get("fecha_corte")), None)
    fallback_date = fallback_date or datetime.now(timezone.utc).date().isoformat()
    enriched = []
    for source in rows:
        r = dict(source)
        match = by_key.get(row_key(r, include_date=False), {})
        code = str(r.get("divipola") or match.get("divipola", "")).strip()
        # Los snapshots antiguos repetían el código departamental de dos
        # dígitos en filas municipales. Es preferible vacío a una llave falsa.
        if r.get("nivel") == "municipal" and len(code) != 5:
            code = ""
        if r.get("nivel") == "departamental" and code:
            code = code.zfill(2)
        r["divipola"] = code
        r["fecha_corte"] = r.get("fecha_corte") or match.get("fecha_corte") or fallback_date
        for field in FIELDS:
            r.setdefault(field, "")
        enriched.append({field: r.get(field, "") for field in FIELDS})
    return enriched


def write_csv(path, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def update_history(path, current):
    previous = read_csv(path)
    merged = {row_key(r): {field: r.get(field, "") for field in FIELDS} for r in previous}
    for r in current:
        merged[row_key(r)] = {field: r.get(field, "") for field in FIELDS}
    rows = sorted(merged.values(), key=lambda r: (r["fecha_corte"], r["nivel"], r["departamento"], r["municipio"], r["indicador_id"], r["fuente"]))
    write_csv(path, rows)
    return rows


def percentile(values, value):
    clean = sorted(v for v in values if v is not None)
    if not clean:
        return None
    if len(clean) == 1:
        return 50.0
    below = sum(v < value for v in clean)
    equal = sum(v == value for v in clean)
    return 100.0 * (below + 0.5 * equal) / len(clean)


def decree_departments(rows):
    """Departamentos nombrados por el indicador normativo del inventario."""
    return sorted({
        r.get("departamento", "") for r in rows
        if r.get("indicador_id") == DECREE_INDICATOR_ID
        and as_number(r.get("valor")) == 1
        and r.get("departamento")
    })


def audit(rows):
    required = set(FIELDS)
    numeric_bad = [r for r in rows if as_number(r.get("valor")) is None]
    duplicate_keys = [k for k, n in Counter(row_key(r) for r in rows).items() if n > 1]
    municipal_missing = [r for r in rows if r.get("nivel") == "municipal" and not r.get("municipio")]
    dep_with_mun = [r for r in rows if r.get("nivel") == "departamental" and r.get("municipio")]
    negative = [r for r in rows if (as_number(r.get("valor")) or 0) < 0]
    invalid_level = [r for r in rows if r.get("nivel") not in {"municipal", "departamental"}]
    municipal_missing_code = {
        (r["departamento"], r["municipio"]) for r in rows
        if r.get("nivel") == "municipal" and len(r.get("divipola", "")) != 5
    }
    metadata = defaultdict(lambda: {"dimension": set(), "unidad": set(), "indicador": set()})
    for r in rows:
        for k in metadata[r["indicador_id"]]:
            metadata[r["indicador_id"]][k].add(r[k])
    metadata_conflicts = [
        i for i, groups in metadata.items() if any(len(v) > 1 for v in groups.values())
    ]
    ipm = [as_number(r["valor"]) for r in rows if r["indicador_id"] == "undp_rapida_mpi"]
    ipm = [v for v in ipm if v is not None]
    ipm_out = [v for v in ipm if v < 0 or v > 100]
    decree = set(decree_departments(rows))
    fexe_outside = {
        (r["departamento"], r["municipio"]) for r in rows
        if r.get("nivel") == "municipal"
        and r.get("fuente") == "FundacionExe"
        and r.get("departamento") not in decree
    }

    coverage = []
    for source in sorted({r["fuente"] for r in rows}):
        subset = [r for r in rows if r["fuente"] == source]
        coverage.append({
            "fuente": source,
            "filas": len(subset),
            "indicadores": len({r["indicador_id"] for r in subset}),
            "departamentos": len({r["departamento"] for r in subset}),
            "municipios": len({(r["departamento"], r["municipio"]) for r in subset if r["nivel"] == "municipal"}),
        })

    findings = [
        {"severity": "alta", "title": "El snapshot no contiene una serie temporal", "detail": "El inventario actual representa un solo corte. La vista de evolución solo será concluyente cuando el historial acumule dos o más fechas."},
        {"severity": "alta", "title": "Cobertura territorial desigual", "detail": "Cada fuente observa universos distintos. Los vacíos no equivalen a cero y los rankings solo comparan territorios con dato para el indicador elegido."},
        {"severity": "alta", "title": "PNUD y UNDP-RÁPIDA no son evidencia independiente", "detail": "En los municipios compartidos, viviendas destruidas y averiadas coinciden exactamente; el daño total coincide salvo redondeos de 1 COP. No deben sumarse ni ponderarse como fuentes separadas."},
        {"severity": "media", "title": "El IPM es municipal, pero parcial", "detail": f"Hay {len(ipm)} observaciones de IPM, concentradas en el área evaluada por UNDP-RÁPIDA. Sirve como línea base de vulnerabilidad para esos municipios, no como censo nacional completo."},
        {"severity": "media", "title": "El archivo de fuentes crudas perdía trazabilidad", "detail": "La versión anterior omitía DIVIPOLA y fecha_corte. Esta implementación conserva ambas columnas y abre un historial deduplicado por corte."},
        {"severity": "media", "title": "Las categorías de edificaciones pueden superponerse", "detail": "No existe microdato por edificio que permita verificar exclusividad. El EDA no suma categorías para crear un total de edificaciones afectadas."},
        {"severity": "alta", "title": "ExE incluye necesidades educativas no atribuibles al sismo", "detail": f"Hay {len(fexe_outside)} municipios de FundacionExe fuera de los departamentos nombrados en el Decreto 1171. Se conservan en el inventario crudo, pero el EDA los marca como no atribuidos al sismo."},
        {"severity": "baja", "title": "Los nombres municipales no son llaves únicas", "detail": "Municipios homónimos existen en varios departamentos. Todas las comparaciones usan departamento + municipio y, cuando está disponible, DIVIPOLA."},
    ]
    checks = [
        {"check": "Valores no numéricos", "count": len(numeric_bad), "status": "OK" if not numeric_bad else "REVISAR"},
        {"check": "Claves duplicadas por corte", "count": len(duplicate_keys), "status": "OK" if not duplicate_keys else "REVISAR"},
        {"check": "Municipios sin nombre", "count": len(municipal_missing), "status": "OK" if not municipal_missing else "REVISAR"},
        {"check": "Filas departamentales con municipio", "count": len(dep_with_mun), "status": "OK" if not dep_with_mun else "REVISAR"},
        {"check": "Valores negativos", "count": len(negative), "status": "OK" if not negative else "REVISAR"},
        {"check": "Nivel geográfico inválido", "count": len(invalid_level), "status": "OK" if not invalid_level else "REVISAR"},
        {"check": "Municipios sin DIVIPOLA de 5 dígitos", "count": len(municipal_missing_code), "status": "OK" if not municipal_missing_code else "REVISAR"},
        {"check": "Indicadores con metadatos inconsistentes", "count": len(metadata_conflicts), "status": "OK" if not metadata_conflicts else "REVISAR"},
        {"check": "IPM fuera de 0–100", "count": len(ipm_out), "status": "OK" if not ipm_out else "REVISAR"},
    ]
    return {"checks": checks, "coverage": coverage, "findings": findings}


def quantile(values, q):
    vals = sorted(v for v in values if v is not None)
    if not vals:
        return None
    pos = (len(vals) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return vals[lo] if lo == hi else vals[lo] * (hi - pos) + vals[hi] * (pos - lo)


def summarize(rows, history):
    municipal_geo = {(r["departamento"], r["municipio"]) for r in rows if r["nivel"] == "municipal"}
    dep_geo = {r["departamento"] for r in rows if r["nivel"] == "departamental"}
    ipm_rows = [r for r in rows if r["indicador_id"] == "undp_rapida_mpi"]
    ipm_vals = [as_number(r["valor"]) for r in ipm_rows]
    ipm_vals = [v for v in ipm_vals if v is not None]
    return {
        "filas": len(rows),
        "indicadores": len({r["indicador_id"] for r in rows}),
        "fuentes": len({r["fuente"] for r in rows}),
        "municipios": len(municipal_geo),
        "departamentos": len(dep_geo),
        "ipm_n": len(ipm_vals),
        "ipm_mediana": quantile(ipm_vals, .5),
        "ipm_q75": quantile(ipm_vals, .75),
        "fechas": sorted({r.get("fecha_corte", "") for r in history if r.get("fecha_corte")}),
    }


def history_summary(history, decree=None):
    decree = set(decree or [])
    groups = defaultdict(list)
    for r in history:
        value = as_number(r.get("valor"))
        if value is None:
            continue
        key = (r.get("fecha_corte", ""), r["nivel"], r["departamento"], r["dimension"], r["indicador_id"], r["indicador"], r["unidad"], r["fuente"])
        groups[key].append(value)
        if r["nivel"] == "municipal":
            all_key = (r.get("fecha_corte", ""), r["nivel"], "__ALL__", r["dimension"], r["indicador_id"], r["indicador"], r["unidad"], r["fuente"])
            groups[all_key].append(value)
            if r.get("departamento") in decree:
                decree_key = (r.get("fecha_corte", ""), r["nivel"], "__DECRETO__", r["dimension"], r["indicador_id"], r["indicador"], r["unidad"], r["fuente"])
                groups[decree_key].append(value)
    out = []
    for key, vals in groups.items():
        ordered = sorted(vals)
        median = quantile(ordered, .5)
        out.append(dict(zip(["fecha", "nivel", "departamento", "dimension", "indicador_id", "indicador", "unidad", "fuente"], key), total=sum(vals), mediana=median, n=len(vals)))
    return out


def compact_rows(rows):
    out = []
    for r in rows:
        value = as_number(r.get("valor"))
        if value is None:
            continue
        out.append({
            "lv": r["nivel"], "d": r["departamento"], "m": r["municipio"],
            "dim": r["dimension"], "id": r["indicador_id"], "i": r["indicador"],
            "u": r["unidad"], "f": r["fuente"], "v": value,
            "date": r.get("fecha_corte", ""), "code": r.get("divipola", ""),
        })
    return out


def build_html(rows, history, report=None, summary=None):
    """Compatibilidad: el EDA ahora utiliza la vista territorial unificada."""
    from generar_tablero_recuperacion import build_html as unified_html
    return unified_html(rows, history)


def main():
    from pathlib import Path
    from generar_tablero_recuperacion import generate
    ap = argparse.ArgumentParser(description="Genera el tablero unificado de recuperación y diagnóstico.")
    ap.add_argument("--input", default=CURRENT_DEFAULT)
    ap.add_argument("--full", default=FULL_DEFAULT, help="Compatibilidad; no se reconstruyen fechas faltantes")
    ap.add_argument("--history", default=HISTORY_DEFAULT)
    ap.add_argument("--out", default="index.html")
    ap.add_argument("--no-history-update", action="store_true")
    args = ap.parse_args()
    out = Path(args.out)
    # Legacy automation calling --out eda_indicadores.html still reaches the
    # one canonical dashboard instead of recreating a second navigation.
    target = out.with_name("index.html") if out.name == "eda_indicadores.html" else out
    redirect = target.with_name("eda_indicadores.html")
    generate(args.input, args.history, str(target), str(redirect), not args.no_history_update)
    print(f"Tablero unificado OK -> {target}")


if __name__ == "__main__":
    main()


