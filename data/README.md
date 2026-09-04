# data/

Bases de datos externas (snapshot manual) que se combinan con el registro en
vivo de `mapadelterremoto.com` para calcular el índice de impacto.

> Para el detalle técnico de cómo se extrae cada fuente (endpoint, formato,
> frecuencia, transformaciones), ver `docs/metodologia_fuentes.md` -- este
> README se enfoca en qué archivos van en esta carpeta y cómo actualizarlos.

## Qué va aquí

Archivos que descargas tú mismo de fuentes externas (ej. ArcGIS Hub, datos
abiertos oficiales) y subes a mano con `git add data/... && git push`.

**No es lo mismo que `registro.json`:** ese se descarga fresco en cada corrida
del workflow (cada 4h) y nunca se guarda en el repo. Lo que pongas en esta
carpeta queda fijo — un snapshot del momento en que lo descargaste — hasta que
tú lo reemplaces manualmente por una versión más nueva.

El workflow automático (`.github/workflows/actualizar.yml`) solo hace commit
de `index.html` e `indice_impacto_departamento.csv` — nunca toca esta carpeta,
así que no hay riesgo de que un commit automático pise tus archivos aquí.

## Formato esperado

- CSV, GeoJSON o Excel — lo que descargues tal cual, sin necesidad de
  convertirlo antes de subirlo.
- Idealmente con una columna de **departamento** (o municipio, para hacer el
  cruce) — si solo trae lat/lon, se puede hacer el cruce geográfico contra los
  25 departamentos, pero es un paso extra.

## Cómo se conecta al índice

Cuando agregues un archivo aquí, `actualizar_indice_terremoto.py` se
actualiza para leerlo (una función `load_*()` por archivo/fuente) y
combinarlo con los puntos de `registro.json` antes de calcular el índice —
mismo patrón que ya usa la fuente actual, sin librerías nuevas.

Archivo → función loader → normalizado a la forma común (`departamento`,
`tipo`, `severidad`, texto) → entra al mismo cálculo de las 5 dimensiones, o
se agrega como una dimensión nueva si mide algo distinto (ver discusión en el
historial del proyecto).

## Archivos actuales

- **`municipios_afectados_terremoto_colombia_ago2026.xlsx`** — original tal
  cual se descargó (fuente: mapadelterremoto.com/municipios, corte 19-20 ago
  2026, agregado de 257 fuentes públicas normalizado con DIVIPOLA). Se
  conserva como referencia, el script no lo lee directamente.
- **`municipios_afectados_terremoto_colombia_ago2026.csv`** — versión
  normalizada del Excel de arriba (departamento, municipio, gravedad oficial,
  puntos de daño, población, nota/fuente), generada una vez con
  `openpyxl` y guardada como CSV plano para que el script la lea con la
  librería estándar (`csv`), sin agregar dependencias nuevas. Es la fuente de
  población por departamento por defecto (reemplaza a `POBLACION_CSV`
  embebida, que sigue como respaldo) y alimenta la pestaña "Vista municipal"
  del tablero.
- **`resumen_ungrd_ago2026.json`** — cifras oficiales UNGRD de la hoja
  "Resumen" del Excel (fallecidos, desaparecidos, heridos, personas/familias
  afectadas), para los tiles de la pestaña municipal.

Si reemplazas el Excel por una versión más nueva, regenera el CSV con el
mismo procedimiento (parsear "Listado completo", ojo con el orden
`millones|mil` en el regex — `mil` es prefijo de `millones`) y actualiza el
JSON de resumen a mano con la hoja "Resumen" nueva.

### Rama `formato-largo`

- **`camaras_comercio_empresarios_afectados_ago2026.{xlsx,csv}`** —
  traídos de la rama `economica` (empresarios afectados en estado
  grave/crítico, por Cámara de Comercio; cobertura parcial, 5 de 25
  departamentos). Aquí **solo entran al inventario crudo** de
  `indicadores_largo.csv` (`fuente=Camaras`) vía `load_empresarios_afectados()`
  -- a diferencia de la rama `economica`, donde sí se usan para
  recalcular la dimensión de productividad. En `formato-largo` la idea es
  juntar toda la materia prima posible antes de tocar el cálculo del
  índice de nuevo (ver `docs/formato_largo.md`).
- **`indicadores_largo_solo_fuentes_crudas_snapshot.csv`** — snapshot que
  compartió Daniel a mano: el propio `indicadores_largo.csv` filtrado a
  `fuente != Calculo` (solo lo que viene de fuentes externas, nada que
  hayamos calculado nosotros), sin las columnas `divipola`/`fecha_corte`.
  **Superado por `indicadores_largo_no_calculo.csv`** (ver abajo) -- se
  deja aquí solo como referencia histórica de ese momento puntual, ya no
  hace falta actualizarlo a mano.
- **`sedes_educativas_afectadas_ago2026.csv`** — detalle por sede
  educativa (código DANE, severidad 1/2/3, matrícula, docentes,
  organizaciones aliadas) que Daniel encontró y descargó de
  `fundacionexe.org.co/unmillonderazones` -- ese sitio bloquea cualquier
  intento de scraping automático con un reto de Cloudflare (ver
  `docs/investigacion_fundacion_exito.md`), así que este **es** un
  snapshot manual, sin forma de automatizar su actualización. Separado
  por `;` con BOM (export de Excel en español), a diferencia del resto
  de `data/` que usa `,` -- `load_sedes_educativas_afectadas()` lo lee
  con `delimiter=";"` y lo agrega por municipio (`fuente=FundacionExe`)
  para `indicadores_largo.csv`; el detalle por sede solo vive en este CSV.
  **Cobertura nacional, no solo Chocó**: 6.028 sedes en 451 municipios,
  21 departamentos (Valle del Cauca, Antioquia, Cauca, Caldas y Tolima
  son los que más sedes traen -- Chocó, pese a ser el epicentro, es solo
  el 6º con 300). El primer snapshot que subió Daniel venía filtrado
  solo a Chocó (303 sedes) -- este lo reemplazó por completo.
  Normaliza departamentos sin tilde (ej. "Quindio") con
  `normalizar_nombre_departamento()` contra `DIVIPOLA_DEPARTAMENTO`.
- **`decreto_1171_11ago2026.pdf`** — "Por el cual se declara una Situación
  de Desastre de Carácter Nacional", firmado por el Presidente el 11 de
  agosto de 2026. Su Artículo 1 nombra los 12 departamentos con acceso
  formal a la Subcuenta SISMO 2026 y al régimen especial de la Ley 1523
  de 2012 (`DEPARTAMENTOS_DECRETO_1171` en `actualizar_indice_
  terremoto.py`, copiado literal del texto del decreto). Se usa para
  generar la fila `en_decreto_1171` (`fuente=Decreto1171`) en
  `indicadores_largo.csv` -- 1 si el departamento está en la lista, 0 si
  no. Solo referencia/trazabilidad, el script no lee el PDF directamente.

## Salidas automáticas (no van en esta carpeta)

- **`indicadores_largo_no_calculo.csv`** (raíz del repo, junto a
  `indicadores_largo.csv`) — la misma vista de arriba (`fuente != Calculo`,
  mismas columnas), pero generada sola en cada corrida por
  `export_formato_largo()` a partir de las filas que ya arma, sin releer
  nada del disco. El workflow automático la commitea junto con los demás
  CSV de salida (ver `file_pattern` en `.github/workflows/actualizar.yml`)
  -- siempre queda al día con lo último que trajo `registro.json` y los
  archivos de `data/`, sin que nadie tenga que regenerarla a mano.

## Fuentes remotas que NO viven en `data/` (se bajan solas cada corrida)

- **3iS-Sheets (`Datos_Territoriales`)** — cifras oficiales por
  departamento **y por municipio** (fallecidos, heridos, viviendas
  averiadas/destruidas, colapsos, salud, educativos, vías, acueductos...)
  del dashboard 3iS (ver `docs/investigacion_3is.md`). Es un CSV público
  de Google Sheets (`gviz/tq?tqx=out:csv`), igual de "en vivo" que
  `registro.json` -- se descarga fresco en cada corrida vía
  `load_3is_datos_territoriales()`, que calcula el corte más reciente
  **por separado para cada nivel** (departamental y municipal no siempre
  comparten el mismo corte en la hoja fuente), y entra al inventario
  crudo (`fuente=3iS-Sheets`, `nivel=departamental` o `nivel=municipal`)
  sin tocar el índice. No hace falta subir nada a mano; si la descarga
  falla (red, formato cambiado), la corrida sigue sin ese dato en vez de
  fallar.
- **PNUD Colombia -- estimación de pérdidas económicas** (ver
  `docs/investigacion_pnud.md`). Microsite en GitHub Pages
  ("Impacto Económico del Sismo — Chocó") con una estimación propia de
  PNUD del costo en pesos de reponer vivienda e infraestructura
  institucional (salud/educación/comunitario) destruida o averiada, por
  departamento y por municipio (534 municipios, 17 departamentos en el
  snapshot de sep/2026) -- metodología completa documentada en la propia
  página (precios CONSTRUDATA, índice ICOCED, factor territorial,
  multiplicador de tipología). Los datos no vienen en un CSV/API aparte:
  viven embebidos como JSON dentro de un `<script id="results-data">`
  en el HTML de 2,4 MB, así que `load_pnud_perdidas_economicas()`
  descarga la página fresca en cada corrida y extrae ese bloque -- igual
  de "en vivo" que `registro.json`. Entra al inventario crudo
  (`fuente=PNUD`) sin tocar el índice: conteos (viviendas destruidas/
  averiadas, centros de salud/educativos/comunitarios afectados) y costo
  estimado en COP por categoría y total. Total nacional estimado en el
  snapshot: **$42,1 billones de pesos**.
- **UNDP geosmart -- Evaluación RAPIDA (StoryMap + dashboards ArcGIS)**
  (ver `docs/investigacion_undp_geosmart.md`). StoryMap de UNGRD + PNUD
  ("Evaluación Rápida del Terremoto de Magnitud 7.4 en Colombia") en el
  portal ArcGIS Enterprise propio de UNDP -- el texto del StoryMap y sus
  13 dashboards son solo visualización; el dato real vive en 2 Feature
  Services de ArcGIS REST, públicos y sin token, que
  `load_undp_geosmart_rapida()` consulta frescos en cada corrida
  (paginado). `COL_adm1` (departamental): escombros en m³ y daño
  económico en COP. `COL_RAPIDA_earthquake_adm2_20260810` (municipal, con
  código DIVIPOLA municipal de 5 dígitos limpio disponible pero no usado
  todavía): fallecidos/desaparecidos/heridos, población expuesta e
  impactada (urbana/rural), edificaciones afectadas por categoría, vías
  expuestas/impactadas (km), IPM, susceptibilidad a licuación y
  deslizamientos, necesidades de recuperación temprana, y daño económico
  -- 24 campos, la fuente más rica de toda la sesión. Entra al inventario
  crudo (`fuente=UNDP-RAPIDA`) sin tocar el índice. Su cifra de daño
  económico total en Chocó coincide casi exacto con la de PNUD -- ver nota
  de validación cruzada en el doc, probablemente comparten linaje, no son
  mediciones independientes.
