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
  compartió Daniel: el propio `indicadores_largo.csv` filtrado a
  `fuente != Calculo` (solo lo que viene de fuentes externas, nada que
  hayamos calculado nosotros), sin las columnas `divipola`/`fecha_corte`.
  No es una fuente nueva -- es una vista de referencia de nuestro propio
  output, útil para revisar el inventario crudo sin que se mezcle con lo
  derivado.
