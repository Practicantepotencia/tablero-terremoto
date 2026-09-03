# Formato largo de indicadores — diseño (Fase A)

**Estado:** cutover real implementado y verificado en cada corrida, rama
`formato-largo`. No fusionado a `main` todavía.

`compute_indice()` sigue siendo quien calcula todo (la lógica no cambió),
pero desde este punto **el CSV ancho y el HTML ya no leen directamente su
resultado** -- leen la reconstrucción hecha a partir de
`indicadores_largo.csv`, que se relee justo después de escribirlo. Si la
reconstrucción no coincide exacto con el cálculo original (`verificar_pivote()`),
la corrida se cae de vuelta al cálculo original y lo deja bien loggeado
-- nunca se publica un tablero con datos corrompidos silenciosamente.
Probado a propósito con un caso de corrupción simulada (un departamento
incompleto): se detecta y bloquea el cutover, como debe ser.

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

## Cómo funciona el cutover (implementado)

En cada corrida, en este orden:

1. `compute_indice()` calcula `rows` igual que siempre (ninguna lógica de
   negocio cambió).
2. `export_formato_largo(rows, ...)` escribe `indicadores_largo.csv`.
3. `load_indicadores_largo()` lo relee, y `pivotar_a_rows()` reconstruye
   la forma ancha (mismas claves que `compute_indice()` produce) a partir
   de las filas largas.
4. `verificar_pivote(rows, rows_reconstruidas)` compara ambas, campo por
   campo, con tolerancia de punto flotante (`1e-6`). Si algún
   departamento falta o algún valor no coincide, `ok=False` y se
   registra el detalle.
5. Si `ok=True`: `rows = rows_reconstruidas` -- el CSV ancho
   (`write_indice_csv`) y el HTML (`build_html`) usan la reconstrucción,
   no el cálculo directo. Si `ok=False`: se sigue con el `rows` original,
   sin interrumpir la corrida, dejando el motivo en el log
   (`stderr`).

Esto prueba, corrida tras corrida con datos reales, que el formato largo
es una representación completa y fiel -- no solo un espejo de exportación
que podría desincronizarse en silencio.

## Qué falta para terminar la Fase A

- **Migrar `build_html()` a leer directamente del formato largo**, en vez
  de depender de que `compute_indice()` primero produzca la forma ancha
  para reconstruirla después. Hoy el pivote es una prueba de fidelidad,
  no todavía el camino de lectura real de las vistas.
- **DIVIPOLA municipal** (5 dígitos), pendiente.
- **Población como indicador propio** en la tabla larga (hoy sigue
  entrando por fuera, vía `dep_pop`), para que hasta ese dato tenga
  fuente y fecha de corte trazables como cualquier otro indicador.
