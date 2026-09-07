#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera un EDA autocontenido del inventario crudo de indicadores.

No calcula ni reemplaza el índice de impacto. Su propósito es hacer visibles
la cobertura, las necesidades sectoriales, la vulnerabilidad previa (IPM),
los rankings y las limitaciones de comparabilidad de las fuentes.
"""
import argparse
import csv
import html
import json
import math
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone


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
        return list(csv.DictReader(f))


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


def build_html(rows, history, report, summary):
    decree = decree_departments(rows)
    payload = {
        "rows": compact_rows(rows),
        "history": history_summary(history, decree),
        "decree_departments": decree,
        "audit": report,
        "summary": summary,
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return TEMPLATE.replace("__PAYLOAD__", data)


TEMPLATE = r'''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EDA territorial — indicadores del terremoto</title>
<style>
:root{--bg:#f3f1ec;--paper:#fff;--ink:#17201d;--muted:#63706b;--line:#d8ddd9;--green:#0e6655;--green2:#2a9d78;--gold:#d69e2e;--red:#b84a3a;--blue:#2f6eaa;--soft:#eaf3ef}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 Inter,Segoe UI,Arial,sans-serif}.wrap{max-width:1440px;margin:auto;padding:28px}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.eyebrow{text-transform:uppercase;letter-spacing:.13em;color:var(--green);font-weight:800;font-size:11px}.top h1{font-size:34px;line-height:1.08;margin:6px 0 8px;max-width:880px}.lede{color:var(--muted);max-width:860px;margin:0}.back{color:var(--green);text-decoration:none;border:1px solid var(--line);padding:9px 12px;border-radius:10px;background:var(--paper);white-space:nowrap}.tabs{display:flex;gap:7px;flex-wrap:wrap;margin:24px 0 18px}.tab{border:1px solid var(--line);background:var(--paper);padding:10px 14px;border-radius:999px;cursor:pointer;font-weight:700;color:var(--muted)}.tab.active{background:var(--green);color:#fff;border-color:var(--green)}.panel[hidden]{display:none}.grid{display:grid;gap:14px}.kpis{grid-template-columns:repeat(6,minmax(0,1fr));margin:14px 0}.card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 8px 25px rgba(36,45,41,.04)}.kpi .label{color:var(--muted);font-size:12px}.kpi .value{font-size:27px;font-weight:800;margin:5px 0}.kpi .sub{font-size:11px;color:var(--muted)}.section-title{display:flex;justify-content:space-between;align-items:end;gap:12px;margin:20px 0 10px}.section-title h2{margin:0;font-size:21px}.section-title p{margin:0;color:var(--muted)}.filters{grid-template-columns:repeat(6,minmax(135px,1fr));position:sticky;top:8px;z-index:4}.field label{display:block;color:var(--muted);font-size:11px;font-weight:700;margin-bottom:5px}.field select,.field input{width:100%;padding:9px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink)}.two{grid-template-columns:minmax(0,1.45fr) minmax(300px,.75fr)}.three{grid-template-columns:repeat(3,minmax(0,1fr))}.rank-row{display:grid;grid-template-columns:32px minmax(145px,1fr) minmax(110px,2fr) 110px;gap:9px;align-items:center;padding:7px 0;border-bottom:1px solid #edf0ed}.rank-pos{font-weight:800;color:var(--muted)}.bar{height:10px;background:#edf0ed;border-radius:999px;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,var(--green2),var(--green));border-radius:999px}.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}.note{padding:12px 14px;border-left:4px solid var(--gold);background:#fff8e6;border-radius:8px;color:#5b4b23}.muted{color:var(--muted)}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:9px 8px;border-bottom:1px solid #e8ece9;text-align:left;vertical-align:top}th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0;background:#fff}td.r{text-align:right;font-variant-numeric:tabular-nums}.scroll{overflow:auto;max-height:590px}.badge{display:inline-block;padding:3px 8px;border-radius:999px;font-weight:700;font-size:10px}.alta{background:#fde8e4;color:#973628}.media{background:#fff3d6;color:#875e00}.baja,.OK{background:#e5f4ec;color:#0d674e}.REVISAR{background:#fde8e4;color:#973628}.finding{border-top:1px solid var(--line);padding:12px 0}.finding:first-child{border-top:0}.finding h3{font-size:14px;margin:5px 0}.finding p{margin:0;color:var(--muted)}svg{width:100%;height:430px;background:#fbfcfb;border-radius:12px;border:1px solid var(--line)}.axis{stroke:#aeb7b2;stroke-width:1}.dot{fill:var(--green);fill-opacity:.58;stroke:#fff;stroke-width:1}.dot.high{fill:var(--red)}.quadrant{fill:#f8e7e4;opacity:.6}.chart-label{font-size:11px;fill:#64716b}.empty{padding:50px;text-align:center;color:var(--muted)}.profile-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.metric-row{display:grid;grid-template-columns:minmax(210px,1.4fr) 100px 1fr 72px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #edf0ed}.pct{font-size:11px;color:var(--muted);text-align:right}.trend{min-height:320px}.trend svg{height:280px}.footer{color:var(--muted);font-size:11px;margin-top:28px;padding-top:15px;border-top:1px solid var(--line)}@media(max-width:1000px){.kpis{grid-template-columns:repeat(3,1fr)}.filters{grid-template-columns:repeat(3,1fr)}.two,.three{grid-template-columns:1fr}}@media(max-width:600px){.wrap{padding:16px}.top{display:block}.back{display:inline-block;margin-top:12px}.kpis{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr 1fr}.rank-row{grid-template-columns:28px 1fr 80px}.rank-row .bar{display:none}.metric-row{grid-template-columns:1fr 80px}.metric-row .bar,.pct{display:none}}
</style><style>.scope{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:18px}.scope .field{min-width:310px}.scope p{margin:0}@media(max-width:600px){.scope{display:block}.scope .field{min-width:0;margin-bottom:8px}}</style></head><body><div class="wrap">
<header class="top"><div><div class="eyebrow">Respuesta territorial · Colombia</div><h1>EDA de necesidades, afectación y vulnerabilidad previa</h1><p class="lede">Explora indicadores crudos por territorio y fuente. Los valores faltantes no se convierten en cero; los percentiles se calculan solo entre territorios con dato comparable.</p></div><a class="back" href="index.html">← Volver al índice</a></header>
<nav class="tabs"><button class="tab active" data-tab="resumen">Resumen</button><button class="tab" data-tab="rankings">Rankings</button><button class="tab" data-tab="perfil">Perfil territorial</button><button class="tab" data-tab="ipm">Recuperación e IPM</button><button class="tab" data-tab="calidad">Calidad y cobertura</button></nav>
<div class="card scope"><div class="field"><label>Universo territorial</label><select id="territory-scope"><option value="all">Todos los departamentos</option><option value="decree">Solo departamentos del Decreto 1171</option></select></div><p id="scope-note" class="muted"></p></div>

<section id="resumen" class="panel"><div id="summary-kpis" class="grid kpis"></div><div class="grid two"><div class="card"><div class="section-title"><div><h2>Cobertura por dimensión</h2><p>Observaciones y territorios distintos.</p></div></div><div id="dimension-table" class="scroll"></div></div><div class="card"><h2>Lectura correcta</h2><div class="note">El tablero describe magnitudes y brechas de cobertura. No suma indicadores con unidades distintas ni trata dos fuentes coincidentes como evidencia independiente.</div><div id="headline-findings"></div></div></div></section>

<section id="rankings" class="panel" hidden><div class="card grid filters"><div class="field"><label>Nivel</label><select id="rank-level"><option value="municipal">Municipal</option><option value="departamental">Departamental</option></select></div><div class="field"><label>Dimensión</label><select id="rank-dim"></select></div><div class="field"><label>Indicador</label><select id="rank-indicator"></select></div><div class="field"><label>Departamento</label><select id="rank-dept"></select></div><div class="field"><label>Orden</label><select id="rank-order"><option value="desc">Mayor valor</option><option value="asc">Menor valor</option></select></div><div class="field"><label>Buscar territorio</label><input id="rank-search" placeholder="Nombre"></div></div><div class="grid two"><div class="card"><div class="section-title"><div><h2 id="rank-title">Ranking</h2><p id="rank-sub"></p></div></div><div id="ranking"></div></div><div class="card"><h2>Distribución</h2><div id="rank-stats"></div><h2 style="margin-top:24px">Interpretación</h2><p class="muted">Un ranking alto expresa una magnitud alta del indicador seleccionado. No equivale automáticamente a prioridad: revise cobertura, población expuesta, IPM y necesidades de recuperación.</p></div></div></section>

<section id="perfil" class="panel" hidden><div class="card"><div class="profile-head"><div><h2>Ficha territorial</h2><p class="muted">Cada barra es un percentil dentro del mismo indicador y nivel.</p></div><div class="field" style="min-width:320px"><label>Territorio</label><select id="profile-territory"></select></div></div><div id="profile"></div></div></section>

<section id="ipm" class="panel" hidden><div id="ipm-kpis" class="grid kpis"></div><div class="card grid filters" style="grid-template-columns:repeat(2,minmax(180px,1fr))"><div class="field"><label>Resultado para contrastar con IPM</label><select id="ipm-outcome"></select></div><div class="field"><label>Departamento</label><select id="ipm-dept"></select></div></div><div id="ipm-method-note" class="note" style="margin:14px 0"></div><div class="grid two"><div class="card"><h2>Vulnerabilidad previa vs. necesidad/afectación</h2><p id="scatter-note" class="muted"></p><div id="scatter"></div></div><div class="card"><h2>Ranking por resultado</h2><p class="muted">El orden usa únicamente el resultado seleccionado. El IPM se muestra como contexto y no se suma de nuevo cuando el resultado es RAPIDA.</p><div id="priority" class="scroll"></div></div></div><div class="card trend"><div class="section-title"><div><h2>Evolución</h2><p>Mediana municipal del indicador por fecha de corte.</p></div></div><div id="trend"></div></div></section>

<section id="calidad" class="panel" hidden><div class="grid two"><div class="card"><h2>Hallazgos de auditoría</h2><div id="audit-findings"></div></div><div class="card"><h2>Controles automáticos</h2><div id="audit-checks"></div></div></div><div class="card"><h2>Cobertura por fuente</h2><div id="coverage-table" class="scroll"></div></div><div class="card"><h2>Diccionario observado</h2><div id="dictionary" class="scroll"></div></div></section>
<div class="footer">Generado desde <code>indicadores_largo_no_calculo.csv</code>. El IPM se presenta como porcentaje/índice 0–100 reportado por UNDP‑RÁPIDA y solo para su zona evaluada. Consulte la auditoría metodológica del repositorio antes de usar rankings para asignación de recursos.</div>
</div><script>const DATA=__PAYLOAD__;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uniq=a=>[...new Set(a)].sort((x,y)=>String(x).localeCompare(String(y),'es'));
const fmt=(v,u='')=>{if(v==null||!isFinite(v))return '—';if(u==='COP')return new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1}).format(v)+' COP';if(u==='km'||u==='m³')return new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(v)+' '+u;return new Intl.NumberFormat('es-CO',{maximumFractionDigits:2}).format(v)};
const q=(a,p)=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;let x=(a.length-1)*p,l=Math.floor(x),h=Math.ceil(x);return l===h?a[l]:a[l]*(h-x)+a[h]*(x-l)};
const pct=(a,v)=>{a=a.filter(Number.isFinite);if(!a.length)return 50;let less=a.filter(x=>x<v).length,eq=a.filter(x=>x===v).length;return 100*(less+.5*eq)/a.length};
const territory=r=>r.lv==='municipal'?`${r.m}, ${r.d}`:r.d;
const decreeSet=new Set(DATA.decree_departments||[]);
const inScope=r=>$('#territory-scope').value!=='decree'||decreeSet.has(r.d);
const viewRows=()=>DATA.rows.filter(inScope);
const attribution=r=>r.f==='FundacionExe'&&!decreeSet.has(r.d)?' <span class="badge media">no atribuida al sismo</span>':'';
function table(headers,rows){return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`}
function opts(el,values,all){el.innerHTML=(all?`<option value="">${all}</option>`:'')+values.map(v=>`<option value="${v.replaceAll('&','&amp;').replaceAll('"','&quot;')}">${v}</option>`).join('')}
$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.panel').forEach(p=>p.hidden=p.id!==b.dataset.tab)});

function renderSummary(){let zall=viewRows(),mun=new Set(zall.filter(r=>r.lv==='municipal').map(r=>`${r.d}|${r.m}`)),ipm=zall.filter(r=>r.id==='undp_rapida_mpi'),dates=DATA.summary.fechas;$('#summary-kpis').innerHTML=[['Observaciones',zall.length.toLocaleString('es-CO'),'filas crudas en el universo'],['Indicadores',new Set(zall.map(r=>r.id)).size,'sin derivados'],['Fuentes',new Set(zall.map(r=>r.f)).size,'coberturas distintas'],['Municipios',mun.size,'pares departamento–municipio'],['Municipios con IPM',ipm.length,'zona UNDP‑RÁPIDA'],['Cortes históricos',dates.length,dates.length<2?'evolución aún no disponible':'serie disponible']].map(x=>`<div class="card kpi"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join('');let dims=uniq(zall.map(r=>r.dim));let rows=dims.map(d=>{let z=zall.filter(r=>r.dim===d),t=new Set(z.map(territory));return `<tr><td><b>${d}</b></td><td class="r">${z.length.toLocaleString('es-CO')}</td><td class="r">${t.size.toLocaleString('es-CO')}</td><td class="r">${new Set(z.map(r=>r.id)).size}</td></tr>`});$('#dimension-table').innerHTML=table(['Dimensión','Observaciones','Territorios','Indicadores'],rows);$('#headline-findings').innerHTML=DATA.audit.findings.slice(0,4).map(f=>`<div class="finding"><span class="badge ${f.severity}">${f.severity}</span><h3>${f.title}</h3><p>${f.detail}</p></div>`).join('')}

function indicatorsFor(level,dim){return uniq(viewRows().filter(r=>r.lv===level&&(!dim||r.dim===dim)).map(r=>r.id))}
function setRankIndicators(){let level=$('#rank-level').value,dim=$('#rank-dim').value,ids=indicatorsFor(level,dim);let prev=$('#rank-indicator').value;$('#rank-indicator').innerHTML=ids.map(id=>{let r=DATA.rows.find(x=>x.id===id);return `<option value="${id}">${r.i} · ${r.f}</option>`}).join('');if(ids.includes(prev))$('#rank-indicator').value=prev;renderRanking()}
function renderRanking(){let level=$('#rank-level').value,id=$('#rank-indicator').value,dep=$('#rank-dept').value,search=$('#rank-search').value.toLowerCase(),order=$('#rank-order').value;let z=viewRows().filter(r=>r.lv===level&&r.id===id&&(!dep||r.d===dep)&&(!search||territory(r).toLowerCase().includes(search)));z.sort((a,b)=>(order==='desc'?b.v-a.v:a.v-b.v)||territory(a).localeCompare(territory(b),'es'));let meta=z[0]||DATA.rows.find(r=>r.id===id),vals=z.map(r=>r.v),max=Math.max(...vals,1);$('#rank-title').textContent=meta?meta.i:'Ranking';$('#rank-sub').textContent=meta?`${meta.u} · ${meta.f} · ${z.length} territorios con dato`:'';$('#ranking').innerHTML=z.length?z.slice(0,40).map((r,i)=>`<div class="rank-row"><span class="rank-pos">${i+1}</span><span>${territory(r)}${attribution(r)}</span><div class="bar"><div class="fill" style="width:${100*r.v/max}%"></div></div><span class="num">${fmt(r.v,r.u)}</span></div>`).join(''):'<div class="empty">Sin datos para estos filtros.</div>';$('#rank-stats').innerHTML=vals.length?table(['Estadístico','Valor'],[['Mínimo',fmt(Math.min(...vals),meta.u)],['Mediana',fmt(q(vals,.5),meta.u)],['Promedio',fmt(vals.reduce((a,b)=>a+b,0)/vals.length,meta.u)],['Máximo',fmt(Math.max(...vals),meta.u)],['Con dato',vals.length.toLocaleString('es-CO')]].map(x=>`<tr><td>${x[0]}</td><td class="r"><b>${x[1]}</b></td></tr>`)):'<p class="muted">Sin distribución.</p>'}
function initRanking(){let base=viewRows(),dims=uniq(base.filter(r=>r.lv==='municipal').map(r=>r.dim));opts($('#rank-dim'),dims);opts($('#rank-dept'),uniq(base.filter(r=>r.lv==='municipal').map(r=>r.d)),'Todos');['#rank-level','#rank-dim'].forEach(s=>$(s).onchange=()=>{if(s==='#rank-level'){let lv=$('#rank-level').value;opts($('#rank-dim'),uniq(viewRows().filter(r=>r.lv===lv).map(r=>r.dim)));opts($('#rank-dept'),uniq(viewRows().filter(r=>r.lv===lv).map(r=>r.d)),'Todos')}setRankIndicators()});['#rank-indicator','#rank-dept','#rank-order'].forEach(s=>$(s).onchange=renderRanking);$('#rank-search').oninput=renderRanking;setRankIndicators()}

function initProfile(){let territories=uniq(viewRows().map(territory));opts($('#profile-territory'),territories);$('#profile-territory').onchange=renderProfile;renderProfile()}
function renderProfile(){let t=$('#profile-territory').value,z=viewRows().filter(r=>territory(r)===t);z.sort((a,b)=>a.dim.localeCompare(b.dim,'es')||a.i.localeCompare(b.i,'es'));$('#profile').innerHTML=z.length?z.map(r=>{let peers=viewRows().filter(x=>x.lv===r.lv&&x.id===r.id).map(x=>x.v),p=pct(peers,r.v);return `<div class="metric-row"><div><b>${r.i}</b>${attribution(r)}<div class="muted">${r.dim} · ${r.f}</div></div><div class="num">${fmt(r.v,r.u)}</div><div class="bar"><div class="fill" style="width:${p}%"></div></div><div class="pct">P${Math.round(p)}</div></div>`}).join(''):'<div class="empty">Sin indicadores.</div>'}

function joinIpm(outcome,dep){let base=viewRows(),ipm=new Map(base.filter(r=>r.id==='undp_rapida_mpi'&&(!dep||r.d===dep)).map(r=>[`${r.d}|${r.m}`,r]));return base.filter(r=>r.id===outcome&&r.lv==='municipal'&&(!dep||r.d===dep)).map(r=>({x:ipm.get(`${r.d}|${r.m}`),y:r})).filter(o=>o.x)}
function initIpm(){let base=viewRows(),candidates=uniq(base.filter(r=>r.lv==='municipal'&&r.id!=='undp_rapida_mpi').map(r=>r.id));$('#ipm-outcome').innerHTML=candidates.map(id=>{let r=base.find(x=>x.id===id);return `<option value="${id}">${r.i} · ${r.f}</option>`}).join('');let preferred=['undp_rapida_recovery_needs','undp_rapida_pop_imp','undp_rapida_econ_dmg_total_cop'];$('#ipm-outcome').value=preferred.find(x=>candidates.includes(x))||candidates[0];opts($('#ipm-dept'),uniq(base.filter(r=>r.id==='undp_rapida_mpi').map(r=>r.d)),'Todos');['#ipm-outcome','#ipm-dept'].forEach(s=>$(s).onchange=renderIpm);renderIpm()}
function renderIpm(){let id=$('#ipm-outcome').value,dep=$('#ipm-dept').value,pairs=joinIpm(id,dep),xs=pairs.map(o=>o.x.v),ys=pairs.map(o=>o.y.v),xq=q(xs,.75),yq=q(ys,.75),meta=pairs[0]?.y||DATA.rows.find(r=>r.id===id);let scored=pairs.map(o=>{let py=pct(ys,o.y.v);return {...o,score:py,high:o.x.v>=xq&&o.y.v>=yq}}).sort((a,b)=>b.score-a.score);let high=scored.filter(x=>x.high).length,isRapida=id==='undp_rapida_recovery_needs';$('#ipm-kpis').innerHTML=[['Municipios comparables',pairs.length,'con IPM y resultado'],['IPM mediano',fmt(q(xs,.5)),'línea base'],['Umbral IPM alto',fmt(xq),'cuartil superior'],['Resultado mediano',fmt(q(ys,.5),meta?.u),'universo común'],['Alta vulnerabilidad + necesidad',high,'cuadrante superior'],['Departamentos',new Set(pairs.map(o=>o.x.d)).size,'con comparación']].map(x=>`<div class="card kpi"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join('');$('#ipm-method-note').textContent=isRapida?'El IPM es un componente de vulnerabilidad de RAPIDA. El ranking usa únicamente el índice de recuperación temprana para evitar contar el IPM dos veces. El gráfico sirve para examinar la relación entre el componente y el resultado, no como validación independiente.':'El ranking usa únicamente el resultado seleccionado. El IPM se conserva como línea base contextual.';$('#scatter-note').textContent=meta?`${meta.i} (${meta.u}) frente a IPM. Líneas: percentil 75 de cada eje.`:'';renderScatter(scored,xq,yq,meta);$('#priority').innerHTML=table(['#','Municipio','IPM','Resultado','Percentil resultado'],scored.slice(0,40).map((o,i)=>`<tr><td>${i+1}</td><td><b>${o.x.m}</b><br><span class="muted">${o.x.d}</span></td><td class="r">${fmt(o.x.v)}</td><td class="r">${fmt(o.y.v,o.y.u)}</td><td class="r"><b>P${Math.round(o.score)}</b>${o.high?' <span class="badge alta">alto-alto</span>':''}</td></tr>`));renderTrend(id,dep,meta)}
function renderScatter(points,xq,yq,meta){if(!points.length){$('#scatter').innerHTML='<div class="empty">No hay municipios en común.</div>';return}let W=760,H=420,P=48,xs=points.map(o=>o.x.v),ys=points.map(o=>o.y.v),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),sx=x=>P+(x-xmin)/(xmax-xmin||1)*(W-2*P),sy=y=>H-P-(y-ymin)/(ymax-ymin||1)*(H-2*P);let dots=points.map(o=>`<circle class="dot ${o.high?'high':''}" cx="${sx(o.x.v)}" cy="${sy(o.y.v)}" r="5"><title>${o.x.m}, ${o.x.d}\nIPM: ${fmt(o.x.v)}\n${meta.i}: ${fmt(o.y.v,o.y.u)}</title></circle>`).join('');$('#scatter').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img"><rect class="quadrant" x="${sx(xq)}" y="${P}" width="${W-P-sx(xq)}" height="${sy(yq)-P}"/><line class="axis" x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}"/><line class="axis" x1="${P}" y1="${P}" x2="${P}" y2="${H-P}"/><line class="axis" x1="${sx(xq)}" y1="${P}" x2="${sx(xq)}" y2="${H-P}" stroke-dasharray="4"/><line class="axis" x1="${P}" y1="${sy(yq)}" x2="${W-P}" y2="${sy(yq)}" stroke-dasharray="4"/>${dots}<text class="chart-label" x="${W/2}" y="${H-10}" text-anchor="middle">IPM previo al sismo</text><text class="chart-label" transform="translate(14 ${H/2}) rotate(-90)" text-anchor="middle">${meta.i}</text></svg>`}
function renderTrend(id,dep,meta){let target=dep||($('#territory-scope').value==='decree'?'__DECRETO__':'__ALL__'),pts=DATA.history.filter(r=>r.indicador_id===id&&r.nivel==='municipal'&&r.departamento===target).map(r=>({date:r.fecha,v:r.mediana})).sort((a,b)=>a.date.localeCompare(b.date));if(pts.length<2){$('#trend').innerHTML=`<div class="empty"><b>Solo existe ${pts.length||0} corte.</b><br>El historial ya está habilitado; la evolución aparecerá después de una segunda fecha de actualización.</div>`;return}let W=1000,H=260,P=45,ys=pts.map(p=>p.v),min=Math.min(...ys),max=Math.max(...ys),sx=i=>P+i/(pts.length-1)*(W-2*P),sy=v=>H-P-(v-min)/(max-min||1)*(H-2*P),path=pts.map((p,i)=>`${i?'L':'M'}${sx(i)},${sy(p.v)}`).join(' ');$('#trend').innerHTML=`<svg viewBox="0 0 ${W} ${H}"><line class="axis" x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}"/><path d="${path}" fill="none" stroke="#0e6655" stroke-width="4"/>${pts.map((p,i)=>`<circle class="dot" cx="${sx(i)}" cy="${sy(p.v)}" r="6"><title>${p.date}: ${fmt(p.v,meta?.u)}</title></circle><text class="chart-label" x="${sx(i)}" y="${H-18}" text-anchor="middle">${p.date}</text>`).join('')}</svg>`}

function renderAudit(){let a=DATA.audit;$('#audit-findings').innerHTML=a.findings.map(f=>`<div class="finding"><span class="badge ${f.severity}">${f.severity}</span><h3>${f.title}</h3><p>${f.detail}</p></div>`).join('');$('#audit-checks').innerHTML=table(['Control','Incidencias','Estado'],a.checks.map(c=>`<tr><td>${c.check}</td><td class="r">${c.count}</td><td><span class="badge ${c.status}">${c.status}</span></td></tr>`));$('#coverage-table').innerHTML=table(['Fuente','Filas','Indicadores','Departamentos','Municipios'],a.coverage.map(c=>`<tr><td><b>${c.fuente}</b></td><td class="r">${c.filas.toLocaleString('es-CO')}</td><td class="r">${c.indicadores}</td><td class="r">${c.departamentos}</td><td class="r">${c.municipios}</td></tr>`));let dict=uniq(DATA.rows.map(r=>r.id)).map(id=>{let z=DATA.rows.filter(r=>r.id===id),r={...z[0]};r.lv=uniq(z.map(x=>x.lv)).join(', ');return r});$('#dictionary').innerHTML=table(['Indicador','ID','Dimensión','Unidad','Fuente','Nivel'],dict.map(r=>`<tr><td><b>${r.i}</b></td><td><code>${r.id}</code></td><td>${r.dim}</td><td>${r.u}</td><td>${r.f}</td><td>${r.lv}</td></tr>`))}
function refreshScope(){let decree=$('#territory-scope').value==='decree';$('#scope-note').textContent=decree?`${DATA.decree_departments.length} departamentos nombrados en el Decreto 1171. Todas las vistas territoriales usan este universo.`:'Inventario completo. Las filas de ExE fuera del Decreto 1171 se muestran como necesidades no atribuidas al sismo.';renderSummary();initRanking();initProfile();initIpm()}
$('#territory-scope').onchange=refreshScope;refreshScope();renderAudit();
</script></body></html>'''


def main():
    ap = argparse.ArgumentParser(description="Genera el EDA territorial de indicadores crudos.")
    ap.add_argument("--input", default=CURRENT_DEFAULT)
    ap.add_argument("--full", default=FULL_DEFAULT, help="CSV largo completo, usado para recuperar DIVIPOLA/fecha en snapshots antiguos")
    ap.add_argument("--history", default=HISTORY_DEFAULT)
    ap.add_argument("--out", default=OUTPUT_DEFAULT)
    ap.add_argument("--no-history-update", action="store_true")
    args = ap.parse_args()
    current = enrich_current(read_csv(args.input), read_csv(args.full))
    if not current:
        raise SystemExit(f"No se encontraron filas en {args.input}")
    write_csv(args.input, current)
    history = read_csv(args.history)
    if not args.no_history_update:
        history = update_history(args.history, current)
    report = audit(current)
    summary = summarize(current, history)
    output = build_html(current, history, report, summary)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(output)
    print(f"EDA OK -> {args.out} ({len(output)/1024:.1f} KB); {len(current)} filas; {len(summary['fechas'])} corte(s)")


if __name__ == "__main__":
    main()



