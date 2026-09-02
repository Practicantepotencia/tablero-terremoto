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

Cuando agregues el primer archivo aquí, `actualizar_indice_terremoto.py` se
actualiza para leerlo (una función `load_*()` por archivo/fuente) y
combinarlo con los puntos de `registro.json` antes de calcular el índice —
mismo patrón que ya usa la fuente actual, sin librerías nuevas.

Archivo → función loader → normalizado a la forma común (`departamento`,
`tipo`, `severidad`, texto) → entra al mismo cálculo de las 5 dimensiones, o
se agrega como una dimensión nueva si mide algo distinto (ver discusión en el
historial del proyecto).
