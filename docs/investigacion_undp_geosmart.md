# Investigación: StoryMap de UNDP geosmart -- "Evaluación Rápida del Terremoto de Magnitud 7.4 en Colombia"

**Estado:** integrada. Igual que PNUD y a diferencia de 3is.org y
fundacionexe.org.co, no hubo ningún bloqueo -- el reto fue de navegación
(el StoryMap es un contenedor, no la fuente), no de acceso.

## Qué es

Un **ArcGIS StoryMap** publicado en el portal propio de UNDP
(`geosmart.undp.org/arcgis`, ArcGIS Enterprise autoalojado, no ArcGIS
Online público), item `9d0ef01099a64edda2caecbd34135d7e`, dueño
`assessments@undp.org`, acceso público. Título: **"Evaluación Rápida del
Terremoto de Magnitud 7.4 en Colombia"** -- elaborada conjuntamente por la
**Unidad Nacional para la Gestión del Riesgo de Desastres (UNGRD)** y el
**Programa de las Naciones Unidas para el Desarrollo (PNUD)**, con datos
"con corte del 27 [de] agosto de 2026".

Es una evaluación RAPIDA (Rapid Assessment) que integra **modelos de
exposición** (qué hay en zonas de peligro) con **datos de afectación**
(daño real reportado), enfocada en zonas con intensidad sísmica MMI ≥ 5.
Fuentes que declara usar (`accessInformation` del item): UNGRD (impactos a
personas/edificios/vías), Servicio Geológico Colombiano (intensidad,
susceptibilidad a deslizamientos), proyección DANE/UNDP a 2026 (población,
pobreza monetaria), OpenStreetMap/INVIAS (red vial), Overture Maps
Foundation (huella de edificaciones), Copernicus EMS (evaluación de daño
en edificaciones), IGAC (límites administrativos), FMI (datos
macroeconómicos), fórmula de Pomonis & So (2011) calibrada con bases de
datos globales de pérdidas económicas por sismo.

## Cómo se accedió

El StoryMap en sí (el texto narrativo que se ve al navegarlo) es solo
contenido; los números reales viven en capas de datos separadas. Cadena de
resolución (3 corridas de diagnóstico en el workflow, mismo truco de
siempre):

1. `WebFetch` desde el sandbox -- bloqueado (esperado).
2. Diagnóstico en GitHub Actions contra la API REST pública de ArcGIS
   Portal (`{portal}/sharing/rest/content/items/{itemId}?f=json` y
   `.../data?f=json`) -- **sin bloqueo, sin token**, `status=200` a la
   primera. El JSON del StoryMap (`.../data?f=json`, 96 KB) reveló que
   enlaza **2 webmaps** y **13 dashboards** (cada uno un item separado,
   referenciado por `itemId`).
3. Los 2 webmaps trajeron URLs de `FeatureServer` directas en su propio
   JSON. Los 13 dashboards, en cambio, no traen URLs directas -- cada uno
   referencia *otro* item (`itemId`) que a su vez es un webmap o un
   Feature Service. Hubo que resolver ese nivel adicional
   (`items/{itemId}?f=json` -> campo `url`) para cada uno.
4. Al resolver los 15 items (2 webmaps del story + 13 de los dashboards),
   **todos convergen en solo 2 Feature Services reales** (más un par de
   servicios secundarios de suministro eléctrico, ver "Qué falta"):
   - `COL_adm1` (departamental)
   - `COL_RAPIDA_earthquake_adm2_20260810` (municipal)

   Es decir: 13 dashboards + 2 webmaps, pero el dato real vive en 2 tablas.
5. Se consultó cada servicio (`/query?where=1=1&outFields=*&f=json`,
   `returnGeometry=false` para no traer los polígonos) para ver campos y
   una fila real antes de escribir el loader de producción.

Ambos servicios son **públicos, sin token, sin bloqueo alguno** -- ni
siquiera el bloqueo genérico del sandbox de esta sesión aplica de forma
distinta a como aplica a cualquier dominio externo (falla en el sandbox
por política de red del entorno, funciona sin problema desde GitHub
Actions).

## Qué se integró

`load_undp_geosmart_rapida()` en `actualizar_indice_terremoto.py`
descarga ambos servicios frescos en cada corrida (paginado vía
`_arcgis_query_all()`, un helper genérico de consulta ArcGIS REST con
`resultOffset`/`resultRecordCount`, por si el número de municipios supera
el límite de página del servicio).

**`COL_adm1`** (departamento, llave `denombre` normalizado contra
`DIVIPOLA_DEPARTAMENTO`) -- 7 campos:
escombros de vivienda/edificaciones/infraestructura/total (m³) y daño
económico de vivienda/infraestructura/total (COP).

**`COL_RAPIDA_earthquake_adm2_20260810`** (municipio, llave `depto` +
`mpnombre`) -- 24 campos, la fuente más rica de toda la sesión:
- Personas: fallecidas, desaparecidas, heridas, expuestas (total/urbana/
  rural), impactadas.
- Infraestructura: edificaciones expuestas, comunitarias/salud/educativas
  afectadas, viviendas averiadas/destruidas, públicas/otras impactadas,
  vías expuestas/impactadas (km).
- Vulnerabilidad: IPM (índice de pobreza multidimensional).
- Amenaza: susceptibilidad a licuación y a deslizamientos.
- Recuperación: índice de necesidades de recuperación temprana.
- Económico: daño en vivienda/infraestructura/total (COP) -- mismos 3
  campos que a nivel departamental.

Se descartan filas sin departamento reconocible (ej. "Área en Litigio
Cauca - Huila", un polígono administrativo de IGAC sin dato de terremoto,
`decodigo="00"`) y **campos nulos se omiten, no se escriben como 0** --
`null` en el servicio significa "no evaluado para esta unidad", distinto
de un 0 real. Solo inventario crudo (`fuente=UNDP-RAPIDA`), no se usa
todavía para recalcular el índice.

## Hallazgo de validación cruzada

Chocó en `econ_dmg_total_cop` (esta fuente) = **$5.413.642.413.514** --
prácticamente idéntico al número de PNUD para Chocó documentado en
`docs/investigacion_pnud.md` (**$5,41 billones**). Ambas cifras salen de
metodologías descritas como propias y distintas (esta usa la fórmula de
Pomonis & So 2011 calibrada globalmente; PNUD usa CONSTRUDATA + ICOCED +
factores propios) pero coinciden casi al peso -- sugiere que **comparten
linaje** (probablemente el equipo de PNUD calibra o reutiliza esta misma
evaluación RAPIDA conjunta con UNGRD) más que ser dos mediciones
independientes que casualmente coinciden. Vale la pena tenerlo en cuenta
si en el futuro se usa alguna de las dos para el índice: no tratarlas como
confirmación cruzada real.

## Qué falta

- **`mpcodigo`** (código DIVIPOLA municipal de 5 dígitos, limpio) viene
  directo en `COL_RAPIDA_earthquake_adm2_20260810` -- es la **segunda**
  fuente de la sesión con esto (la primera fue PNUD, ver su doc). No se
  usa todavía (el loader sigue la convención de `fila()`: llave por
  nombre departamento/municipio, `divipola` = código departamental de 2
  dígitos). Con dos fuentes independientes trayendo el código municipal
  limpio, es un candidato cada vez más fuerte para resolver el pendiente
  de "DIVIPOLA municipal" de `docs/formato_largo.md` si se decide
  extender el esquema de `fila()`/`indicadores_largo.csv` con una columna
  nueva -- **no se hizo aquí** por ser un cambio de esquema, fuera del
  alcance de "agregar materia prima".
- Los otros 13 dashboards enlazados por el StoryMap (`summary_stats`,
  `buildingImpact_publicBldg`, `buildingExposure`, `econDamage_adm1`,
  `roadsExposure`, `populationImpact`, `buildingImpact_households`,
  `debris_adm1`, `econDamage_adm2`, `earlyRecovery`, `roadsImpact`,
  `populationExposure`, `powerOutages`) **no aportan datos nuevos** más
  allá de los 2 servicios listados arriba -- cada uno solo visualiza un
  subconjunto de las mismas 2 tablas con un panel/mapa distinto, excepto
  `powerOutages`.
- **`powerOutages`** sí referencia 3 servicios adicionales
  (`COL_power_outage_AOI`, `Power_affected_by_admin`,
  `main__20260811_OUTAGE`) que no se integraron: los dos primeros parecen
  polígonos de área de interés / población afectada por corte eléctrico
  (`affected_pop` por unidad administrativa, con campos `shapename`/
  `shapeiso`/`shapegroup` -- nomenclatura tipo GADM/geoBoundaries, no
  DIVIPOLA, habría que confirmar el cruce), y el tercero
  (`main__20260811_OUTAGE`) trae población total por sexo en una grilla
  H3 para todo 2026 -- parece un dataset genérico de WorldPop, no
  específico del sismo. Quedan pendientes de una revisión aparte si hace
  falta el dato de cortes de energía.
- No se exploró si los Feature Services tienen historial de ediciones
  (`editingInfo.lastEditDate` sí aparece en la respuesta de `?f=json`,
  por si sirve para detectar cuándo se actualiza el snapshot).
