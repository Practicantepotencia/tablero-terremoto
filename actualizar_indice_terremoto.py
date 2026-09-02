#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Índice de impacto del terremoto — actualizador local (100% Python estándar,
sin librerías externas que instalar, sin depender de Claude ni de internet
salvo para bajar el registro.json).

Qué hace:
  1. Descarga el registro.json público de mapadelterremoto.com (o lee uno
     local, si le pasas una ruta de archivo en vez de una URL).
  2. Recalcula el índice de impacto 0-100 por departamento, en 5 dimensiones:
     salud, vivienda, instituciones, educación y productividad (proxy).
  3. Genera un archivo HTML autocontenido (dashboard_impacto_terremoto.html)
     que puedes abrir directamente con doble clic en cualquier navegador.

Uso manual:
    python actualizar_indice_terremoto.py
    python actualizar_indice_terremoto.py --out otro_nombre.html
    python actualizar_indice_terremoto.py --url "C:/ruta/a/un/registro.json"  (para probar con un archivo ya descargado)

Para automatizarlo en Windows, revisa INSTRUCCIONES.md (Programador de tareas).
"""
import argparse
import csv
import io
import json
import os
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

URL_POR_DEFECTO = "https://www.mapadelterremoto.com/datos/registro.json"

# Listado nominal de municipios afectados (departamento, municipio, gravedad
# oficial, población DANE aprox., etc.) -- ver data/README.md. Si este
# archivo existe, se usa para sumar la población por departamento en vez de
# la tabla fija de abajo (misma fuente, pero se actualiza reemplazando el
# CSV en vez de editar este script). Se puede forzar otra ruta con
# --poblacion, o forzar la tabla fija con --poblacion "" (string vacío).
MUNICIPIOS_POBLACION_CSV = "data/municipios_afectados_terremoto_colombia_ago2026.csv"
RESUMEN_UNGRD_JSON = "data/resumen_ungrd_ago2026.json"

# Nivel de gravedad oficial (municipal) -> punto en la misma rampa 0-100 que
# ya usan las celdas del heatmap departamental (ver RAMP/cell_color), para
# que ambas pestañas compartan el mismo lenguaje visual de color.
SEV_OFICIAL_VALUE = {
    "Afectación crítica": 100,
    "Afectación muy alta": 80,
    "Afectación alta": 60,
    "Afectación media-alta": 40,
    "Afectación media": 20,
    "Sin clasificación oficial": 0,
}

# ---------------------------------------------------------------------------
# Población departamental (agregada de los municipios que mapadelterremoto.com
# marca como afectados). Respaldo si MUNICIPIOS_POBLACION_CSV no está
# disponible (ej. corriendo el script fuera del repo, sin la carpeta data/).
# ---------------------------------------------------------------------------
POBLACION_CSV = """departamento,poblacion
Antioquia,6384000
Atlántico,1300000
Bogotá D.C.,7900000
Bolívar,1159000
Boyacá,249000
Caldas,1055000
Caquetá,189000
Cauca,1526000
Cesar,723000
Chocó,524000
Cundinamarca,2768000
Córdoba,585000
Huila,991000
La Guajira,212000
Magdalena,589000
Meta,770000
Nariño,1077000
Norte de Santander,1011000
Putumayo,68000
Quindío,556000
Risaralda,1007000
Santander,1175000
Sucre,353000
Tolima,1313000
Valle del Cauca,4711000
"""

SEV_WEIGHT = {"COLAPSO": 4, "GRAVE": 3, "MODERADO": 2, "LEVE": 1, "SIN_EVALUAR": 1}

INSTITUCION_KEYWORDS = [
    "alcaldía", "alcaldia", "gobernación", "gobernacion", "palacio municipal",
    "palacio de justicia", "notaría", "notaria", "estación de policía",
    "estacion de policia", "estación de bomberos", "estacion de bomberos",
    "cuerpo de bomberos", "ungrd", "cruz roja", "fiscalía", "fiscalia",
    "personería", "personeria", "registraduría", "registraduria",
    "defensoría", "defensoria", "procuraduría", "procuraduria",
    "contraloría", "contraloria", "juzgado", "cárcel", "carcel", "inpec",
    "dian", "migración colombia", "migracion colombia", "pmu ", "batallón",
    "batallon", "icbf", "comisaría", "comisaria", "sede administrativa",
    "concejo municipal", "casa de gobierno", "gaula",
]

DIMS = ["salud", "vivienda", "instituciones", "educacion", "econ_proxy"]
DIM_LABELS = {
    "salud": "Salud", "vivienda": "Vivienda", "instituciones": "Instituciones",
    "educacion": "Educación", "econ_proxy": "Productividad (proxy)",
}

RAMP = [
    (0,   (242, 241, 234)),
    (25,  (246, 212, 136)),
    (50,  (239, 157, 76)),
    (75,  (216, 93, 46)),
    (100, (122, 31, 31)),
]


def cell_color(v):
    v = max(0.0, min(100.0, v))
    for i in range(len(RAMP) - 1):
        v0, c0 = RAMP[i]
        v1, c1 = RAMP[i + 1]
        if v0 <= v <= v1:
            t = (v - v0) / (v1 - v0) if v1 > v0 else 0
            r = round(c0[0] + t * (c1[0] - c0[0]))
            g = round(c0[1] + t * (c1[1] - c0[1]))
            b = round(c0[2] + t * (c1[2] - c0[2]))
            return f"rgb({r},{g},{b})"
    return "rgb(242,241,234)"


def text_on(v):
    return "#fbf7ef" if v >= 62 else "#1c1a16"


def es_institucion(p):
    if p.get("tipo") in ("HOSPITAL", "ESCUELA"):
        return False
    text = " ".join([
        str(p.get("direccion") or ""), str(p.get("barrio") or ""),
        str(p.get("descripcion") or ""), str(p.get("notas") or ""),
    ]).lower()
    return any(kw in text for kw in INSTITUCION_KEYWORDS)


def load_registro(source):
    if source.startswith("http://") or source.startswith("https://"):
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    else:
        with open(source, encoding="utf-8") as f:
            raw = f.read()
    return json.loads(raw)


def load_dep_population(pop_csv_path):
    dep_pop = defaultdict(float)
    fh = open(pop_csv_path, encoding="utf-8") if pop_csv_path else io.StringIO(POBLACION_CSV)
    with fh as f:
        for row in csv.DictReader(f):
            try:
                dep_pop[row["departamento"]] += float(row["poblacion"])
            except (KeyError, ValueError):
                continue
    return dep_pop


def load_municipios(csv_path):
    """Lee el listado municipal completo (data/municipios_...csv) para la
    pestaña de vista municipal. Devuelve [] si el archivo no existe -- la
    pestaña simplemente no se genera (ver build_html)."""
    if not csv_path or not os.path.exists(csv_path):
        return []
    municipios = []
    with open(csv_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                municipios.append({
                    "departamento": row["departamento"],
                    "municipio": row["municipio"],
                    "gravedad_oficial": row.get("gravedad_oficial") or "Sin clasificación oficial",
                    "puntos_dano": int(float(row.get("puntos_dano") or 0)),
                    "poblacion": int(float(row["poblacion"])) if row.get("poblacion") else 0,
                    "nota": row.get("nota") or "",
                })
            except (KeyError, ValueError):
                continue
    return municipios


def load_resumen_meta(json_path):
    if not json_path or not os.path.exists(json_path):
        return None
    try:
        with open(json_path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def compute_indice(data, dep_pop):
    puntos = data["puntos"]
    weighted = {d: defaultdict(float) for d in DIMS}
    raw_n = {d: defaultdict(int) for d in DIMS}

    for p in puntos:
        dep = p.get("departamento")
        if not dep:
            continue
        w = SEV_WEIGHT.get(p.get("severidad"), 1)
        tipo = p.get("tipo")
        if tipo == "HOSPITAL":
            weighted["salud"][dep] += w; raw_n["salud"][dep] += 1
        if tipo == "VIVIENDA":
            weighted["vivienda"][dep] += w; raw_n["vivienda"][dep] += 1
        if tipo == "ESCUELA":
            weighted["educacion"][dep] += w; raw_n["educacion"][dep] += 1
        if tipo in ("SERVICIO", "PUNTO_AYUDA", "RESTRICCION"):
            weighted["econ_proxy"][dep] += w; raw_n["econ_proxy"][dep] += 1
        if es_institucion(p):
            weighted["instituciones"][dep] += w; raw_n["instituciones"][dep] += 1

    departamentos = sorted(dep_pop.keys())
    tasa = {d: {} for d in DIMS}
    for d in DIMS:
        for dep in departamentos:
            pob = dep_pop.get(dep, 0)
            tasa[d][dep] = (weighted[d].get(dep, 0) / pob * 100000) if pob > 0 else 0.0

    idx = {d: {} for d in DIMS}
    for d in DIMS:
        vals = [tasa[d][dep] for dep in departamentos if dep_pop.get(dep, 0) > 0]
        vmin, vmax = min(vals), max(vals)
        rng = (vmax - vmin) if vmax > vmin else 1.0
        for dep in departamentos:
            idx[d][dep] = (tasa[d][dep] - vmin) / rng * 100 if dep_pop.get(dep, 0) > 0 else 0.0

    rows = []
    for dep in departamentos:
        if dep_pop.get(dep, 0) <= 0:
            continue
        compuesto = sum(idx[d][dep] for d in DIMS) / len(DIMS)
        row = {"departamento": dep, "poblacion": int(dep_pop[dep]), "indice_compuesto": compuesto}
        for d in DIMS:
            row[f"{d}_n"] = raw_n[d].get(dep, 0)
            row[f"{d}_tasa_100k"] = tasa[d][dep]
            row[f"{d}_idx"] = idx[d][dep]
        rows.append(row)
    rows.sort(key=lambda r: -r["indice_compuesto"])
    return rows


def write_indice_csv(rows, csv_path):
    fieldnames = ["departamento", "poblacion", "indice_compuesto"]
    for d in DIMS:
        fieldnames += [f"{d}_n", f"{d}_tasa_100k", f"{d}_idx"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


MESES_ES = {1: "enero", 2: "febrero", 3: "marzo", 4: "abril", 5: "mayo", 6: "junio",
            7: "julio", 8: "agosto", 9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre"}


def fmt_fecha_es(dt):
    # Evita "%-d"/"%#d": esos modificadores de strftime son extensiones de
    # plataforma (funcionan en Linux/Mac, truenan en Windows con "Invalid
    # format string") -- se arma el texto a mano para que sea igual en todos.
    return f"{dt.day} de {MESES_ES[dt.month]} de {dt.year}, {dt.strftime('%H:%M')} UTC"


def build_html(rows, meta, autorefresh_seconds=14400, municipios=None, resumen_meta=None):
    snapshot_iso = meta.get("actualizado_snapshot", "")
    try:
        snap_dt = datetime.fromisoformat(snapshot_iso.replace("Z", "+00:00"))
        snap_label = fmt_fecha_es(snap_dt)
    except Exception:
        snap_label = snapshot_iso or "desconocido"

    build_dt = datetime.now(timezone.utc)
    build_iso = build_dt.isoformat()
    build_label = fmt_fecha_es(build_dt)

    n_dep = len(rows)
    poblacion_total = sum(r["poblacion"] for r in rows)
    peor = rows[0]
    mejor_evaluado = min(rows, key=lambda r: r["indice_compuesto"])

    def bar(v):
        w = max(2, round(v))
        return (f'<div class="compbar" role="img" aria-label="índice {v:.1f} de 100">'
                f'<div class="compbar-fill" style="width:{w}%;background:{cell_color(v)}"></div></div>')

    row_html = []
    for r in rows:
        cells = "".join(
            f'<td class="cell" style="background:{cell_color(r[f"{d}_idx"])};color:{text_on(r[f"{d}_idx"])}">'
            f'{r[f"{d}_idx"]:.0f}</td>' for d in DIMS
        )
        row_html.append(f"""
        <tr>
          <td class="dep-cell"><span class="dep-name">{r['departamento']}</span></td>
          <td class="num muted">{r['poblacion']:,}</td>
          <td class="num compuesto">{r['indice_compuesto']:.1f}{bar(r['indice_compuesto'])}</td>
          {cells}
        </tr>""")
    rows_html = "\n".join(row_html)
    header_dim_cells = "".join(f'<th>{DIM_LABELS[d]}</th>' for d in DIMS)
    legend_stops = "".join(f'<div class="legend-stop" style="background:{cell_color(v)}"></div>' for v in range(0, 101, 4))
    refresh_tag = f'<meta http-equiv="refresh" content="{autorefresh_seconds}">' if autorefresh_seconds else ""

    # --- Pestaña municipal (opcional: solo si hay data/municipios_...csv) ---
    tab_nav_html = ""
    tab_municipal_html = ""
    if municipios:
        por_dep = defaultdict(list)
        for m in municipios:
            por_dep[m["departamento"]].append(m)

        def dep_score(dep):
            """Gravedad oficial (0-100, misma escala que el heatmap) ponderada
            por población, sobre el total de población de los municipios
            afectados del departamento. Captura a la vez cantidad (más
            municipios graves suman más al numerador), población (pesa más
            un municipio grande que uno chico con la misma gravedad) y
            gravedad -- en una sola cifra 0-100 comparable entre
            departamentos, coloreable con la misma rampa que ya usa el resto
            del tablero."""
            pob_total = sum(m["poblacion"] for m in por_dep[dep])
            if pob_total <= 0:
                return 0.0
            ponderado = sum(SEV_OFICIAL_VALUE.get(m["gravedad_oficial"], 0) * m["poblacion"] for m in por_dep[dep])
            return ponderado / pob_total

        scores = {dep: dep_score(dep) for dep in por_dep}
        deps_ordenados = sorted(por_dep, key=lambda d: (-scores[d], -len(por_dep[d]), d))

        def sev_badge(grav):
            v = SEV_OFICIAL_VALUE.get(grav, 0)
            return f'<span class="sev-badge" style="background:{cell_color(v)};color:{text_on(v)}">{grav}</span>'

        accordion_items = []
        for dep in deps_ordenados:
            munis = sorted(
                por_dep[dep],
                key=lambda m: (-SEV_OFICIAL_VALUE.get(m["gravedad_oficial"], 0), -m["puntos_dano"], m["municipio"]),
            )
            n_oficial = sum(1 for m in munis if m["gravedad_oficial"] != "Sin clasificación oficial")
            muni_rows = "\n".join(f"""
            <tr>
              <td>{m['municipio']}</td>
              <td>{sev_badge(m['gravedad_oficial'])}</td>
              <td class="num">{m['puntos_dano']}</td>
              <td class="num muted">{m['poblacion']:,}</td>
              <td class="nota" title="{(m['nota'] or '').replace('"', '&quot;')}">{m['nota'] or '—'}</td>
            </tr>""" for m in munis)
            resumen_dep = f"{n_oficial} con gravedad oficial" if n_oficial else "ninguno con gravedad oficial todavía"
            score = scores[dep]
            score_badge = f'<span class="score-badge" style="background:{cell_color(score)};color:{text_on(score)}">{score:.0f}</span>'
            accordion_items.append(f"""
        <details class="dep-accordion">
          <summary>
            <span class="dep-accordion-name">{dep}</span>
            <span class="dep-accordion-score">{score_badge}{bar(score)}</span>
            <span class="dep-accordion-count">{len(munis)} municipios · {resumen_dep}</span>
          </summary>
          <div class="table-scroll">
            <table class="muni">
              <thead><tr><th class="left">Municipio</th><th class="left">Gravedad oficial</th><th>Puntos de daño</th><th>Población*</th><th class="left">Nota / fuente</th></tr></thead>
              <tbody>{muni_rows}</tbody>
            </table>
          </div>
        </details>""")
        accordion_html = "\n".join(accordion_items)

        resumen_tiles_html = ""
        if resumen_meta:
            resumen_tiles_html = f"""
    <div class="tiles">
      <div class="tile critical">
        <div class="tile-label">Fallecidos (oficial UNGRD)</div>
        <div class="tile-value warn">{resumen_meta.get('fallecidos', 0):,}</div>
        <div class="tile-sub">{resumen_meta.get('desaparecidos', 0):,} desaparecidos</div>
      </div>
      <div class="tile">
        <div class="tile-label">Heridos</div>
        <div class="tile-value">{resumen_meta.get('heridos', 0):,}</div>
      </div>
      <div class="tile">
        <div class="tile-label">Personas afectadas</div>
        <div class="tile-value">{resumen_meta.get('personas_afectadas', 0):,}</div>
        <div class="tile-sub">{resumen_meta.get('familias_afectadas', 0):,} familias</div>
      </div>
      <div class="tile">
        <div class="tile-label">Municipios afectados (oficial UNGRD)</div>
        <div class="tile-value">{resumen_meta.get('municipios_afectados_oficial', 0):,}</div>
        <div class="tile-sub">en {resumen_meta.get('departamentos_oficial', 0)} departamentos · corte {resumen_meta.get('corte', '')}</div>
      </div>
    </div>
    <p class="note">{resumen_meta.get('nota_listado', '')}</p>"""

        tab_nav_html = """
  <div class="tab-nav" role="tablist">
    <button class="tab-btn active" data-tab="departamental" role="tab" aria-selected="true">Vista departamental</button>
    <button class="tab-btn" data-tab="municipal" role="tab" aria-selected="false">Vista municipal ({n} municipios)</button>
  </div>""".replace("{n}", str(len(municipios)))

        tab_municipal_html = f"""
  <div id="tab-municipal" class="tab-panel" hidden>
    <header class="hero">
      <div class="kicker">Listado nominal · por municipio</div>
      <h1>Municipios afectados</h1>
      <p class="subtitle">Gravedad oficial (cuando existe), puntos de daño registrados y población DANE aproximada, agrupados por departamento — expande cada uno para ver el detalle.</p>
    </header>
    {resumen_tiles_html}
    <section>
      <div class="section-head">
        <h2>Departamentos, ordenados por gravedad</h2>
      </div>
      <p class="note">Cada departamento muestra un índice 0-100 (mismo color que el heatmap): la gravedad oficial de cada municipio (crítica=100 … sin clasificación=0), ponderada por su población dentro del total de municipios afectados del departamento. Un departamento con muchos municipios pero ninguno clasificado todavía queda en 0 — cantidad sola no implica gravedad confirmada.</p>
      <div class="accordion-list">{accordion_html}
      </div>
      <p class="note" style="font-size:12px;margin-top:8px;">*Población aproximada del municipio (DANE). Fuente: data/municipios_afectados_terremoto_colombia_ago2026.csv — ver data/README.md.</p>
    </section>
  </div>"""

    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{refresh_tag}
<title>Impacto del Terremoto — local</title>
<style>
  :root {{
    --bg: #eef0ee; --surface: #ffffff; --surface-2: #f7f7f5; --border: #dadcd8;
    --ink: #14171a; --muted: #5c635f; --accent: #1f5fae; --accent-soft: #e4edf8;
    --ok: #2f7a4f; --warn: #b3391f;
    --shadow: 0 1px 2px rgba(20,23,26,0.04), 0 8px 24px -12px rgba(20,23,26,0.12);
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, "Segoe UI", BlinkMacSystemFont, sans-serif; line-height: 1.5; }}
  .mono {{ font-family: ui-monospace, "Cascadia Mono", SFMono-Regular, Menlo, Consolas, monospace; }}
  .wrap {{ max-width: 1180px; margin: 0 auto; padding: 32px 22px 80px; }}
  .statusbar {{ display: flex; align-items: center; gap: 14px; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; margin-bottom: 28px; box-shadow: var(--shadow); }}
  .pill {{ display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; padding: 4px 10px 4px 8px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }}
  .pill .dot {{ width: 7px; height: 7px; border-radius: 50%; background: var(--ok); flex: none; }}
  .pill.stale .dot {{ background: var(--warn); }}
  .statusbar .sep {{ width: 1px; height: 16px; background: var(--border); }}
  .statusbar .meta-text {{ font-size: 12.5px; color: var(--muted); }}
  .statusbar .meta-text b {{ color: var(--ink); font-weight: 600; }}
  .statusbar .spacer {{ flex: 1; }}
  header.hero {{ padding-bottom: 22px; margin-bottom: 6px; }}
  .kicker {{ font-size: 12px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--accent); margin-bottom: 12px; }}
  h1 {{ font-size: clamp(26px, 3.4vw, 34px); margin: 0 0 10px; letter-spacing: -0.015em; }}
  .subtitle {{ color: var(--muted); font-size: 15.5px; max-width: 680px; }}
  .tiles {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 26px 0 34px; }}
  .tile {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 17px; box-shadow: var(--shadow); }}
  .tile.critical {{ border-color: #d9a89c; }}
  .tile-label {{ font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; }}
  .tile-value {{ font-size: 23px; font-weight: 600; letter-spacing: -0.01em; }}
  .tile-value.warn {{ color: var(--warn); }}
  .tile-sub {{ font-size: 12.5px; color: var(--muted); margin-top: 3px; }}
  section {{ margin-top: 40px; }}
  .section-head {{ display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 4px; flex-wrap: wrap; }}
  .section-head h2 {{ font-size: 18px; margin: 0; }}
  .legend-track {{ display: flex; width: 130px; height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border); }}
  .legend-stop {{ flex: 1; }}
  .legend-labels {{ display: flex; justify-content: space-between; width: 130px; font-size: 10.5px; color: var(--muted); margin-top: 2px; }}
  p.note {{ color: var(--muted); font-size: 14px; max-width: 760px; margin: 8px 0 16px; }}
  .table-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }}
  .table-scroll {{ overflow-x: auto; }}
  table.heat {{ width: 100%; border-collapse: collapse; font-size: 13px; min-width: 760px; }}
  table.heat th, table.heat td {{ padding: 9px 12px; border-bottom: 1px solid var(--border); }}
  table.heat thead th {{ position: sticky; top: 0; background: var(--surface-2); z-index: 2; text-align: center; color: var(--muted); font-weight: 600; font-size: 10.8px; text-transform: uppercase; white-space: nowrap; }}
  table.heat thead th.left {{ text-align: left; }}
  table.heat td.dep-cell {{ position: sticky; left: 0; background: var(--surface); z-index: 1; font-weight: 600; white-space: nowrap; border-right: 1px solid var(--border); }}
  table.heat thead th:first-child {{ position: sticky; left: 0; z-index: 3; text-align: left; }}
  table.heat td.num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
  table.heat td.num.muted {{ color: var(--muted); }}
  table.heat td.compuesto {{ font-weight: 700; min-width: 148px; }}
  table.heat td.cell {{ text-align: center; font-variant-numeric: tabular-nums; font-weight: 500; }}
  table.heat tbody tr:last-child td {{ border-bottom: none; }}
  .compbar {{ display: inline-block; width: 60px; height: 6px; border-radius: 3px; background: var(--surface-2); margin-left: 8px; vertical-align: middle; overflow: hidden; }}
  .compbar-fill {{ height: 100%; }}
  details.method {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 4px 18px; box-shadow: var(--shadow); }}
  details.method summary {{ cursor: pointer; padding: 14px 0; font-weight: 600; font-size: 14.5px; }}
  details.method .method-body {{ padding: 0 0 18px; color: var(--muted); font-size: 13.8px; max-width: 780px; }}
  details.method .method-body p {{ margin: 0 0 10px; }}
  details.method .method-body code {{ background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 0.92em; color: var(--ink); }}
  .tab-nav {{ display: flex; gap: 6px; margin: 22px 0 0; border-bottom: 1px solid var(--border); }}
  .tab-btn {{ font: inherit; font-size: 13.5px; font-weight: 600; color: var(--muted); background: none; border: none; border-bottom: 2px solid transparent; padding: 10px 4px; margin-bottom: -1px; cursor: pointer; }}
  .tab-btn + .tab-btn {{ margin-left: 14px; }}
  .tab-btn.active {{ color: var(--accent); border-bottom-color: var(--accent); }}
  .tab-panel[hidden] {{ display: none; }}
  .accordion-list {{ display: flex; flex-direction: column; gap: 8px; }}
  details.dep-accordion {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }}
  details.dep-accordion summary {{ cursor: pointer; list-style: none; padding: 13px 16px; display: flex; align-items: center; gap: 16px; font-weight: 600; font-size: 14px; }}
  details.dep-accordion summary::-webkit-details-marker {{ display: none; }}
  details.dep-accordion summary::before {{ content: "▸ "; color: var(--muted); }}
  details.dep-accordion[open] summary::before {{ content: "▾ "; }}
  .dep-accordion-name {{ flex: 1 1 auto; }}
  .dep-accordion-score {{ flex: none; display: flex; align-items: center; gap: 8px; }}
  .score-badge {{ display: inline-flex; align-items: center; justify-content: center; min-width: 26px; padding: 2px 6px; border-radius: 999px; font-size: 12px; font-weight: 700; }}
  .dep-accordion-count {{ flex: none; font-weight: 500; font-size: 12px; color: var(--muted); white-space: nowrap; }}
  @media (max-width: 640px) {{ .dep-accordion-score {{ display: none; }} }}
  table.muni {{ width: 100%; border-collapse: collapse; font-size: 12.8px; min-width: 640px; }}
  table.muni th, table.muni td {{ padding: 7px 12px; border-top: 1px solid var(--border); }}
  table.muni thead th {{ text-align: center; color: var(--muted); font-weight: 600; font-size: 10.5px; text-transform: uppercase; white-space: nowrap; background: var(--surface-2); }}
  table.muni thead th.left {{ text-align: left; }}
  table.muni td.num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
  table.muni td.num.muted {{ color: var(--muted); }}
  table.muni td.nota {{ color: var(--muted); font-size: 12px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .sev-badge {{ display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }}
  footer {{ margin-top: 44px; padding-top: 18px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12.5px; display: flex; flex-direction: column; gap: 4px; }}
  a {{ color: var(--accent); }}
</style>
</head>
<body>
<div class="wrap">
  <div class="statusbar">
    <span class="pill" id="freshness-pill"><span class="dot"></span><span id="freshness-text">verificando…</span></span>
    <span class="sep"></span>
    <span class="meta-text">Snapshot fuente: <b>{snap_label}</b></span>
    <span class="sep"></span>
    <span class="meta-text">Tablero generado: <b>{build_label}</b></span>
    <span class="spacer"></span>
    <span class="meta-text mono">{n_dep} departamentos · {meta.get('n_puntos', 0):,} puntos</span>
  </div>
  <header class="hero">
    <div class="kicker">Índice de impacto · Terremoto de Colombia, 2026 · generado localmente</div>
    <h1>Impacto por departamento</h1>
    <p class="subtitle">Salud, vivienda, instituciones, educación y productividad económica combinadas en un índice per cápita de 0 a 100, recalculado desde <span class="mono">registro.json</span> de mapadelterremoto.com cada vez que corres este script.</p>
  </header>
  {tab_nav_html}
  <div id="tab-departamental" class="tab-panel">
  <div class="tiles">
    <div class="tile critical">
      <div class="tile-label">Departamento más crítico</div>
      <div class="tile-value warn">{peor['departamento']}</div>
      <div class="tile-sub">índice {peor['indice_compuesto']:.1f} / 100</div>
    </div>
    <div class="tile">
      <div class="tile-label">Menos crítico (con dato)</div>
      <div class="tile-value">{mejor_evaluado['departamento']}</div>
      <div class="tile-sub">índice {mejor_evaluado['indice_compuesto']:.1f} / 100</div>
    </div>
    <div class="tile">
      <div class="tile-label">Población cubierta</div>
      <div class="tile-value">{poblacion_total:,}</div>
      <div class="tile-sub">en {n_dep} departamentos con puntos registrados</div>
    </div>
    <div class="tile">
      <div class="tile-label">Puntos en el registro</div>
      <div class="tile-value">{meta.get('n_puntos', 0):,}</div>
      <div class="tile-sub">agregados de {n_dep} departamentos</div>
    </div>
  </div>
  <section>
    <div class="section-head">
      <h2>Las 5 dimensiones, por departamento</h2>
      <div>
        <div class="legend-track">{legend_stops}</div>
        <div class="legend-labels"><span>0</span><span>100</span></div>
      </div>
    </div>
    <p class="note">Cada celda es el puntaje 0-100 de esa dimensión, per cápita — más oscuro y rojizo es peor. Ordenado por índice compuesto descendente.</p>
    <div class="table-card">
      <div class="table-scroll">
        <table class="heat">
          <thead><tr><th class="left">Departamento</th><th>Población*</th><th>Índice</th>{header_dim_cells}</tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
      </div>
    </div>
    <p class="note" style="font-size:12px;margin-top:8px;">*Población de los municipios que el sitio marca como afectados dentro de ese departamento, no el censo departamental completo.</p>
  </section>
  <section>
    <details class="method">
      <summary>Metodología y limitaciones</summary>
      <div class="method-body">
        <p>Unidad geográfica: departamento (25). <b>Salud</b> = puntos tipo <code>HOSPITAL</code>; <b>Vivienda</b> = <code>VIVIENDA</code>; <b>Educación</b> = <code>ESCUELA</code>; <b>Instituciones</b> = puntos cuyo texto menciona una sede de gobierno o gestión pública; <b>Productividad (proxy)</b> = <code>SERVICIO</code> + <code>PUNTO_AYUDA</code> + <code>RESTRICCION</code>.</p>
        <p>Cada punto pesa según severidad (COLAPSO=4, GRAVE=3, MODERADO=2, LEVE=1, SIN_EVALUAR=1). Cada dimensión se divide por la población afectada del departamento y se normaliza 0-100 (mínimo-máximo entre los 25). El índice compuesto es el promedio simple de las 5 dimensiones.</p>
      </div>
    </details>
  </section>
  </div>
  {tab_municipal_html}
  <footer>
    <span>Fuente: <span class="mono">registro.json</span> de <a href="https://mapadelterremoto.com" target="_blank" rel="noopener">mapadelterremoto.com</a>, un agregador de prensa — no un censo oficial de campo.</span>
    <span>Generado localmente con <span class="mono">actualizar_indice_terremoto.py</span>. Esta página se autorrecarga cada {autorefresh_seconds // 3600 if autorefresh_seconds else 0} horas si la dejas abierta — recarga el mismo archivo en disco, así que si el Programador de tareas la actualizó, verás el dato nuevo solo.</span>
  </footer>
</div>
<script>
(function() {{
  var SNAPSHOT_ISO = {json.dumps(snapshot_iso)};
  var BUILD_ISO = {json.dumps(build_iso)};
  function fmtAgo(iso) {{
    if (!iso) return null;
    var then = new Date(iso).getTime();
    if (isNaN(then)) return null;
    var h = (Date.now() - then) / 3600000;
    if (h < 1) return Math.max(1, Math.round(h * 60)) + " min";
    if (h < 48) return Math.round(h) + " h";
    return Math.round(h / 24) + " días";
  }}
  var pill = document.getElementById("freshness-pill");
  var text = document.getElementById("freshness-text");
  var ago = fmtAgo(SNAPSHOT_ISO || BUILD_ISO);
  var hours = (Date.now() - new Date(SNAPSHOT_ISO || BUILD_ISO).getTime()) / 3600000;
  if (ago === null) {{ text.textContent = "fecha desconocida"; }}
  else if (hours > 30) {{ pill.classList.add("stale"); text.textContent = "desactualizado · hace " + ago; }}
  else {{ text.textContent = "en vivo · hace " + ago; }}
}})();
(function() {{
  var btns = document.querySelectorAll(".tab-btn");
  if (!btns.length) return;
  var panels = {{
    departamental: document.getElementById("tab-departamental"),
    municipal: document.getElementById("tab-municipal"),
  }};
  btns.forEach(function(btn) {{
    btn.addEventListener("click", function() {{
      btns.forEach(function(b) {{ b.classList.remove("active"); b.setAttribute("aria-selected", "false"); }});
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      var target = btn.getAttribute("data-tab");
      Object.keys(panels).forEach(function(key) {{
        if (!panels[key]) return;
        panels[key].hidden = key !== target;
      }});
    }});
  }});
}})();
</script>
</body>
</html>
"""
    return html


def main():
    ap = argparse.ArgumentParser(description="Actualiza el índice de impacto del terremoto (local, sin Claude).")
    ap.add_argument("--url", default=URL_POR_DEFECTO, help="URL o ruta local de registro.json (por defecto: el endpoint público del sitio)")
    ap.add_argument("--out", default="dashboard_impacto_terremoto.html", help="Ruta del HTML de salida")
    ap.add_argument("--csv", default="indice_impacto_departamento.csv", help="Ruta del CSV del índice (para Excel/Power BI/lo que sea)")
    ap.add_argument("--poblacion", default=None, help=f"CSV externo de población por departamento o por municipio (opcional; por defecto usa {MUNICIPIOS_POBLACION_CSV} si existe, si no la tabla embebida). Pasa '' vacío para forzar la tabla embebida.")
    ap.add_argument("--sin-autorefresh", action="store_true", help="No agregar la etiqueta de autorrecarga cada 4h al HTML")
    args = ap.parse_args()

    print(f"[{datetime.now().isoformat(timespec='seconds')}] Descargando/leyendo: {args.url}")
    try:
        data = load_registro(args.url)
    except Exception as e:
        print(f"[{datetime.now().isoformat(timespec='seconds')}] ERROR al obtener registro.json: {e}", file=sys.stderr)
        sys.exit(1)

    poblacion_path = args.poblacion
    if poblacion_path is None:
        poblacion_path = MUNICIPIOS_POBLACION_CSV if os.path.exists(MUNICIPIOS_POBLACION_CSV) else None
    fuente_pob = poblacion_path if poblacion_path else "tabla embebida (POBLACION_CSV)"
    print(f"[{datetime.now().isoformat(timespec='seconds')}] Población por departamento desde: {fuente_pob}")
    dep_pop = load_dep_population(poblacion_path or None)
    rows = compute_indice(data, dep_pop)
    meta = {
        "actualizado_snapshot": data.get("actualizado"),
        "n_puntos": len(data.get("puntos", [])),
        "n_departamentos": len(rows),
    }

    municipios = load_municipios(MUNICIPIOS_POBLACION_CSV)
    resumen_meta = load_resumen_meta(RESUMEN_UNGRD_JSON)
    if municipios:
        print(f"[{datetime.now().isoformat(timespec='seconds')}] Vista municipal: {len(municipios)} municipios cargados de {MUNICIPIOS_POBLACION_CSV}")

    write_indice_csv(rows, args.csv)
    html = build_html(
        rows, meta, autorefresh_seconds=0 if args.sin_autorefresh else 14400,
        municipios=municipios, resumen_meta=resumen_meta,
    )
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"[{datetime.now().isoformat(timespec='seconds')}] OK -> {args.out} ({len(html)/1024:.1f} KB) y {args.csv} — {json.dumps(meta, ensure_ascii=False)}")


if __name__ == "__main__":
    main()