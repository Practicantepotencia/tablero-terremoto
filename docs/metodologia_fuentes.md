# Metodología de extracción de datos, por fuente

Referencia técnica de **cómo** se obtiene cada dato que usa el tablero:
endpoint/protocolo exacto, formato, frecuencia de actualización, nivel
geográfico y qué transformación aplica el loader antes de que el dato
llegue a `indicadores_largo.csv` o al cálculo del índice. Para el *qué es
cada columna* del formato largo, ver `docs/formato_largo.md`; para el
detalle narrativo de cada investigación (bloqueos, intentos fallidos,
decisiones), ver los `docs/investigacion_*.md` individuales enlazados en
cada sección.

Todas las funciones `load_*()` viven en `actualizar_indice_terremoto.py`
y se llaman desde `main()` en cada corrida del workflow
(`.github/workflows/actualizar.yml`, cada 4h). Ninguna interrumpe la
corrida si falla: una fuente caída simplemente no aporta datos esa vez
(`try/except` que devuelve vacío), nunca revienta el script.

## Resumen

| Fuente (`fuente` en el CSV) | Qué mide | Nivel | Acceso | Frecuencia |
|---|---|---|---|---|
| `Naboo` | Puntos individuales reportados (hospitales, viviendas, escuelas, servicios) | Punto -> departamental | JSON público, URL fija | En vivo, cada corrida |
| `Naboo/UNGRD` | Gravedad oficial por municipio | Municipal | CSV manual en `data/` | Snapshot manual |
| *(sin fuente propia)* | Población departamental | Departamental | CSV manual en `data/` (o tabla embebida de respaldo) | Snapshot manual |
| *(sin fuente propia)* | Cifras resumen UNGRD (fallecidos, heridos...) | Nacional | JSON manual en `data/` | Snapshot manual |
| `Camaras` | Empresarios afectados grave/crítico | Departamental (5 de 25) | CSV manual en `data/` | Snapshot manual |
| `3iS-Sheets` | Cifras oficiales consolidadas (fallecidos, viviendas, salud, educación, vías...) | Departamental y municipal | CSV público (Google Sheets `gviz`) | En vivo, cada corrida |
| `FundacionExe` | Sedes educativas afectadas (severidad, matrícula, docentes) | Municipal (agregado; detalle por sede en el CSV) | CSV manual en `data/` | Snapshot manual (sitio bloqueado) |
| `Decreto1171` | Departamento con acceso a la Subcuenta SISMO 2026 | Departamental | Constante en código, trazada a un PDF | Estático (solo cambia si sale otro decreto) |
| `PNUD` | Costo de reposición de vivienda e infraestructura institucional (COP) | Departamental y municipal | HTML público con JSON embebido | En vivo, cada corrida |
| `UNDP-RAPIDA` | Evaluación RAPIDA UNGRD+PNUD: personas, edificaciones, vías, escombros, IPM, amenaza, recuperación, daño económico | Departamental y municipal | ArcGIS REST API pública, sin token | En vivo, cada corrida |

---

## Núcleo del tablero

Estas cuatro fuentes alimentan directamente `compute_indice()` (el índice
0-100 de 5 dimensiones) y la pestaña "Vista municipal", no solo el
inventario crudo.

### 1. Registro de puntos -- `mapadelterremoto.com/datos/registro.json` (`fuente=Naboo`)

- **Qué es:** el registro base del proyecto (antes de esta sesión) --
  puntos individuales reportados (hospitales, viviendas, escuelas,
  servicios/ayuda/restricciones), cada uno con `departamento`, `tipo`,
  `severidad` y texto libre (`direccion`, `barrio`, `descripcion`,
  `notas`).
- **Cómo se extrae:** `load_registro()` hace `GET` directo con
  `urllib.request` (`User-Agent: Mozilla/5.0`) al endpoint público
  `https://www.mapadelterremoto.com/datos/registro.json` (configurable
  con `--url`, incluso a un archivo local para pruebas). JSON plano, sin
  paginación ni autenticación.
- **Transformación:** `compute_indice()` clasifica cada punto por `tipo`
  (`HOSPITAL`->salud, `VIVIENDA`->vivienda, `ESCUELA`->educación,
  `SERVICIO`/`PUNTO_AYUDA`/`RESTRICCION`->productividad-proxy) más
  `es_institucion()` (busca palabras clave como "alcaldía", "bomberos",
  "notaría"... en el texto libre) para la dimensión "instituciones". Cada
  punto pesa según `SEV_WEIGHT` (`COLAPSO`=4, `GRAVE`=3, `MODERADO`=2,
  `LEVE`/`SIN_EVALUAR`=1). El resultado (conteo + severidad promedio, cada
  uno normalizado 0-100) es la base del índice compuesto.
- **Frecuencia:** en vivo, se descarga fresco en cada corrida (cada 4h).

### 2. Población departamental (sin `fuente` propia -- insumo, no indicador)

- **Cómo se extrae:** `load_dep_population()` lee
  `data/municipios_afectados_terremoto_colombia_ago2026.csv` (columnas
  `departamento`, `poblacion`, sumadas por departamento) si el archivo
  existe; si no, cae a `POBLACION_CSV`, una tabla fija embebida en el
  script como último respaldo.
- **Origen del CSV:** snapshot manual de mapadelterremoto.com/municipios
  (agregado de 257 fuentes públicas, normalizado con DIVIPOLA), bajado y
  convertido una vez de Excel a CSV con `openpyxl` -- ver
  `data/README.md`.
- **Frecuencia:** snapshot manual -- se actualiza reemplazando el CSV.

### 3. Vista municipal -- `data/municipios_afectados_terremoto_colombia_ago2026.csv` (`fuente=Naboo/UNGRD`)

- **Qué es:** listado municipal (gravedad oficial UNGRD, puntos de daño,
  población, nota/fuente) para la pestaña "Vista municipal" del HTML.
- **Cómo se extrae:** `load_municipios()` lee el mismo CSV de arriba con
  `csv.DictReader`, fila por fila (`departamento`, `municipio`,
  `gravedad_oficial`, `puntos_dano`, `poblacion`, `nota`).
- **Transformación:** en `export_formato_largo()`, cada municipio aporta
  una fila `gravedad_oficial` mapeada 0-100 vía `SEV_OFICIAL_VALUE`
  (`"Afectación crítica"`->100 ... `"Sin clasificación oficial"`->0), y
  cada departamento un `score_municipal` ponderado por población.
- **Frecuencia:** snapshot manual, mismo archivo que la población.

### 4. Resumen UNGRD -- `data/resumen_ungrd_ago2026.json` (metadato, sin fuente propia)

- **Cómo se extrae:** `load_resumen_meta()` lee el JSON tal cual (sin
  transformar) si el archivo existe.
- **Origen:** transcrito a mano de la hoja "Resumen" del Excel de
  mapadelterremoto.com/municipios (fallecidos, desaparecidos, heridos,
  personas/familias afectadas).
- **Frecuencia:** snapshot manual -- hay que editarlo a mano si cambia la
  hoja "Resumen" fuente.

---

## Inventario crudo -- materia prima (fase "formato largo")

Las siguientes fuentes solo entran a `indicadores_largo.csv` (y su
derivado `indicadores_largo_no_calculo.csv`, filtrado a `fuente !=
Calculo`) -- **ninguna recalcula el índice compuesto todavía**, es
inventario crudo puro (ver `docs/formato_largo.md`).

### 5. Empresarios afectados -- Cámaras de Comercio (`fuente=Camaras`)

- **Cómo se extrae:** `load_empresarios_afectados()` lee
  `data/camaras_comercio_empresarios_afectados_ago2026.csv` (columnas
  `departamento`, `empresarios_afectados`), suma por departamento.
- **Origen:** traído de la rama `economica` de este mismo repo (no hubo
  investigación de acceso nueva en esta rama).
- **Cobertura:** parcial -- 5 de 25 departamentos.
- **Frecuencia:** snapshot manual.

### 6. 3iS-Sheets, hoja `Datos_Territoriales` (`fuente=3iS-Sheets`)

- **Qué es:** cifras oficiales consolidadas por corte de tiempo
  (fallecidos, heridos, desaparecidos, rescatados, familias, viviendas
  averiadas/destruidas, colapsos, puntos de salud/educativos/comunitarios
  afectados, vías, aeropuertos, acueductos) -- una hoja de las 4 que
  alimentan el dashboard de 3iS
  (`3is.org/emergenciaslatam/terremoto_choco/`), que en sí es un
  **agregador** de varias fuentes (Copernicus EMS, USGS, ArcGIS
  Dashboards, Power BI) y no genera dato propio -- ver
  `docs/investigacion_3is.md`.
- **Cómo se extrae:** `load_3is_datos_territoriales()` descarga en vivo
  la exportación pública del Google Sheets
  (`docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv&sheet=Datos_Territoriales`,
  sin API key ni autenticación) y la parsea con `csv.DictReader`
  (`utf-8-sig`, por el BOM).
- **Transformación:** la hoja trae una fila por corte de tiempo
  (`Reporte`, ej. "3 Sep 06:30") x nivel (`Departamento` o `Municipio`).
  El loader calcula el corte más reciente **por separado para cada
  nivel** (`_clave_orden_corte()`, parsea "día mes hora:min" en español)
  -- departamental y municipal no siempre comparten el mismo corte en la
  hoja fuente, así que asumir que sí descartaba silenciosamente filas
  municipales reales (bug encontrado y corregido esta sesión: antes solo
  se leía `Nivel=="Departamento"`, perdiendo ~2.484 filas municipales).
- **Frecuencia:** en vivo, cada corrida.

### 7. Sedes educativas afectadas -- Fundación Éxito (`fuente=FundacionExe`)

- **Qué es:** detalle por sede educativa (código DANE, severidad 1/2/3,
  matrícula, docentes, organizaciones aliadas) -- cobertura nacional (21
  departamentos, 451 municipios, 6.028 sedes en el snapshot de sep/2026).
- **Cómo se extrae:** `load_sedes_educativas_afectadas()` lee
  `data/sedes_educativas_afectadas_ago2026.csv`, separado por `;` con BOM
  (export de Excel en español, a diferencia del resto de `data/` que usa
  `,`), y agrega por `(departamento, municipio)`.
- **Por qué es snapshot manual:** el dominio `fundacionexe.org.co` bloquea
  cualquier scraping automático con un reto de Cloudflare (Managed
  Challenge/Turnstile) -- probado y confirmado inaccesible desde el
  sandbox, desde GitHub Actions con headers de navegador completo, y
  desde `r.jina.ai` (proxy externo que renderiza JS). El archivo lo bajó
  Daniel manualmente desde su navegador. Ver
  `docs/investigacion_fundacion_exito.md`.
- **Normalización:** `normalizar_nombre_departamento()` corrige nombres
  sin tilde del CSV fuente (ej. "Quindio") contra las claves de
  `DIVIPOLA_DEPARTAMENTO`, comparando por NFD sin marcas diacríticas.
- **Frecuencia:** snapshot manual -- reemplazar el CSV si Daniel encuentra
  una versión más nueva en el sitio.

### 8. Decreto 1171 de 2026 (`fuente=Decreto1171`)

- **Qué es:** 1 si el departamento está nombrado en el Artículo 1 del
  Decreto ("Situación de Desastre de Carácter Nacional", 11 ago 2026,
  acceso a la Subcuenta SISMO 2026 y al régimen especial de la Ley 1523
  de 2012), 0 si no.
- **Cómo se extrae:** no hay parseo de PDF -- `DEPARTAMENTOS_DECRETO_1171`
  es un `set` literal en el código, transcrito a mano del texto del
  Artículo 1 (12 departamentos). El PDF (`data/decreto_1171_11ago2026.pdf`)
  se conserva solo como trazabilidad/referencia, el script no lo lee.
- **Frecuencia:** estático -- solo cambiaría si sale un decreto nuevo que
  modifique la lista, y habría que editar el `set` a mano.

### 9. PNUD Colombia -- pérdidas económicas (`fuente=PNUD`)

- **Qué es:** estimación propia de PNUD del costo de reposición en COP de
  vivienda e infraestructura institucional (salud/educación/comunitario),
  por departamento y por municipio. Metodología documentada en la propia
  página: precios CONSTRUDATA (4 ciudades, 6 tipologías), factor de
  actualización ICOCED, factor territorial y multiplicador de tipología
  (todos con jerarquía de confianza declarada: NORMATIVO > OBSERVADO >
  CRITERIO DEL EQUIPO > ESTIMADO SIN FUENTE).
- **Cómo se extrae:** `load_pnud_perdidas_economicas()` descarga el HTML
  completo (`urllib.request`, ~2,4 MB) de
  `pnudco.github.io/Respuesta-a-crisis-y-recuperaci-n-temprana/`
  (microsite en GitHub Pages, repo público) y busca el bloque
  `<script type="application/json" id="results-data">` con un `find()` de
  string (sin parser HTML), luego `json.loads()` sobre ese fragmento.
- **Transformación:** el JSON trae dos objetos, `departamentos` (llave =
  nombre de departamento) y `municipios` (llave = nombre de municipio,
  con referencia a su departamento) -- de los ~30 campos disponibles se
  extraen 11: 5 conteos (`vd`, `va`, `csalud`, `cedu`, `ccom`) y 6 de
  costo en COP (`vivt_cop`, `salud_cop`, `edu_cop`, `com_cop`,
  `infra_cop`, `tot_cop`).
- **Sin bloqueo alguno** (a diferencia de Fundación Éxito) -- funcionó a
  la primera desde GitHub Actions. Como el repo es público, también se
  puede clonar directo (`git clone --depth 1`, vía `add_repo`) para
  inspección manual sin pasar por scraping. Ver
  `docs/investigacion_pnud.md`.
- **Frecuencia:** en vivo, cada corrida.

### 10. UNDP geosmart -- Evaluación RAPIDA (`fuente=UNDP-RAPIDA`)

- **Qué es:** la fuente más rica de la sesión -- evaluación conjunta
  UNGRD+PNUD ("Evaluación Rápida del Terremoto de Magnitud 7.4 en
  Colombia"), publicada como StoryMap de ArcGIS en el portal propio de
  UNDP (`geosmart.undp.org/arcgis`, ArcGIS Enterprise autoalojado). El
  StoryMap y sus 13 dashboards son solo visualización; el dato real vive
  en 2 Feature Services de ArcGIS REST.
- **Cómo se extrae:** `load_undp_geosmart_rapida()` consulta directo (sin
  pasar por el StoryMap ni por ningún dashboard) los endpoints REST
  públicos:
  - `COL_adm1/FeatureServer/0` (departamental) -- 7 campos: escombros
    (m³) y daño económico (COP), por categoría (vivienda/infraestructura/
    total).
  - `COL_RAPIDA_earthquake_adm2_20260810/FeatureServer/0` (municipal) --
    24 campos: fallecidos/desaparecidos/heridos, población expuesta e
    impactada (urbana/rural), edificaciones afectadas por categoría, vías
    expuestas/impactadas (km), IPM, susceptibilidad a licuación y
    deslizamientos, necesidades de recuperación temprana, daño económico.

  Cada consulta usa `_arcgis_query_all()` -- helper genérico que pagina
  con `resultOffset`/`resultRecordCount` (`orderByFields=objectid`) hasta
  agotar el total, con `returnGeometry=false` (los polígonos fuente son
  pesados y no hacen falta para el inventario). Sin token, sin
  autenticación -- son Feature Services marcados como públicos en el
  portal.
- **Cómo se encontraron los 2 endpoints:** el StoryMap enlaza 2 webmaps y
  13 dashboards (cada uno un item de ArcGIS Portal, resuelto vía
  `sharing/rest/content/items/{itemId}?f=json` /
  `.../items/{itemId}/data?f=json`); resolver esa cadena de referencias
  (StoryMap -> webmap/dashboard -> a veces otro webmap -> Feature Service)
  reveló que los 15 items convergen en solo estos 2 servicios. Ver
  `docs/investigacion_undp_geosmart.md` para la cadena completa.
- **Filtros aplicados:** se descartan filas sin departamento reconocible
  contra `DIVIPOLA_DEPARTAMENTO` (ej. "Área en Litigio Cauca - Huila", un
  polígono administrativo de IGAC sin dato de terremoto) y **campos nulos
  se omiten en vez de escribirse como 0** (`null` = no evaluado para esa
  unidad, distinto de un 0 real medido).
- **Nota de validación cruzada:** el daño económico total de Chocó en
  esta fuente coincide casi exacto con el de PNUD (fuente 9) -- ambas
  declaran metodologías propias distintas, pero probablemente comparten
  linaje (mismo esfuerzo UNGRD/PNUD), no son mediciones independientes.
- **Frecuencia:** en vivo, cada corrida.

---

## Patrones comunes a todas las fuentes en vivo

- **Nunca interrumpen la corrida:** todo `try/except` alrededor de la
  descarga devuelve una estructura vacía (`{}`, `({}, {})`, etc.) si falla
  la red o el parseo -- el script sigue con el resto de fuentes y publica
  igual.
- **`User-Agent` explícito:** todas las peticiones HTTP mandan
  `User-Agent: Mozilla/5.0` (o un UA de navegador completo, en el caso de
  ArcGIS) -- varios de estos endpoints devuelven error o contenido
  distinto sin él.
- **Sin librerías externas:** todo el HTTP/JSON/CSV usa la librería
  estándar de Python (`urllib.request`, `json`, `csv`) -- el proyecto no
  instala dependencias, ver el docstring al inicio del script.
- **Diagnóstico vía GitHub Actions:** cuando el sandbox de una sesión de
  Claude tiene el dominio bloqueado por política de red, el patrón usado
  para investigar cada fuente nueva fue agregar un paso temporal al
  workflow (`actualizar.yml`) que corre el fetch real desde el runner de
  GitHub (que sí tiene salida a internet completa), leer su log, y
  revertir el paso una vez confirmado -- nunca queda un diagnóstico
  temporal sin revertir en el historial de `formato-largo`.
