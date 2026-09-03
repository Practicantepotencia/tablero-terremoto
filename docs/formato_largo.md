# Formato largo de indicadores — diseño (Fase A)

**Estado:** en construcción, rama `formato-largo`. No reemplaza nada en
`main` todavía — se agrega como salida en paralelo (`indicadores_largo.csv`)
mientras se valida, antes de migrar las vistas del tablero a leer de aquí.

## Por qué

Hoy cada dimensión es un puñado de columnas fijas, escritas a mano en
`compute_indice()` (`salud_idx`, `vivienda_idx`...). Funciona con 5
dimensiones y una fuente. No escala a "múltiples fuentes, múltiples
indicadores derivados" (registro.json, Cámaras de Comercio, 3iS, IPM...)
sin reescribir el cálculo cada vez que se agrega uno.

El borrador que compartió Daniel (`borrador_1.xlsx`) ya tiene la forma
correcta: una fila por indicador × unidad geográfica, con metadatos
(dimensión, unidad, fuente) en vez de columnas fijas.

## Esquema

Un CSV largo, una fila = un indicador para una unidad geográfica en un
momento dado:

| Columna | Qué es | Ejemplo |
|---|---|---|
| `divipola` | Código DIVIPOLA (2 dígitos departamento, 5 dígitos municipio) — **llave geográfica canónica**, reemplaza el cruce por nombre que ya nos falló 3 veces esta sesión | `66`, `66682` |
| `nivel` | `departamental` \| `municipal` | `municipal` |
| `departamento` | Nombre (para lectura humana, no para cruzar) | `Risaralda` |
| `municipio` | Nombre, vacío si `nivel=departamental` | `Santa Rosa de Cabal` |
| `dimension` | Vivienda, Salud, Instituciones, Educación, Productividad, Línea base... | `Salud` |
| `indicador_id` | Slug estable, para cruzar entre corridas | `fallecidos` |
| `indicador` | Nombre legible | `Fallecidos` |
| `unidad` | Número, Tasa x100k, Índice 0-100... | `Número` |
| `fuente` | De dónde sale — incluye `Calculo` para derivados | `3is`, `Naboo`, `Camaras`, `DANE`, `Calculo` |
| `valor` | El dato | `3` |
| `fecha_corte` | Cuándo aplica el valor (no la fecha de la corrida) | `2026-08-19` |

Una sola tabla, denormalizada (dimensión/unidad/fuente se repiten por fila)
a propósito: se lee y escribe con `csv` de la librería estándar, sin
depender de pandas ni de una base de datos — mismo principio que el resto
del proyecto.

## DIVIPOLA departamental

Tabla de códigos oficiales DANE, 25 departamentos. **Advertencia:** la
armé de memoria (conocimiento general de entrenamiento) -- antes de
depender de ella para cruces reales, hay que verificarla contra la fuente
oficial de DIVIPOLA del DANE (no tengo acceso a internet en este sandbox
para confirmarla en vivo).

| Departamento | DIVIPOLA |
|---|---|
| Antioquia | 05 |
| Atlántico | 08 |
| Bogotá D.C. | 11 |
| Bolívar | 13 |
| Boyacá | 15 |
| Caldas | 17 |
| Caquetá | 18 |
| Cauca | 19 |
| Cesar | 20 |
| Córdoba | 23 |
| Cundinamarca | 25 |
| Chocó | 27 |
| Huila | 41 |
| La Guajira | 44 |
| Magdalena | 47 |
| Meta | 50 |
| Nariño | 52 |
| Norte de Santander | 54 |
| Quindío | 63 |
| Risaralda | 66 |
| Santander | 68 |
| Sucre | 70 |
| Tolima | 73 |
| Valle del Cauca | 76 |
| Putumayo | 86 |

Municipal (5 dígitos = departamento + 3 dígitos de municipio) queda
pendiente — necesitamos cruzarlo contra el listado de 432 municipios que
ya tenemos en `data/`, o contra una tabla DIVIPOLA municipal completa del
DANE.

## Qué entra ya (migración de lo que existe)

De `compute_indice()` actual, por departamento:

| indicador_id | dimension | fuente | valor |
|---|---|---|---|
| `salud_n`, `vivienda_n`, `instituciones_n`, `educacion_n`, `econ_proxy_n` | cada una | Naboo | conteo bruto |
| `{dim}_incidencia_idx`, `{dim}_severidad_idx`, `{dim}_idx` | cada una | Calculo | 0-100 |
| `indice_compuesto` | (compuesto) | Calculo | 0-100 |
| `score_municipal` (de la vista municipal) | (compuesto) | Calculo | 0-100 |
| `empresarios_afectados` (solo en rama `economica`) | Productividad | Camaras | conteo |

Pendiente de agregar cuando existan: indicadores de 3iS (rama `3is`,
todavía sin acceso a los datos crudos) e IPM (Fase B, línea base).

## Próximo paso técnico

Función `export_formato_largo(rows, municipios, meta, empresarios_por_dep)`
en `actualizar_indice_terremoto.py` que recorre las estructuras que el
script ya calcula y escribe `indicadores_largo.csv` -- sin tocar
`compute_indice()`, `build_html()` ni el CSV ancho existentes. Salida en
paralelo, no reemplazo, mientras se valida.
