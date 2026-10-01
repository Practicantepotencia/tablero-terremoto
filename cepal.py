"""Separate CEPAL II accounts from the dashboard's own priority score.

The manual defines concepts, not this input contract or the municipal ranking.
Unverified observations remain in the original inventory, never valued by inference.
"""
from collections import Counter, defaultdict
from datetime import date
import math

REFERENCE = {'title': 'CEPAL, Manual para la Evaluación de Desastres',
             'document': 'LC/L.3691', 'edition': '2014-02', 'chapter': 'II',
             'printed_pages': '33-43', 'pdf_pages': '34-44'}
EFFECTS = {'damage': 'Daños', 'loss': 'Pérdidas de flujos',
           'additional_cost': 'Costos adicionales'}
AGENTS = {'household', 'private_company', 'public_company',
          'central_government', 'regional_government', 'local_government'}
DAMAGE_INDICATORS = {'pnud_vivt_cop', 'pnud_salud_cop', 'pnud_edu_cop',
                    'pnud_com_cop', 'pnud_infra_cop', 'pnud_tot_cop',
                    'undp_rapida_econ_dmg_households_cop', 'undp_rapida_econ_dmg_infra_cop',
                    'undp_rapida_econ_dmg_total_cop'}


def classify(row):
    """Conceptual classification is not accreditation of the source's estimate."""
    source, indicator, unit = row['f'], row['id'], row['u']
    if unit == 'COP':
        damage_candidate = indicator in DAMAGE_INDICATORS
        return {'kind': 'monetary_estimate', 'label': 'Estimación monetaria publicada',
                'account': 'damage_candidate' if damage_candidate else None, 'status': 'pending_valuation',
                'note': 'Valoración, línea base y posibles solapamientos pendientes. No acredita pérdidas de flujos ni presupuesto de reconstrucción.'}
    if indicator == '3is_rescatados':
        kind, label = 'response', 'Respuesta realizada'
    elif indicator in {'en_decreto_1171', 'gravedad_oficial'}:
        kind, label = 'context', 'Ámbito o clasificación'
    elif indicator.endswith(('_mpi', '_liquefaction', '_landslides')):
        kind, label = 'context', 'Vulnerabilidad o amenaza'
    elif indicator.endswith('recovery_needs'):
        kind, label = 'external_index', 'Índice externo'
    elif source == 'Naboo':
        kind, label = 'reports', 'Puntos reportados'
    elif source == 'Camaras':
        kind, label = 'reported_businesses', 'Empresarios reportados'
    elif indicator in {'3is_familias', '3is_fallecidos', '3is_desaparecidos', '3is_heridos'} or '_pop_' in indicator or 'matricula' in indicator or 'docentes' in indicator:
        kind, label = 'people', 'Personas, familias o matrícula reportada'
    elif indicator.endswith(('_exp', '_exp_km')):
        kind, label = 'exposure', 'Exposición física'
    elif unit == 'm³':
        kind, label = 'debris', 'Volumen de escombros'
    else:
        kind, label = 'physical', 'Afectación física reportada'
    return {'kind': kind, 'label': label, 'account': None, 'status': 'context_only',
            'note': 'No es una valoración monetaria de daños, pérdidas o costos adicionales.'}


def iso(value):
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value
    except (ValueError, TypeError):
        return False


def number(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)


def evaluate(registry):
    """Validate comparable, source-independent accounting units before aggregation.

    coverage_keys identify disjoint assets or activities, NOT source record IDs.
    Unknown is null, including totals with no accepted records. No grand total or
    macroeconomic impact is calculated from damage and flow accounts.
    """
    event = registry.get('event_date')
    issues, candidates = [], []
    for index, raw in enumerate(registry.get('records', [])):
        if not isinstance(raw, dict):
            issues.append({'record': str(index), 'reasons': ['El registro debe ser un objeto']})
            continue
        r = dict(raw)
        reasons = []
        required = ('id', 'code', 'sector', 'source', 'locator', 'baseline_source',
                    'baseline_locator', 'attribution_evidence', 'reviewed_by', 'price_basis')
        if any(not isinstance(r.get(k), str) or not r[k].strip() for k in required):
            reasons.append('Falta identidad, fuente, línea base, valoración o revisión sectorial')
        if not (isinstance(r.get('code'), str) and len(r['code']) == 5 and r['code'].isdigit()):
            reasons.append('DIVIPOLA municipal inválido')
        if not isinstance(r.get('effect'), str) or r.get('effect') not in EFFECTS or not isinstance(r.get('agent'), str) or r.get('agent') not in AGENTS or r.get('currency') != 'COP':
            reasons.append('Cuenta, agente o moneda incompatible')
        if not iso(event) or not iso(r.get('baseline_date')) or r['baseline_date'] >= event:
            reasons.append('Línea base previa al evento no acreditada')
        if not iso(r.get('observed_at')) or iso(event) and r['observed_at'] < event:
            reasons.append('Fecha efectiva de observación inválida')
        if r.get('attribution') != 'verified':
            reasons.append('Atribución al evento no verificada')
        keys = r.get('coverage_keys')
        if not isinstance(keys, list) or not keys or any(not isinstance(k, str) or not k.strip() for k in keys) or len(keys) != len(set(keys)):
            reasons.append('Unidades contables sin delimitación única')
        for share in ('insured_share', 'imported_share'):
            if r.get(share) is not None and (not number(r[share]) or not 0 <= r[share] <= 1):
                reasons.append('Proporción de seguro o importación inválida')
        if r.get('effect') == 'damage':
            if not all(number(r.get(k)) and r[k] >= 0 for k in ('quantity', 'baseline_quantity', 'unit_price')) or not r.get('physical_unit'):
                reasons.append('Cantidad física, acervo previo o precio faltante')
            elif r['quantity'] > r['baseline_quantity']:
                reasons.append('Cantidad afectada superior al acervo previo homologado')
            if r.get('valuation') != 'equivalent_replacement' or not iso(r.get('price_date')) or iso(event) and r['price_date'] >= event:
                reasons.append('Falta precio preevento de reposición equivalente')
            if r.get('preexisting_deficit_excluded') is not True or r.get('resilience_upgrade_excluded') is not True:
                reasons.append('Daños mezclados con déficit previo o mejoras de reconstrucción')
            amount = r.get('quantity', 0) * r.get('unit_price', 0) if not reasons else None
        else:
            period = r.get('period', '')
            if not isinstance(period, str) or not iso(period + '-01') or iso(event) and period < event[:7]:
                reasons.append('Periodo mensual posterior al evento inválido')
            if r.get('effect') == 'loss':
                if not all(number(r.get(k)) and r[k] >= 0 for k in ('baseline_flow', 'post_disaster_flow')) or not r.get('scenario_basis'):
                    reasons.append('Falta escenario mensual sin/con desastre')
                if not isinstance(r.get('flow_treatment'), str) or r.get('flow_treatment') not in {'lost', 'deferred'}:
                    reasons.append('Falta distinguir producción perdida o diferida')
                amount = r.get('baseline_flow', 0) - r.get('post_disaster_flow', 0) if not reasons else None
            else:
                if not number(r.get('incremental_expenditure')) or r.get('incremental_expenditure', -1) < 0 or r.get('expenditure_status') != 'incurred' or not isinstance(r.get('payer_agent'), str) or r.get('payer_agent') not in AGENTS:
                    reasons.append('Falta gasto incremental efectuado o agente pagador')
                if r.get('excludes_asset_replacement') is not True:
                    reasons.append('Costo adicional mezclado con reposición de activos')
                amount = r.get('incremental_expenditure') if not reasons else None
        if not reasons and not number(amount):
            reasons.append('Resultado monetario no finito')
        if reasons:
            issues.append({'record': r.get('id', str(index)), 'reasons': reasons})
        else:
            candidates.append({**r, 'amount': amount})
    # A source cannot become an extra vote for the same asset/activity/month.
    copies, seen = [], set()
    import json
    for r in candidates:
        canonical = json.dumps(r, sort_keys=True, ensure_ascii=False)
        if canonical not in seen:
            copies.append(r)
            seen.add(canonical)
    keys = Counter((r['code'], r['effect'], key, r.get('period', 'event')) for r in copies for key in r['coverage_keys'])
    ids = Counter(r['id'] for r in copies)
    accepted = []
    for r in copies:
        if ids[r['id']] > 1 or any(keys[(r['code'], r['effect'], k, r.get('period', 'event'))] > 1 for k in r['coverage_keys']):
            issues.append({'record': r['id'], 'reasons': ['Solapamiento contable o identidad conflictiva; conciliación pendiente']})
        else:
            accepted.append(r)
    groups = defaultdict(list)
    for r in accepted:
        groups[(r['code'], r['sector'], r['effect'], r['agent'], r['currency'], r['price_basis'], r.get('period'), r.get('flow_treatment'))].append(r)
    totals = [dict(zip(('code', 'sector', 'effect', 'agent', 'currency', 'price_basis', 'period', 'flow_treatment'), key),
                   amount=sum(r['amount'] for r in rs), records=len(rs), status='partial_documented') for key, rs in sorted(groups.items(), key=str)]
    return {'reference': REFERENCE, 'event_date': event, 'records': accepted, 'totals': totals,
            'issues': issues, 'deduplicated': len(candidates)-len(copies),
            'status': 'partial_documented' if accepted else 'not_evaluated',
            'accounts': {k: {'label': label, 'records': sum(r['effect'] == k for r in accepted),
                             'value': None} for k, label in EFFECTS.items()}}


def prepare(rows, registry):
    result = evaluate(registry)
    result['catalog'] = {r['f'] + '|' + r['id']: {**classify(r),
                          'original_dimension': r.get('original_dimension', r['dim'])} for r in rows}
    result['index'] = {'kind': 'own_multicriteria_priority', 'cepal_formula': False,
                       'financial_needs': False, 'validated_in_field': False}
    return result
