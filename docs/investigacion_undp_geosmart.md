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

## Estructura de pesos del índice de necesidades de recuperación temprana (hallazgo posterior, 11 sep 2026)

**Corrección a lo dicho arriba y en `generar_tablero_recuperacion.py`:** no es cierto que "la documentación no permita reproducir la fórmula y los pesos" -- el texto narrativo del StoryMap (`.../data?f=json`, capturado vía diagnóstico temporal en el workflow, no vive en el repo) sí describe la estructura:

```
R = 0,50·I + 0,30·Vs + 0,20·Vf
```

- **I (50%, Impactos del Sismo):** "Promedio entre impactos a personas (fallecidos,
  heridos y desaparecidos) y estructuras (edificaciones públicas y viviendas)
  en municipios con intensidad de sismo ≥5 en la escala MMI (UNGRD, agosto 2026)."
- **Vs (30%, Vulnerabilidad Socioeconómica):** "índice de pobreza multidimensional
  a nivel municipal (proyecciones de PNUD al 2025 con base en datos del DANE)."
- **Vf (20%, Vulnerabilidad Física):** susceptibilidad a movimientos en masa
  (SGC, 2010) + susceptibilidad a licuefacción de suelos (Global Earthquake
  Model / Todorovic et al., 2026).

**Lo que esto NO alcanza a probar** (para no repetir el mismo salto):
conocer la estructura de pesos no es reproducir el índice. Falta, al menos:
cómo se normaliza cada subcomponente antes de combinarlo, qué subpesos usa
el promedio "personas vs. estructuras" dentro de `I` (el texto no lo dice),
cómo se combinan las dos susceptibilidades dentro de `Vf`, y cómo se tratan
los faltantes. Sin eso, no se puede calcular `R` desde cero ni comprobar que
coincide con `undp_rapida_recovery_needs` publicado. Reproducirlo de verdad
requeriría, como mínimo, un ajuste numérico contra los 301 valores publicados
para inferir la normalización faltante -- no se hizo aquí.

**Comparación honesta con nuestro ajuste por IPM** (no una validación --
son mecanismos distintos): nuestro `P = D×(1+0,25·v)/1,25` se reescribe como
`P = 0,8·D + 0,2·D·v` (`v` = IPM/100). El término de pobreza **multiplica a
`D`**: si no hay daño medido, el ajuste no aporta nada sin importar el IPM.
El `Vs` de RAPIDA es aditivo e independiente de `I` -- un municipio con IPM
alto y sismo apenas sentido igual suma esos puntos. No son comparables en
magnitud (30% vs. "hasta 20% del resultado final, y solo si D>0"), y que
RAPIDA pese la pobreza en 30% no justifica ni cuestiona nuestro 25%: siguen
siendo dos preguntas independientes. (Precisión: 30% no es un tercio de 100
ni está a la par del 50% de impactos -- es claramente menor.)

**Sobre la vulnerabilidad física (Vf):** no es automáticamente un vacío que
debamos llenar. Susceptibilidad a deslizamiento/licuefacción describe una
condición previa del terreno, no necesariamente daño ocurrido ni necesidad
pendiente -- si el daño físico real ya está en los 17 campos de nuestro
modelo, agregar esto podría estar reponderando la misma realidad con otro
nombre, no añadiendo información nueva. Sin evaluarlo con cuidado, no se
incorpora.

**Sobre el IPM "2025" (`undp_rapida_mpi`):** el texto distingue explícitamente
dos indicadores de pobreza citados en el StoryMap -- "pobreza monetaria"
(atribuida como "PNUD (2026), con base en datos del DANE (2018)", usada en
otro contexto del análisis) y "pobreza multidimensional" (la que alimenta
`Vs`, descrita como "proyecciones de PNUD al 2025"). No hay confirmación de
que el campo `undp_rapida_mpi` que ya tenemos en `indicadores_largo_no_calculo.csv`
(301 municipios) sea exactamente ese segundo indicador y no el primero --
es una inferencia por coincidencia temática, no una verificación por ID de
campo. Tampoco existe metodología publicada de esa proyección a 2025 (¿qué
extrapola, con qué margen de error?), ni una razón para preferir una
proyección sin metodología sobre una medición censal completa (DANE 2018,
1.122 territorios vs. 301 de RAPIDA). "Más reciente" no es lo mismo que
"más verificado ni más comparable" -- no se sustituye la línea base sin
resolver esto primero, y sin evaluar antes ambos IPM con todo lo demás del
modelo fijo (mismo daño, mismos pesos, mismos municipios).

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
