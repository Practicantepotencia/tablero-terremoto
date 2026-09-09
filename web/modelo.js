/* Pure calculations shared by the standalone dashboard and Node tests. */
(function (root) {
  'use strict';
  const RECOVERY = 'undp_rapida_recovery_needs', IPM = 'undp_rapida_mpi', RAPIDA = 'UNDP-RAPIDA';
  const sectors = [
    ['Vivienda', ['undp_rapida_bdg_homes_dest', 'undp_rapida_bdg_homes_dmg']],
    ['Salud', ['undp_rapida_bdg_health_aff']],
    ['Educación', ['undp_rapida_bdg_edu_aff']],
    ['Instituciones', ['undp_rapida_bdg_comm_aff', 'undp_rapida_bdg_public_imp']],
    ['Economía', ['undp_rapida_econ_dmg_total_cop']]
  ];
  const unique = a => [...new Set(a)];
  const cohort = r => JSON.stringify([r.f, r.lv, r.dim, r.id, r.u, r.i]);
  const quantile = (a, p) => {
    a = a.filter(Number.isFinite).slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const x = (a.length - 1) * p, l = Math.floor(x), h = Math.ceil(x);
    return a[l] + (a[h] - a[l]) * (x - l);
  };
  const percentile = (values, v) => !values.length || !Number.isFinite(v) ? null :
    100 * (values.filter(x => x < v).length + .5 * values.filter(x => x === v).length) / values.length;
  const label = r => r.lv === 'municipal' ? `${r.m}, ${r.d}` : r.d;
  const byName = (a, b) => label(a).localeCompare(label(b), 'es');
  const searchMatch = (r, search = '') => label(r).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  function create(data) {
    const rows = data.rows;
    const supplemental = data.supplemental?.rows || [];
    const catalog = [...new Map([...rows, ...supplemental].map(r => [cohort(r), {key: cohort(r), f: r.f, lv: r.lv, dim: r.dim, id: r.id, u: r.u, i: r.i, external: r.external, period: r.period}])).values()];
    function decree(date) {
      return new Set(rows.filter(r => r.date === date && r.id === 'en_decreto_1171' && r.f === 'Decreto1171' && r.v === 1).map(r => r.d));
    }
    function inScope(r, state) { return state.scope !== 'decree' || decree(state.date).has(r.d); }
    function visible(state, date = state.date, ignoreDept = false) {
      const deps = decree(state.date); // Same geographic boundary for historical comparisons.
      const snapshot = rows.filter(r => r.date === date);
      // Published baseline periods are not invented historical inventory captures.
      if (date === data.latest) snapshot.push(...supplemental);
      return snapshot.filter(r => (state.scope !== 'decree' || deps.has(r.d)) && (ignoreDept || !state.dept || r.d === state.dept));
    }
    function strict(base, id, source = RAPIDA) {
      const found = base.filter(r => r.lv === 'municipal' && r.f === source && r.id === id);
      return unique(found.map(cohort)).length > 1 ? [] : found;
    }
    function ranked(items, order = 'desc', search = '') {
      const sorted = items.slice().sort((a, b) => (order === 'asc' ? a.v - b.v : b.v - a.v) || byName(a, b));
      let previous, position = 0;
      return sorted.map((r, i) => { if (i === 0 || r.v !== previous) position = i + 1; previous = r.v; return {...r, rank: position}; })
        .filter(r => searchMatch(r, search));
    }
    function priorities(state) {
      const reference = visible(state, state.date, true);
      const rec = strict(reference, RECOVERY), ipm = new Map(strict(reference, IPM).map(r => [r.geo, r]));
      const qr = quantile(rec.map(r => r.v), .75), qi = quantile([...ipm.values()].map(r => r.v), .75);
      const canBand = rec.length >= 4 && new Set(rec.map(r => r.v)).size > 1;
      const available = new Map();
      const comparableSectorRows = sectors.flatMap(([, fields]) => fields.flatMap(id => strict(reference, id)));
      comparableSectorRows.forEach(r => {
        if (!available.has(r.geo)) available.set(r.geo, new Set());
        available.get(r.geo).add(r.id);
      });
      const enriched = rec.map(r => {
        const baseline = ipm.get(r.geo), ids = available.get(r.geo) || new Set();
        return {...r, ipm: baseline?.v ?? null, high: canBand && r.v >= qr,
          ipmHigh: ipm.size >= 4 && baseline?.v >= qi && new Set([...ipm.values()].map(x => x.v)).size > 1,
          coverage: sectors.filter(([, fields]) => fields.every(id => ids.has(id))).length,
          percentile: percentile(rec.map(r => r.v), r.v)};
      });
      const pool = enriched.filter(r => !state.dept || r.d === state.dept);
      const recGeos = new Set(rec.map(r => r.geo));
      const municipalities = [...new Map(visible(state).filter(r => r.lv === 'municipal' && !r.external).map(r => [r.geo, r])).values()];
      return {items: ranked(pool, 'desc', state.search), pool, missing: municipalities.filter(r => !recGeos.has(r.geo)).sort(byName),
        total: municipalities.length, qr, qi, referenceN: rec.length, canBand,
        mixed: reference.some(r => r.id === RECOVERY && r.f === RAPIDA) && !rec.length};
    }
    function sector(state) {
      const meta = catalog.find(m => m.key === state.metric);
      const pool = meta ? visible(state).filter(r => cohort(r) === meta.key) : [];
      const eligible = new Set(visible(state).filter(r => r.lv === state.level).map(r => r.geo));
      return {meta, pool, total: eligible.size, items: ranked(pool, state.order, state.search)};
    }
    function profile(state, geo) {
      const base = visible(state).filter(r => r.f === state.source && r.lv === state.level);
      return base.filter(r => r.geo === geo).map(r => ({...r,
        percentile: percentile(base.filter(x => cohort(x) === cohort(r)).map(x => x.v), r.v)}))
        .sort((a, b) => a.dim.localeCompare(b.dim, 'es') || a.i.localeCompare(b.i, 'es'));
    }
    function history(state, key, geo = '') {
      const dates = data.dates.filter(d => d <= state.date);
      const groups = dates.map(d => visible(state, d).filter(r => cohort(r) === key && (!geo || r.geo === geo)));
      // Include empty captures: a source outage invalidates the balanced panel.
      let common = new Set((groups[0] || []).map(r => r.geo));
      groups.forEach(group => { const seen = new Set(group.map(r => r.geo)); common = new Set([...common].filter(k => seen.has(k))); });
      const points = dates.map((d, i) => ({date: d, v: quantile(groups[i].filter(r => common.has(r.geo)).map(r => r.v), .5),
        n: common.size, observed: groups[i].length}));
      return {points, n: common.size, ready: points.length >= 2 && common.size > 0,
        delta: points.length >= 2 && common.size > 0 ? points.at(-1).v - points[0].v : null};
    }
    function matrixLayout(state) {
      const source = state.matrixSource || RAPIDA, level = state.matrixLevel || 'municipal';
      const metas = catalog.filter(m => m.f === source && m.lv === level);
      if (source === RAPIDA && level === 'municipal') {
        return sectors.map(([name, ids]) => ({name, metrics: ids.map(id => ({id, strict: true}))}));
      }
      const exe = [
        ['Sedes afectadas', 'sedes_edu_n_sedes'], ['Sedes críticas', 'sedes_edu_n_sedes_criticas'],
        ['Matrícula afectada', 'sedes_edu_matricula_afectada'], ['Docentes afectados', 'sedes_edu_docentes_afectados']
      ];
      const groups = new Map();
      if (source === 'FundacionExe') exe.forEach(([name, id]) => groups.set(name, metas.filter(m => m.id === id)));
      const assigned = new Set([...groups.values()].flat().map(m => m.key));
      metas.filter(m => !assigned.has(m.key)).sort((a,b) => a.dim.localeCompare(b.dim,'es') || a.i.localeCompare(b.i,'es')).forEach(m => {
        const name = source === 'FundacionExe' ? m.i : m.dim;
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(m);
      });
      return [...groups].filter(([, metrics]) => metrics.length).map(([name, metrics]) => ({name, metrics}));
    }
    function matrix(state, recoveryItems) {
      const source = state.matrixSource || RAPIDA, level = state.matrixLevel || 'municipal';
      if (!recoveryItems && level === 'municipal') {
        const p = priorities({...state, search: ''});
        recoveryItems = [...p.items, ...p.missing.map(r => ({...r, rank: null}))];
      }
      const visibleRows = visible(state);
      if (!recoveryItems) recoveryItems = [...new Map(visibleRows.filter(r => r.lv === level).map(r => [r.geo,r])).values()].sort(byName);
      const base = visibleRows.filter(r => r.f === source && r.lv === level);
      const known = new Set(recoveryItems.map(r => r.geo));
      const additional = [...new Map(base.filter(r => !known.has(r.geo)).map(r => [r.geo, r])).values()].sort(byName);
      recoveryItems = recoveryItems.concat(additional);
      const layout = matrixLayout(state);
      const fields = new Map(layout.flatMap(s => s.metrics).map(meta => {
        const group = meta.strict ? strict(base, meta.id, source) : base.filter(r => cohort(r) === meta.key);
        const values = group.map(r => r.v);
        return [meta.key || meta.id, new Map(group.map(r => [r.geo, {...r,
          p: /Categoría|Sí\/No/.test(r.u) ? null : percentile(values, r.v)}]))];
      }));
      return recoveryItems.filter(r => searchMatch(r, (state.matrixSearch || '').trim())).map(r => ({...r, f: source, cells: layout.map(({name, metrics}) => {
        // Separate categories, never add potentially overlapping buildings.
        const cells = metrics.map(meta => fields.get(meta.key || meta.id).get(r.geo) || null);
        return {name, cells};
      })}));
    }
    return {catalog, decree, inScope, visible, strict, ranked, priorities, sector, profile, history, matrix, matrixLayout};
  }
  const api = {create, cohort, quantile, percentile, label, searchMatch, sectors, RECOVERY, IPM, RAPIDA};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Territorial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
