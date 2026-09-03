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

### Rama `economica`

- **`camaras_comercio_empresarios_afectados_ago2026.xlsx`** — original tal
  cual (fuente: Cámaras de Comercio, "Trabajo colaborativo para la atención
  de la emergencia"). Empresarios afectados en estado grave/crítico, por
  municipio, con apoyo recibido/aliados/recursos propios en texto libre.
  **Cobertura parcial: solo 5 de 25 departamentos** (Risaralda, Valle del
  Cauca, Caldas, Quindío, Chocó) — los que ya reportaron.
- **`camaras_comercio_empresarios_afectados_ago2026.csv`** — normalizado
  (departamento, municipio, camara_comercio, empresarios_afectados,
  apoyo_recibido, aliados, recursos_propios), nombres de departamento
  mapeados a la forma canónica con acentos (`QUINDIO` → `Quindío`, etc.).
  Si existe, `actualizar_indice_terremoto.py` lo usa para reemplazar el
  proxy de puntos (`SERVICIO`+`PUNTO_AYUDA`+`RESTRICCION`) de la dimensión
  de productividad — ver `compute_indice()`. Si no existe, esa dimensión
  sigue calculándose como antes (degradación elegante).
