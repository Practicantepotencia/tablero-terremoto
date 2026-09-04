# data/

Bases de datos externas (snapshot manual) que se combinan con el registro en
vivo de `mapadelterremoto.com` para calcular el índice de impacto.

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
- **`sedes_educativas_afectadas_choco_ago2026.csv`** — detalle por sede
  educativa (código DANE, severidad 1/2/3, matrícula, docentes,
  organizaciones aliadas) que Daniel encontró y descargó de
  `fundacionexe.org.co/unmillonderazones` -- ese sitio bloquea cualquier
  intento de scraping automático con un reto de Cloudflare (ver
  `docs/investigacion_fundacion_exito.md`), así que este **es** un
  snapshot manual, sin forma de automatizar su actualización. Separado
  por `;` con BOM (export de Excel en español), a diferencia del resto
  de `data/` que usa `,` -- `load_sedes_educativas_afectadas()` lo lee
  con `delimiter=";"` y lo agrega por municipio (`fuente=FundacionExito`)
  para `indicadores_largo.csv`; el detalle por sede solo vive en este CSV.
  303 sedes, 300 en Chocó (30 municipios), 63.863 estudiantes matriculados.

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
