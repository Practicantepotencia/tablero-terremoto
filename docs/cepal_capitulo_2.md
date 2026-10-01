# Priorización municipal y evaluación CEPAL

Este documento registra la etapa `cepal-capitulo-2-priorizacion-municipal`
en `5770524`. La etapa hija y su modelo educativo vigente se describen en
[integracion_educativa.md](integracion_educativa.md).

La etapa original aplica el capítulo II del **Manual para la Evaluación de Desastres**,
CEPAL, LC/L.3691, febrero de 2014, pp. impresas 33–43 (PDF 34–44).
Referencia examinada: `S2013806_es.pdf`, adjunto del usuario.
La implementación de esa etapa se detuvo en este capítulo.

## Decisión principal

El tablero ordena la revisión de municipios con un **índice propio**, basado en
afectaciones documentadas. El capítulo II no prescribe un ranking, sus pesos ni
un ajuste por pobreza. No se presenta el índice como valoración monetaria CEPAL,
presupuesto de reconstrucción o estimación de ayudas pendientes.

Se conserva la fórmula de `main` c66aa361: cinco sectores con peso 1/5,
nueve campos puntuables y familias solo informativas. Vivienda pondera destruidas
2/3 y averiadas 1/3. PNUD tiene precedencia y 3iS actúa como respaldo; el cero
explícito es válido. El ajuste es `P = D × (1 + 0,25 × IPM/100) / 1,25`, con IPM
censal DANE 2018. Estos son supuestos del producto, no parámetros de CEPAL.
Buscar y filtrar departamento no recalibra; ámbito y captura sí. Los intervalos
por faltantes mantienen los pesos y no son intervalos de confianza. Se muestran
también en la celda municipal porque el orden por límite inferior puede favorecer
territorios mejor documentados. El orden no identifica por sí solo necesidades
netas ni demuestra que un municipio deba financiarse antes que otro.

La fórmula y sus pesos no se sustituyen por otros sin validación. La referencia
`educacion-matricula-critica` 25c13842 se inspeccionó, pero no se fusionó: su
componente matrícula crítica no identifica interrupción efectiva del servicio y
su activación histórica requiere una política de vigencia propia. Esta rama
no repondera retroactivamente Educación.

## Cambios ligados al capítulo II

| Principio CEPAL | Aplicación en el producto |
| --- | --- |
| Daños: magnitud física × precio de reposición equivalente anterior al evento (B.1–2, pp. 34–35) | Se conserva el conteo físico. Las estimaciones COP se clasifican aparte y quedan pendientes de acreditar precio, acervo y cobertura. |
| Daño no es presupuesto de reconstrucción ni déficit previo (B.5, p. 35) | El registro exige excluir mejoras de resiliencia y déficits anteriores. No calcula necesidades financieras restando ayudas a un puntaje. |
| Agentes y territorio (B.3–4 y B.7, pp. 34–36) | Se exige DIVIPOLA, sector y agente afectado. Se separa pagador cuando hay costos adicionales. Seguro e importaciones desconocidos permanecen nulos. |
| Pérdidas: alteraciones de flujos frente al escenario sin desastre (C.1–4, pp. 36–39) | Se requieren línea base y escenario mensual. No se convierte matrícula o número de empresarios en pérdidas. Producción diferida queda separada; una diferencia negativa no se recorta a cero. |
| Costos adicionales efectivamente efectuados (C.1, p. 37) | Cuenta separada para gasto incremental, con periodo y pagador. No se admite presupuesto planeado como costo ejecutado. |
| No agregar efectos sectoriales como impacto macroeconómico (C.6, p. 39) | No hay total de daños + pérdidas + costos ni estimación automática de PIB. |
| Evidencia contrastable, fechas y base previa (D, pp. 40–43) | Se distingue captura de observación. Se conservan fuente, versión y rótulo original; conflictos y solapamientos se excluyen de cuentas monetarias. Revisión sectorial documentada, sin inventar verificación en terreno. |

Los controles de entrada son decisiones de implementación inspiradas por el
capítulo. No son un formulario oficial ni una certificación de CEPAL.

## Estado de la evidencia

`data/evaluacion_cepal.json` no contiene cuentas acreditadas. Por eso Daños,
Pérdidas y Costos adicionales aparecen **No evaluada**, nunca cero.
Los COP publicados por PNUD/RAPIDA siguen consultables con su valor y etiqueta
original, pero `Pérdidas económicas` deja de ser la dimensión de esos totales:
el export conserva `dimension_original` y usa `Estimaciones monetarias`.
No se suman componentes con totales ni las dos fuentes entre sí.

Las tasas educativas sobre SIMAT 2022 son cocientes sobre un registro histórico,
no porcentajes verificados del universo afectado. Si el numerador supera el
registro, se muestra esa inconsistencia al lado de la cifra; el tope del índice
es solo su normalización. Salud relativa usa heridos acumulados/camas registradas
en 2022: se identifica como capacidad histórica, no ocupación, demanda simultánea,
daño de infraestructura ni pérdida de servicio.

La pertenencia al decreto sigue siendo un filtro administrativo. Ni los
departamentos del decreto ni la existencia de un registro acreditan causalidad
municipal o cobertura exhaustiva. La cobertura de campos del índice tampoco
es cobertura de sedes, personas o matrícula.

## Contrato del registro económico

`cepal.py` valida y calcula; `scripts/validar_cepal.py` permite revisar antes
de regenerar. No se ingieren registros sintéticos de pruebas en producción.

Campos comunes por registro:

- `id`, `code` (DIVIPOLA de cinco dígitos), `sector`, `effect`
  (`damage`, `loss`, `additional_cost`), `agent`, `currency` (`COP`) y `price_basis`.
- `source`, `locator`, `observed_at` (fecha efectiva), `baseline_source`,
  `baseline_locator`, `baseline_date` anterior al evento, `attribution=verified`,
  `attribution_evidence`, `reviewed_by` (equipo o institución, sin datos personales).
- `coverage_keys`: unidades contables homogéneas **independientes de la fuente**,
  compartidas por reportes del mismo activo/actividad. No usar ID de fila como
  sustituto. Todo agregado debe declarar sus unidades. Solapamientos entre
  totales/componentes o fuentes se excluyen completos hasta conciliarlos.
- `insured_share` e `imported_share`, opcionales entre 0 y 1. Ausencia es
  desconocimiento. No se deduce antigüedad o depreciación de estas proporciones.

Para daño: `quantity`, `physical_unit`, `baseline_quantity`, `unit_price`,
`price_date` anterior al evento, `valuation=equivalent_replacement`,
`preexisting_deficit_excluded=true`, `resilience_upgrade_excluded=true`.
La cantidad y su universo deben tener la misma unidad. Valor = cantidad × precio.
La valoración de una reparación parcial debe corresponder a la cantidad y precio
de reparación documentados, no al precio total del activo.

Para pérdidas: `period` (`AAAA-MM`), `baseline_flow`, `post_disaster_flow`,
`scenario_basis`, `flow_treatment` (`lost` o `deferred`). Valores monetarios del
mismo mes y base de precios. Pérdida = flujo sin desastre − flujo con desastre.
Una diferencia negativa se conserva y requiere interpretación sectorial.

Para costo adicional: `period`, `incremental_expenditure`,
`expenditure_status=incurred`, `payer_agent`, `excludes_asset_replacement=true`.
Se acredita que el monto es incremental con la línea base y evidencia común.
No se añade la inversión de reposición a esta cuenta.

Agentes: `household`, `private_company`, `public_company`, `central_government`,
`regional_government`, `local_government`. El agente afectado no se presume
financiador de la reconstrucción. Los sumatorios mantienen separados territorio,
sector, cuenta, agente, moneda, base de precios, periodo y producción diferida.
Siempre son parciales: registros aceptados no prueban universo completo.
Las cuentas descargadas respetan ámbito, departamento y fecha efectiva disponible
hasta la captura seleccionada; una captura histórica no recibe valoraciones futuras.

Las fuentes actuales no acreditan todavía inventarios preevento homogéneos,
precios de reposición verificables, flujos mensuales contrafactuales, gasto
incremental ejecutado, seguro, composición importada o calendario de reposición.
El software no puede producir esos datos mediante normalización. El capítulo
también exige colaboración y contraste con especialistas y trabajo de campo;
esto queda pendiente como obtención y validación de evidencia.

## Cinco bases nuevas

Las cinco están en `data/` de la rama educativa, no en `main`. No se copian sus
libros originales al nuevo historial público. Los códigos institucionales de
`pereira_fuente_unica_v2_dane.xlsx` son de institución, no identificadores únicos
de sede. Su matrícula institucional repetida no debe sumarse por fila.

Lectura directa del MEN original: 5.537 sedes únicas, 1.962 instituciones,
434 municipios y 16 departamentos; cero duplicados de código de sede y cero
matrículas totales vacías. En Caldas, Chocó, Quindío, Risaralda y Valle: 121/126
municipios con reporte, 3.113 sedes y 570.091 matrículas; 744 sedes críticas y
149.471 matrículas en ellas. **121/126 es cobertura territorial del reporte**,
no cobertura de personas ni proporción de afectación. El archivo solo reporta
sedes oficiales y no acredita un censo del universo afectado ni fecha propia de
cada matrícula/inspección.

La hoja MEN declara servicio en 5.458 sedes, ausencia de servicio en 28 y
evaluación en 51. Pereira tiene 95 sedes críticas y sus 167 sedes reportan servicio.
Por tanto, matrícula crítica no es matrícula sin clases ni pérdida monetaria.
Estos resultados no suman MEN, ExE, ICBF, PLAN o los archivos municipales entre sí.

## Verificación

```sh
python -m unittest discover -s tests -v
node --test tests/*.test.js
python scripts/validar_cepal.py
python generar_tablero_recuperacion.py
node tests/cepal.browser.cjs
```

Se verifica conservación del índice contra `main`, distinción nulo/cero,
valoración física, línea base/periodos, conflictos entre fuentes y ausencia de
totales macroeconómicos. La prueba en navegador revisa filtros, exportaciones,
fechas, fichas, tres versiones del índice y vista móvil.
