#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera índices territoriales por dimensión en un tablero autocontenido.

Cada variable municipal aporta como máximo la misma cantidad de puntos.
La ausencia de una variable no se interpreta como cero observado: aporta cero
al índice de evidencia y queda visible en la cobertura del municipio.
"""
import argparse
import csv
import html
import json
import math
import os
from collections import defaultdict
from datetime import datetime, timezone


INPUT_DEFAULT = "indicadores_largo_no_calculo.csv"
OUTPUT_DEFAULT = "indice_educacion.html"
DECREE_INDICATOR_ID = "en_decreto_1171"

# Variables municipales de educación disponibles en el inventario. El campo de
# UNDP-RÁPIDA está catalogado como Infraestructura, pero es educativo por nombre
# e identificador y por eso se incluye de forma explícita.
MUNICIPAL_INDICATORS = (
    "undp_rapida_bdg_edu_aff",
    "pnud_cedu",
    "pnud_edu_cop",
    "3is_educativos",
    "sedes_edu_n_sedes",
    "sedes_edu_n_sedes_criticas",
    "sedes_edu_matricula_afectada",
    "sedes_edu_docentes_afectados",
)

# Se conserva también el registro departamental de Naboo para que la vista de
# datos contenga todo el inventario educativo, aunque no se impute a municipios.
ALL_EDUCATION_INDICATORS = set(MUNICIPAL_INDICATORS) | {"educacion_n"}


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def as_number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def territory_key(row):
    code = str(row.get("divipola", "")).strip()
    if row.get("nivel") == "municipal" and len(code) == 5 and code.isdigit():
        return f"divipola:{code}"
    return "nombre:" + "|".join([
        str(row.get("departamento", "")).strip().casefold(),
        str(row.get("municipio", "")).strip().casefold(),
    ])


def percentile_midrank(values, value):
    clean = sorted(v for v in values if v is not None)
    if not clean:
        return None
    if len(clean) == 1:
        return 50.0
    below = sum(v < value for v in clean)
    equal = sum(v == value for v in clean)
    return 100.0 * (below + equal / 2) / len(clean)


def median(values):
    ordered = sorted(values)
    if not ordered:
        return None
    middle = len(ordered) // 2
    return ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2


def decree_departments(rows):
    return sorted({
        row.get("departamento", "")
        for row in rows
        if row.get("indicador_id") == DECREE_INDICATOR_ID
        and as_number(row.get("valor")) == 1
        and row.get("departamento")
    })


def education_rows(rows):
    return [row for row in rows if row.get("indicador_id") in ALL_EDUCATION_INDICATORS]


def build_index(rows, indicator_ids=None, level="municipal"):
    indicator_ids = MUNICIPAL_INDICATORS if indicator_ids is None else indicator_ids
    municipal = [
        row for row in rows
        if row.get("nivel") == level
        and row.get("indicador_id") in indicator_ids
        and as_number(row.get("valor")) is not None
    ]
    cohorts = defaultdict(list)
    latest = {}
    for row in municipal:
        indicator_id = row["indicador_id"]
        value = as_number(row["valor"])
        key = (territory_key(row), indicator_id)
        current = latest.get(key)
        if current is None or row.get("fecha_corte", "") >= current.get("fecha_corte", ""):
            latest[key] = row

    for row in latest.values():
        cohorts[row["indicador_id"]].append(as_number(row["valor"]))
    profiles = {}
    total_variables = len(indicator_ids)
    for (key, indicator_id), row in latest.items():
        profile = profiles.setdefault(key, {
            "key": key,
            "code": row.get("divipola", ""),
            "department": row.get("departamento", ""),
            "municipality": row.get("municipio", "") or row.get("departamento", ""),
            "variables": {},
        })
        value = as_number(row["valor"])
        pct = percentile_midrank(cohorts[indicator_id], value)
        profile["variables"][indicator_id] = {
            "value": value,
            "percentile": pct,
            "source": row.get("fuente", ""),
            "name": row.get("indicador", indicator_id),
            "unit": row.get("unidad", ""),
            "date": row.get("fecha_corte", ""),
        }

    result = []
    for profile in profiles.values():
        percentiles = [item["percentile"] for item in profile["variables"].values()]
        observed = len(percentiles)
        intensity = sum(percentiles) / observed
        coverage = observed / total_variables
        # Igual peso nominal: cada variable aporta percentil / 8. Una variable
        # ausente no se fabrica como cero observado; su ausencia reduce cobertura.
        score = sum(percentiles) / total_variables
        profile.update({
            "observed": observed,
            "total": total_variables,
            "coverage": coverage,
            "intensity": intensity,
            "score": score,
        })
        result.append(profile)

    result.sort(key=lambda item: (
        -item["score"], -item["observed"], -item["intensity"],
        item["department"], item["municipality"],
    ))
    for position, profile in enumerate(result, 1):
        profile["rank"] = position
    return result


def summarize_indicators(rows, all_rows=False):
    groups = defaultdict(list)
    for row in (rows if all_rows else education_rows(rows)):
        value = as_number(row.get("valor"))
        if value is not None:
            groups[(row["indicador_id"], row["nivel"], row["fuente"], row["indicador"], row["unidad"])].append(value)
    summaries = []
    for key, values in groups.items():
        summaries.append({
            "id": key[0], "level": key[1], "source": key[2],
            "name": key[3], "unit": key[4], "n": len(values),
            "zeroes": sum(value == 0 for value in values),
            "min": min(values), "median": median(values), "max": max(values),
            "used": key[1] == "municipal" and key[0] in MUNICIPAL_INDICATORS,
        })
    return sorted(summaries, key=lambda item: (item["level"], item["source"], item["name"]))


def compact_inventory(rows, decree, all_rows=False):
    decree = set(decree)
    result = []
    for row in (rows if all_rows else education_rows(rows)):
        value = as_number(row.get("valor"))
        if value is None:
            continue
        result.append({
            "code": row.get("divipola", ""), "level": row.get("nivel", ""),
            "department": row.get("departamento", ""), "municipality": row.get("municipio", ""),
            "id": row.get("indicador_id", ""), "name": row.get("indicador", ""),
            "unit": row.get("unidad", ""), "source": row.get("fuente", ""),
            "value": value, "date": row.get("fecha_corte", ""),
            "decree": row.get("departamento", "") in decree,
            "attribution": (
                "No atribuida al sismo" if row.get("fuente") == "FundacionExe" and row.get("departamento", "") not in decree
                else "Atribución al sismo no verificada" if row.get("fuente") == "FundacionExe"
                else "Fuente sectorial"
            ),
        })
    return result


def build_payload(rows):
    decree = decree_departments(rows)
    index = build_index(rows)
    return {
        "index": index,
        "inventory": compact_inventory(rows, decree),
        "indicators": summarize_indicators(rows),
        "indicator_order": list(MUNICIPAL_INDICATORS),
        "decree_departments": decree,
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "summary": {
            "municipalities": len(index),
            "variables": len(MUNICIPAL_INDICATORS),
            "complete": sum(item["observed"] == len(MUNICIPAL_INDICATORS) for item in index),
            "median_coverage": median([item["coverage"] for item in index]),
            "inventory_rows": len(education_rows(rows)),
        },
    }


def dimension_name(row):
    overrides = {
        "3is_colapsos": "Infraestructura",
        "undp_rapida_bdg_edu_aff": "Educación",
        "undp_rapida_bdg_health_aff": "Salud",
        "undp_rapida_bdg_comm_aff": "Instituciones",
        "undp_rapida_bdg_homes_dmg": "Vivienda",
        "undp_rapida_bdg_homes_dest": "Vivienda",
    }
    return overrides.get(row.get("indicador_id"), row.get("dimension") or "Sin dimensión")


def build_dimensions(rows):
    groups = defaultdict(list)
    for row in rows:
        groups[dimension_name(row)].append(row)
    decree = decree_departments(rows)
    dimensions = []
    for name in sorted(groups, key=lambda name: (name != "Educación", name)):
        records = groups[name]
        levels = {}
        for level in ("municipal", "departamental"):
            ids = sorted({r["indicador_id"] for r in records if r.get("nivel") == level and as_number(r.get("valor")) is not None})
            if not ids:
                continue
            index = [] if name == "Marco normativo" else build_index(records, ids, level)
            indicators = summarize_indicators(records, all_rows=True)
            for item in indicators:
                item["used"] = name != "Marco normativo" and item["level"] == level
            levels[level] = {
                "index": index, "inventory": compact_inventory(records, decree, all_rows=True),
                "indicators": indicators, "indicator_order": ids,
                "decree_departments": decree, "name": name, "level": level,
                "summary": {"municipalities": len(index), "variables": len(ids),
                    "complete": sum(x["observed"] == len(ids) for x in index),
                    "median_coverage": median([x["coverage"] for x in index]) or 0,
                    "inventory_rows": len(records)},
            }
        dimensions.append({"name": name, "levels": levels})
    return {"dimensions": dimensions}


def build_html(rows):
    payload = json.dumps(build_dimensions(rows), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return TEMPLATE.replace("__PAYLOAD__", payload)


TEMPLATE = r'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prioridad territorial por dimensión</title>
<style>
:root{--blue:#1557a0;--blue2:#0b3f78;--ink:#17202a;--muted:#64748b;--line:#dbe3ec;--bg:#eef1f5;--card:#fff;--warn:#9a5a05;--warnbg:#fff6df;--good:#08745b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif;font-size:16px}.wrap{max-width:1500px;margin:auto;padding:22px}.top{background:linear-gradient(118deg,var(--blue2),var(--blue));color:#fff;padding:24px 28px;border-radius:12px;box-shadow:0 5px 18px #1234}.top h1{font-size:28px;margin:0 0 7px}.top p{margin:0;max-width:980px;line-height:1.45}.tabs{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}.tab{border:1px solid var(--line);background:#fff;color:var(--blue2);padding:10px 15px;border-radius:8px;font-weight:700;cursor:pointer}.tab.active{background:var(--blue);color:#fff;border-color:var(--blue)}.view{display:none}.view.active{display:block}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;box-shadow:0 2px 8px #10203012;margin-bottom:14px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px}.kpi{background:#fff;border:1px solid var(--line);border-left:5px solid var(--blue);border-radius:9px;padding:14px}.kpi strong{display:block;font-size:26px;color:var(--blue2)}.kpi span{color:var(--muted);font-size:14px}.controls{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr;gap:12px}.controls label{font-size:13px;font-weight:700;color:#415066}.controls select,.controls input{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #bcc9d7;border-radius:7px;background:#fff;font-size:14px}.grid{display:grid;grid-template-columns:minmax(520px,1.25fr) minmax(360px,.75fr);gap:14px}.scroll{overflow:auto;max-height:680px}table{width:100%;border-collapse:collapse;font-size:14px}th{position:sticky;top:0;background:var(--blue2);color:#fff;text-align:left;padding:10px;z-index:1}td{padding:9px 10px;border-bottom:1px solid #e7ecf2;vertical-align:middle}tbody tr[data-key]{cursor:pointer}tbody tr[data-key]:hover,tbody tr.selected{background:#eaf3fd}.num{text-align:right;font-variant-numeric:tabular-nums}.pill{display:inline-block;padding:3px 8px;border-radius:999px;background:#e8f1fb;color:var(--blue2);font-weight:700;font-size:12px}.barrow{display:grid;grid-template-columns:150px 1fr 44px;gap:9px;align-items:center;margin:9px 0;font-size:13px}.track{height:12px;background:#e8edf3;border-radius:999px;overflow:hidden}.fill{height:100%;background:var(--blue);border-radius:999px}.note{border-left:4px solid #e5a11a;background:var(--warnbg);padding:11px 13px;color:#704100;border-radius:6px;line-height:1.4}.formula{font-family:Consolas,monospace;background:#f3f6f9;padding:12px;border-radius:7px;overflow:auto}.profile h2,.card h2{font-size:19px;margin:0 0 12px}.profile .headline{font-size:33px;color:var(--blue2);font-weight:800}.profile small{color:var(--muted)}.profile-row{padding:10px 0;border-bottom:1px solid #e8edf3}.profile-row b{display:block;margin-bottom:4px}.missing{color:#8b5e18}.pager{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:8px}.pager button{border:1px solid #b8c6d5;background:#fff;border-radius:6px;padding:7px 10px;cursor:pointer}.legend{color:var(--muted);font-size:13px;line-height:1.45}.method{max-width:920px}.method li{margin:8px 0;line-height:1.5}@media(max-width:950px){.kpis{grid-template-columns:repeat(2,1fr)}.controls,.grid{grid-template-columns:1fr}.scroll{max-height:none}}@media(max-width:560px){.wrap{padding:10px}.kpis{grid-template-columns:1fr}.top{padding:18px}.top h1{font-size:23px}}
</style>
</head>
<body><main class="wrap">
<header class="top"><h1>Prioridad territorial por dimensión</h1><p>Índice de evidencia disponible: las variables de cada dimensión tienen el mismo peso máximo. El resultado combina intensidad observada y cobertura documental; una posición alta indica mayor prioridad en los datos disponibles, no atribución causal verificada al sismo.</p></header>
<div class="card controls" style="margin-top:16px"><label>Dimensión<select id="dimension"></select></label><label>Escala del índice<select id="indexLevel"></select></label></div><nav class="tabs" aria-label="Vistas"><button class="tab active" data-view="ranking">Ranking territorial</button><button class="tab" data-view="datos">Datos de la dimensión</button><button class="tab" data-view="metodo">Método</button></nav>

<section class="card" id="indexFormula" aria-live="polite"></section>
<section id="ranking" class="view active">
  <div class="kpis" id="kpis"></div>
  <div class="card controls">
    <label>Universo<select id="scope"><option value="decree">Departamentos del Decreto 1171</option><option value="all">Todo el inventario</option></select></label>
    <label>Departamento<select id="department"><option value="">Todos</option></select></label>
    <label>Cobertura mínima<select id="coverage"><option value="0">1 de 8 variables</option><option value=".5">4 de 8 variables</option><option value=".75">6 de 8 variables</option><option value="1">8 de 8 variables</option></select></label>
    <label>Buscar territorio<input id="search" type="search" placeholder="Nombre o DIVIPOLA"></label>
  </div>
  <div class="note" id="educationNote">PNUD <b>pnud_cedu</b> y UNDP-RÁPIDA <b>undp_rapida_bdg_edu_aff</b> coinciden exactamente en los 258 municipios compartidos del corte inicial. Se mantienen separados porque se pidió igual peso para todos los campos; por eso ese mismo dato publicado por dos canales puede aportar dos veces.</div>
  <p class="legend" id="dimensionNote"></p><div class="grid" style="margin-top:14px">
    <div class="card"><h2>Ranking de prioridad</h2><div class="scroll"><table><thead><tr><th>#</th><th>Territorio</th><th>Departamento</th><th class="num">Índice</th><th class="num">Intensidad</th><th class="num">Cobertura</th></tr></thead><tbody id="rankingRows"></tbody></table></div></div>
    <div><div class="card"><h2>Primeros territorios</h2><div id="bars"></div></div><div class="card profile" id="profile"></div></div>
  </div>
</section>

<section id="datos" class="view">
  <div class="card controls">
    <label>Nivel<select id="rawLevel"><option value="municipal">Municipal</option><option value="departamental">Departamental</option><option value="">Todos</option></select></label>
    <label>Variable<select id="rawIndicator"><option value="">Todas</option></select></label>
    <label>Fuente<select id="rawSource"><option value="">Todas</option></select></label>
    <label>Buscar territorio<input id="rawSearch" type="search" placeholder="Municipio o departamento"></label>
  </div>
  <div class="card"><h2>Inventario de la dimensión</h2><p class="legend" id="rawCount"></p><div class="scroll"><table><thead><tr><th>Nivel</th><th>Territorio</th><th>Variable</th><th>Fuente</th><th class="num">Valor</th><th>Unidad</th><th>Atribución</th></tr></thead><tbody id="rawRows"></tbody></table></div><div class="pager"><button id="prev">Anterior</button><span id="page"></span><button id="next">Siguiente</button></div></div>
  <div class="card"><h2>Cobertura por variable</h2><div class="scroll"><table><thead><tr><th>Variable</th><th>Nivel</th><th>Fuente</th><th class="num">Registros</th><th class="num">Ceros</th><th class="num">Mediana</th><th class="num">Máximo</th><th>Uso</th></tr></thead><tbody id="indicatorRows"></tbody></table></div></div>
</section>

<section id="metodo" class="view"><div class="card method"><h2>Cómo se construye</h2><ol><li>Se usan todas las variables numéricas de la dimensión y escala seleccionadas. N es el número de variables de ese conjunto. Los datos departamentales se comparan entre departamentos y los municipales entre municipios. Marco normativo se conserva como inventario.</li><li>Cada valor se convierte en percentil de 0 a 100 dentro de su propia variable. Así se pueden combinar COP y conteos sin mezclar sus unidades originales.</li><li>Cada variable tiene el mismo peso máximo: 1/N del total. Si un municipio no tiene una variable, esa ausencia reduce su cobertura y no se presenta como un cero observado.</li><li>La intensidad es el promedio de los percentiles que sí existen. El índice final es intensidad × cobertura, equivalente a sumar los percentiles disponibles y dividir entre N.</li><li>El ranking favorece municipios con mayor señal educativa y mayor cantidad de variables observadas. Los valores crudos siguen visibles en el perfil y el inventario.</li></ol><div class="formula">Índice = Σ(percentil de cada variable disponible) ÷ N<br>Intensidad = Σ(percentiles disponibles) ÷ número de variables disponibles<br>Cobertura = variables disponibles ÷ N<br>Índice = Intensidad × Cobertura</div><h2 style="margin-top:20px">Qué no afirma</h2><p>El índice mide prioridad según la evidencia reunida, no daño causal confirmado. Fundación ExE incluye necesidades educativas fuera del área del decreto. Además, PNUD y UNDP-RÁPIDA publican el mismo conteo educativo en su cobertura común. El filtro del decreto es administrativo y no prueba afectación municipal.</p></div></section>
</main>
<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
const ROOT=JSON.parse(document.getElementById('payload').textContent);let D,order,decree,selected=null,rawPage=1;const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,u='')=>{if(v==null)return 'Sin dato'; if(u==='COP')return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(v);return new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}).format(v)};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.view).classList.add('active')});
function init(){
  ROOT.dimensions.forEach(x=>$('dimension').insertAdjacentHTML('beforeend',`<option>${esc(x.name)}</option>`));
  $('dimension').onchange=()=>setDimension();
  $('indexLevel').onchange=()=>setDimension($('indexLevel').value);
  ['scope','department','coverage','search'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderRanking));
  ['rawLevel','rawIndicator','rawSource','rawSearch'].forEach(id=>$(id).addEventListener(id==='rawSearch'?'input':'change',()=>{rawPage=1;renderRaw()}));
  $('prev').onclick=()=>{rawPage=Math.max(1,rawPage-1);renderRaw()};$('next').onclick=()=>{rawPage++;renderRaw()};
  setDimension();
}
function setDimension(preferred){
  const dimension=ROOT.dimensions.find(x=>x.name===$('dimension').value);
  const levels=Object.keys(dimension.levels);
  const level=levels.includes(preferred)?preferred:levels[0];
  $('indexLevel').innerHTML=levels.map(x=>`<option value="${x}">${x==='municipal'?'Municipal':'Departamental'}</option>`).join('');
  $('indexLevel').value=level;
  D=dimension.levels[level];order=D.indicator_order;decree=new Set(D.decree_departments);
  renderFormula();
  $('department').innerHTML='<option value="">Todos</option>';
  $('rawIndicator').innerHTML='<option value="">Todas</option>';
  $('rawSource').innerHTML='<option value="">Todas</option>';
  $('rawLevel').value=level;rawPage=1;
  $('coverage').innerHTML='<option value="0">Al menos una variable</option><option value=".5">Al menos 50%</option><option value=".75">Al menos 75%</option><option value="1">Todas las variables</option>';
  $('educationNote').style.display=D.name==='Educación'?'block':'none';
  $('dimensionNote').textContent=D.name==='Marco normativo'?'Esta dimensión identifica el ámbito administrativo. Consulta sus registros en Datos de la dimensión; no se interpreta como necesidad de intervención.':`${D.name}: ${order.length} variables, peso de ${(100/order.length).toFixed(1)}% cada una. Percentiles calculados en toda la cobertura de cada variable; los filtros no recalculan los valores. Las fuentes pueden repetir una misma señal y los totales pueden solaparse con sus componentes. Favorecer cobertura puede relegar territorios poco documentados. Los índices de distintas dimensiones no son directamente comparables.`;

  $('kpis').innerHTML=`<div class="kpi"><strong>${D.summary.municipalities}</strong><span>territorios con al menos un dato (total)</span></div><div class="kpi"><strong>${D.summary.variables}</strong><span>variables con igual peso</span></div><div class="kpi"><strong>${D.summary.complete}</strong><span>territorios con cobertura completa (total)</span></div><div class="kpi"><strong>${Math.round(D.summary.median_coverage*100)}%</strong><span>cobertura mediana</span></div>`;
  [...new Set(D.index.map(x=>x.department))].sort().forEach(x=>$('department').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));
  [...new Map(D.indicators.map(x=>[x.id,x])).values()].forEach(x=>$('rawIndicator').insertAdjacentHTML('beforeend',`<option value="${esc(x.id)}">${esc(x.name)}</option>`));
  [...new Set(D.inventory.map(x=>x.source))].sort().forEach(x=>$('rawSource').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));
  $('indicatorRows').innerHTML=D.indicators.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.level)}</td><td>${esc(x.source)}</td><td class="num">${x.n}</td><td class="num">${x.zeroes}</td><td class="num">${fmt(x.median,x.unit)}</td><td class="num">${fmt(x.max,x.unit)}</td><td>${x.used?'<span class="pill">Incluida en el índice</span>':'Solo inventario'}</td></tr>`).join('');
  renderRanking();renderRaw();
}
function renderFormula(){
  if(D.name==='Marco normativo'){$('indexFormula').innerHTML='<h2>Marco normativo: sin índice</h2><p>El indicador 0/1 identifica pertenencia al decreto; no se suma como necesidad.</p>';return}
  const names=order.map(id=>D.indicators.find(x=>x.id===id&&x.level===D.level)?.name||id);
  $('indexFormula').innerHTML=`<h2>Fórmula · ${esc(D.name)} · ${esc(D.level)}</h2><div class="formula" style="white-space:normal;line-height:1.7">Índice = [${names.map(name=>`P(${esc(name)})`).join(' + ')}] / ${order.length}</div><p>P(x) = 100 × [territorios con valor menor que x + 0,5 × territorios con valor igual a x] / territorios con dato en esa variable.</p><p>Cada variable pesa ${(100/order.length).toLocaleString('es-CO',{maximumFractionDigits:2})}%. Todas tienen sentido positivo: un valor mayor da un percentil mayor o igual. Una variable ausente aporta 0 al índice por falta de cobertura; un cero observado recibe su percentil y sí cuenta como dato.</p><p>Intensidad = suma de percentiles observados / variables observadas. Cobertura = variables observadas / ${order.length}. Índice = intensidad × cobertura. La referencia de percentiles permanece fija al usar filtros.</p>${order.includes('3is_rescatados')?'<div class="note">Rescatados aporta P(rescatados) / '+order.length+'. Aquí un mayor número aumenta el índice. Este dato mezcla magnitud del evento y respuesta de rescate: no demuestra por sí solo mayor necesidad pendiente.</div>':''}`;
}
function rankingData(){const q=$('search').value.trim().toLocaleLowerCase('es'),min=+$('coverage').value,dep=$('department').value,scope=$('scope').value;return D.index.filter(x=>(scope==='all'||decree.has(x.department))&&(!dep||x.department===dep)&&x.coverage>=min&&(!q||`${x.municipality} ${x.department} ${x.code}`.toLocaleLowerCase('es').includes(q)))}
function renderRanking(){const rows=rankingData();if(!rows.some(x=>x.key===selected))selected=rows[0]?.key||null;$('rankingRows').innerHTML=rows.map((x,i)=>`<tr data-key="${esc(x.key)}" class="${x.key===selected?'selected':''}"><td>${i+1}</td><td><b>${esc(x.municipality)}</b><br><small>${esc(x.code)}</small></td><td>${esc(x.department)}</td><td class="num"><b>${x.score.toFixed(1)}</b></td><td class="num">${x.intensity.toFixed(1)}</td><td class="num">${x.observed}/${order.length}</td></tr>`).join('')||'<tr><td colspan="6">No hay territorios puntuables con estos filtros.</td></tr>';document.querySelectorAll('#rankingRows tr[data-key]').forEach(tr=>tr.onclick=()=>{selected=tr.dataset.key;renderRanking()});$('bars').innerHTML=rows.slice(0,12).map(x=>`<div class="barrow"><span>${esc(x.municipality)}</span><div class="track"><div class="fill" style="width:${x.score}%"></div></div><b class="num">${x.score.toFixed(1)}</b></div>`).join('')||'<p>Sin datos.</p>';renderProfile(rows.find(x=>x.key===selected))}
function renderProfile(x){if(!x){$('profile').innerHTML='<h2>Perfil territorial</h2><p>Selecciona un territorio.</p>';return}$('profile').innerHTML=`<h2>${esc(x.municipality)}${D.level==='municipal'?', '+esc(x.department):''}</h2><div class="headline">${x.score.toFixed(1)}</div><small>${esc(D.name)} · intensidad ${x.intensity.toFixed(1)} · cobertura ${x.observed}/${order.length}</small><div style="margin-top:14px">${order.map(id=>{const v=x.variables[id],meta=D.indicators.find(i=>i.id===id&&i.level===D.level);return v?`<div class="profile-row"><b>${esc(v.name)}</b><span>${fmt(v.value,v.unit)} · percentil ${v.percentile.toFixed(1)}</span><br><small>${esc(v.source)} · aporte ${(v.percentile/order.length).toFixed(1)} puntos</small></div>`:`<div class="profile-row missing"><b>${esc(meta?.name||id)}</b>Sin dato · aporte 0 por falta de cobertura</div>`}).join('')}</div>`}
function rawData(){const q=$('rawSearch').value.trim().toLocaleLowerCase('es'),lv=$('rawLevel').value,id=$('rawIndicator').value,src=$('rawSource').value;return D.inventory.filter(x=>(!lv||x.level===lv)&&(!id||x.id===id)&&(!src||x.source===src)&&(!q||`${x.municipality} ${x.department} ${x.code}`.toLocaleLowerCase('es').includes(q)))}
function renderRaw(){const rows=rawData(),size=50,pages=Math.max(1,Math.ceil(rows.length/size));rawPage=Math.min(rawPage,pages);const pageRows=rows.slice((rawPage-1)*size,rawPage*size);$('rawCount').textContent=`${rows.length.toLocaleString('es-CO')} registros filtrados de ${D.summary.inventory_rows.toLocaleString('es-CO')}.`;$('rawRows').innerHTML=pageRows.map(x=>`<tr><td>${esc(x.level)}</td><td><b>${esc(x.municipality||x.department)}</b>${x.municipality?`<br><small>${esc(x.department)}</small>`:''}</td><td>${esc(x.name)}</td><td>${esc(x.source)}</td><td class="num">${fmt(x.value,x.unit)}</td><td>${esc(x.unit)}</td><td>${esc(x.attribution)}</td></tr>`).join('');$('page').textContent=`Página ${rawPage} de ${pages}`;$('prev').disabled=rawPage===1;$('next').disabled=rawPage===pages}
init();
</script></body></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", default=INPUT_DEFAULT)
    parser.add_argument("--out", default=OUTPUT_DEFAULT)
    args = parser.parse_args()
    if not os.path.exists(args.input):
        raise SystemExit(f"No existe el archivo de entrada: {args.input}")
    rows = read_csv(args.input)
    with open(args.out, "w", encoding="utf-8", newline="") as output:
        output.write(build_html(rows))
    print(f"Generado {args.out} con {len(build_dimensions(rows)['dimensions'])} dimensiones y {len(rows)} registros.")


if __name__ == "__main__":
    main()

