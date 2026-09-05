# Catálogo de indicadores

Todos los indicadores que produce `actualizar_indice_terremoto.py`, tal
como aparecen en `indicadores_largo.csv` (columna `indicador_id`) y en los
dos CSV del índice ajustado. Agrupados por fuente, con qué mide cada uno y
su unidad. Metodología de extracción de cada fuente en
`docs/metodologia_fuentes.md`; fórmulas de los dos índices, en el hilo de
esta conversación (índice original) y en `docs/indice_ajustado.md` (índice
ajustado).

## 1. Índice original -- `fuente=Naboo` / `fuente=Calculo`

Por cada una de las 5 dimensiones *d* ∈ {salud, vivienda, instituciones,
educación, productividad (proxy)}, 6 indicadores:

| `indicador_id` | Qué mide | Unidad | Fuente |
|---|---|---|---|
| `{d}_n` | Puntos registrados en `registro.json` para esa dimensión | Número | Naboo |
| `{d}_incidencia_tasa_100k` | Puntos por cada 100.000 habitantes | Tasa x100k hab. | Calculo |
| `{d}_incidencia_idx` | La tasa anterior, normalizada 0-100 entre los 25 deptos | Índice 0-100 | Calculo |
| `{d}_severidad_promedio` | Peso de severidad promedio de esos puntos (ver pesos abajo) | Peso promedio | Calculo |
| `{d}_severidad_idx` | La severidad promedio, normalizada 0-100 | Índice 0-100 | Calculo |
| `{d}_idx` | Promedio de incidencia_idx y severidad_idx -- el puntaje final de esa dimensión | Índice 0-100 | Calculo |

Más:
- **`indice_compuesto`** -- promedio simple de las 5 `{d}_idx`. Índice 0-100, `fuente=Calculo`.
- **`en_decreto_1171`** -- 1 si el departamento está en el Artículo 1 del Decreto 1171/2026, 0 si no. Sí/No (1-0), `fuente=Decreto1171`, departamental.
- **`empresarios_afectados`** -- empresarios en estado grave/crítico (Cámaras de Comercio, 5/25 departamentos). Número, `fuente=Camaras`, departamental.
- **`score_municipal`** -- gravedad oficial UNGRD de los municipios del depto, ponderada por población. Índice 0-100, `fuente=Calculo`, departamental.
- **`gravedad_oficial`** -- categoría UNGRD del municipio (crítica/muy alta/.../sin clasificación), mapeada a 0-100. Categoría (0-100), `fuente=Naboo/UNGRD`, municipal.

Pesos de severidad por punto: COLAPSO=4, GRAVE=3, MODERADO=2, LEVE=1, SIN_EVALUAR=1.

## 2. 3iS-Sheets -- `fuente=3iS-Sheets` (departamental y municipal)

| `indicador_id` | Qué mide | Unidad |
|---|---|---|
| `3is_fallecidos` | Fallecidos | Número |
| `3is_heridos` | Heridos | Número |
| `3is_desaparecidos` | Desaparecidos | Número |
| `3is_rescatados` | Rescatados | Número |
| `3is_familias` | Familias afectadas | Número |
| `3is_vivaveriadas` | Viviendas averiadas | Número |
| `3is_vivdestruidas` | Viviendas destruidas | Número |
| `3is_colapsos` | Colapsos | Número |
| `3is_salud` | Puntos de salud afectados | Número |
| `3is_educativos` | Puntos educativos afectados | Número |
| `3is_comunitarios` | Puntos comunitarios afectados | Número |
| `3is_vias` | Vías afectadas | Número |
| `3is_aeropuertos` | Aeropuertos afectados | Número |
| `3is_acueductos` | Acueductos afectados | Número |

## 3. Sedes educativas -- `fuente=FundacionExe` (municipal, agregado por municipio)

| `indicador_id` | Qué mide | Unidad |
|---|---|---|
| `sedes_edu_n_sedes` | Sedes educativas afectadas | Número |
| `sedes_edu_n_sedes_criticas` | Sedes educativas en estado crítico (severidad 3) | Número |
| `sedes_edu_matricula_afectada` | Matrícula afectada | Número |
| `sedes_edu_docentes_afectados` | Docentes afectados | Número |

## 4. PNUD -- `fuente=PNUD` (departamental y municipal)

| `indicador_id` | Qué mide | Unidad |
|---|---|---|
| `pnud_vd` | Viviendas destruidas | Número |
| `pnud_va` | Viviendas averiadas | Número |
| `pnud_csalud` | Centros de salud afectados | Número |
| `pnud_cedu` | Centros educativos afectados | Número |
| `pnud_ccom` | Centros comunitarios afectados | Número |
| `pnud_vivt_cop` | Costo estimado vivienda | COP |
| `pnud_salud_cop` | Costo estimado salud | COP |
| `pnud_edu_cop` | Costo estimado educación | COP |
| `pnud_com_cop` | Costo estimado comunitario | COP |
| `pnud_infra_cop` | Costo estimado infraestructura institucional | COP |
| `pnud_tot_cop` | Costo total estimado | COP |

## 5. UNDP geosmart (RAPIDA) -- `fuente=UNDP-RAPIDA`

Departamental (`COL_adm1`, 7 campos):

| `indicador_id` | Qué mide | Unidad |
|---|---|---|
| `undp_rapida_debris_households_m3` | Escombros de vivienda | m³ |
| `undp_rapida_debris_buildings_m3` | Escombros de edificaciones | m³ |
| `undp_rapida_debris_infra_m3` | Escombros de infraestructura | m³ |
| `undp_rapida_debris_total_m3` | Escombros totales | m³ |
| `undp_rapida_econ_dmg_households_cop` | Daño económico en vivienda | COP |
| `undp_rapida_econ_dmg_infra_cop` | Daño económico en infraestructura | COP |
| `undp_rapida_econ_dmg_total_cop` | Daño económico total | COP |

Municipal (`COL_RAPIDA_earthquake_adm2_20260810`, 24 campos -- los 3 de daño
económico son los mismos de la tabla de arriba, a nivel municipal):

| `indicador_id` | Qué mide | Unidad |
|---|---|---|
| `undp_rapida_pop_dead` | Personas fallecidas | Número |
| `undp_rapida_pop_missing` | Personas desaparecidas | Número |
| `undp_rapida_pop_inj` | Personas heridas | Número |
| `undp_rapida_pop_exp` | Población expuesta | Número |
| `undp_rapida_pop_exp_urb` | Población expuesta, urbana | Número |
| `undp_rapida_pop_exp_rur` | Población expuesta, rural | Número |
| `undp_rapida_pop_imp` | Población impactada | Número |
| `undp_rapida_bdg_exp` | Edificaciones expuestas | Número |
| `undp_rapida_bdg_comm_aff` | Edificaciones comunitarias afectadas | Número |
| `undp_rapida_bdg_health_aff` | Edificaciones de salud afectadas | Número |
| `undp_rapida_bdg_edu_aff` | Edificaciones educativas afectadas | Número |
| `undp_rapida_bdg_homes_dmg` | Viviendas averiadas | Número |
| `undp_rapida_bdg_homes_dest` | Viviendas destruidas | Número |
| `undp_rapida_bdg_public_imp` | Edificaciones públicas impactadas | Número |
| `undp_rapida_bdg_other_imp` | Otras edificaciones impactadas | Número |
| `undp_rapida_roads_exp_km` | Vías expuestas | km |
| `undp_rapida_roads_imp_km` | Vías impactadas | km |
| `undp_rapida_mpi` | Índice de pobreza multidimensional (previo al sismo) | Índice |
| `undp_rapida_liquefaction` | Susceptibilidad a licuación | Índice |
| `undp_rapida_landslides` | Susceptibilidad a deslizamientos | Índice |
| `undp_rapida_recovery_needs` | Necesidades de recuperación temprana | Índice |

### ⚠️ Advertencia: las categorías de edificaciones de UNDP-RAPIDA no están confirmadas como mutuamente excluyentes

`bdg_exp` (expuestas) y las categorías de afectación (`bdg_comm_aff`,
`bdg_health_aff`, `bdg_edu_aff`, `bdg_homes_dmg`, `bdg_homes_dest`,
`bdg_public_imp`, `bdg_other_imp`) declaran fuentes distintas en el propio
item de ArcGIS -- `bdg_exp` sale de un modelo de exposición sobre huellas de
Overture Maps, las categorías de afectación de evaluación de daño de
Copernicus EMS. No hay un identificador de edificio individual en los datos
(son conteos agregados por municipio), así que no hay forma de confirmar
si las categorías son mutuamente excluyentes o si un mismo edificio puede
quedar contado en más de una.

Dos chequeos hechos sobre los 301 municipios con datos:

1. **"Expuestas" no es un techo confiable.** En 32 de 301 municipios (11%),
   la suma de las 7 categorías de afectación **supera** a `bdg_exp` -- a
   veces por 100x (Cajibío, Cauca: suma = 1.588 vs. `bdg_exp` = 14; Jambaló,
   Cauca: suma = 494 vs. `bdg_exp` = 0). Si "afectado" fuera un subconjunto
   real de "expuesto", esto no podría pasar nunca. Indica que ambos grupos
   de campos no son el mismo inventario de edificios visto en dos cortes,
   sino (probablemente) dos modelos independientes que no siempre cuadran.
2. **`bdg_comm_aff + bdg_public_imp` (instituciones) vs. `bdg_edu_aff`
   (educación) nunca se invierte.** El primero es mayor o igual en el
   100% de los 301 municipios (235 con desigualdad estricta, ej. Armenia:
   941 vs. 48; ninguno al revés). Un orden estrictamente unidireccional en
   todos los casos es compatible con que las edificaciones educativas
   estén incluidas dentro del conteo de "comunitario" -- no lo prueba (podría
   ser solo que "instituciones" es una categoría más amplia sin
   superposición alguna), pero tampoco lo descarta.

**Conclusión:** el riesgo de doble conteo entre categorías de edificaciones
de UNDP-RAPIDA (por ejemplo, una escuela comunitaria contada tanto en
`bdg_comm_aff` como en `bdg_edu_aff`) queda **abierto, ni confirmado ni
descartado**. Cerrarlo requeriría documentación oficial de la taxonomía de
edificios que no está publicada, o acceso a los datos a nivel de edificio
individual (no disponible vía el Feature Service público). El índice
ajustado (sección 6) no usa `bdg_exp` en ningún cálculo, así que la
inconsistencia del punto 1 no se filtra al resultado -- pero si en el
futuro se usara `bdg_exp` como techo de normalización o validación cruzada,
esta advertencia aplicaría directamente.

## 6. Índice ajustado (Fase B) -- fuente variable según cascada

Por cada dimensión *d* ∈ {vivienda, salud, educación, instituciones,
económico, vulnerabilidad}, en `indice_ajustado_departamento.csv` e
`indice_ajustado_municipio.csv`:

| Columna | Qué mide |
|---|---|
| `{d}_ajust_raw` | Valor crudo (antes de normalizar) que trajo la fuente ganadora de la cascada para esa dimensión |
| `{d}_ajust_fuente` | Cuál fuente ganó la cascada (Naboo / 3iS-Sheets / PNUD / UNDP-RAPIDA / FundacionExe) |
| `{d}_ajust_idx` | El valor crudo, normalizado 0-100 |

Más **`compuesto_ajustado`** (promedio de los `{d}_ajust_idx` disponibles)
y **`n_dimensiones`** (cuántas de las 6 tienen dato).

**Qué dato exacto se usa para cada dimensión** -- jerarquía fija, se usa la
PRIMERA fuente de la lista que tenga dato para esa unidad, nunca se
combinan dos:

| Dimensión | Campo departamental (fuente, en orden) | Campo municipal (fuente, en orden) |
|---|---|---|
| **Vivienda** | `vd`+`va` (PNUD) → `VivDestruidas`+`VivAveriadas` (3iS) → `vivienda_n` (Naboo) | `bdg_homes_dest`+`bdg_homes_dmg` (UNDP-RAPIDA) → `vd`+`va` (PNUD) → `VivDestruidas`+`VivAveriadas` (3iS) |
| **Salud** | `csalud` (PNUD) → `Salud` (3iS) → `salud_n` (Naboo) | `bdg_health_aff` (UNDP-RAPIDA) → `csalud` (PNUD) → `Salud` (3iS) |
| **Educación** | `cedu` (PNUD) → `Educativos` (3iS) → `n_sedes` agregado por depto (FundacionExe, solo sedes "En Decreto 1171=SI") → `educacion_n` (Naboo) | `bdg_edu_aff` (UNDP-RAPIDA) → `cedu` (PNUD) → `Educativos` (3iS) → `n_sedes` (FundacionExe, mismo filtro) |
| **Instituciones** | `Comunitarios` (3iS) → `instituciones_n` (Naboo) | `bdg_comm_aff`+`bdg_public_imp` (UNDP-RAPIDA) → `Comunitarios` (3iS) |
| **Pérdidas económicas** | `econ_dmg_total_cop` (UNDP-RAPIDA) -- única fuente, nunca también PNUD (mismo dato, ver auditoría) | `econ_dmg_total_cop` (UNDP-RAPIDA) |
| **Vulnerabilidad previa (IPM)** | `mpi` municipal (UNDP-RAPIDA), ponderado por población dentro del depto | `mpi` (UNDP-RAPIDA) directo |

Por qué UNDP-RAPIDA no encabeza la columna departamental salvo en las 2
últimas filas: su servicio departamental (`COL_adm1`) solo trae escombros
y daño económico -- personas y edificaciones viven solo en su servicio
municipal, y sumarlas hacia arriba daría un total parcial disfrazado de
total departamental (detalle en `docs/indice_ajustado.md`).

---

## Fuentes (las 10 del inventario)

| Fuente (`fuente` en el CSV) | Qué es |
|---|---|
| **Naboo** | Puntos individuales de `registro.json` (mapadelterremoto.com) -- reportes de prensa/gente, sin validación declarada. |
| **Naboo/UNGRD** | Gravedad oficial UNGRD por municipio, del listado `data/municipios_afectados_terremoto_colombia_ago2026.csv`. |
| **Calculo** | Todo lo que el propio script calcula (tasas, normalizaciones 0-100, índice compuesto) -- no es una fuente externa. |
| **Camaras** | Empresarios afectados grave/crítico, Cámaras de Comercio (5/25 departamentos). |
| **3iS-Sheets** | Hoja `Datos_Territoriales` del Google Sheets público que alimenta el dashboard de 3iS -- un agregador, no genera dato propio. |
| **FundacionExe** | Sedes educativas afectadas, descargadas manualmente de fundacionexe.org.co (sitio bloqueado para scraping). |
| **Decreto1171** | Artículo 1 del Decreto 1171 de 2026 -- hecho legal, no medición. |
| **PNUD** | Microsite de PNUD Colombia, estimación propia de costo de reposición (CONSTRUDATA + ICOCED). |
| **UNDP-RAPIDA** | Evaluación RAPIDA conjunta UNGRD+PNUD, vía los Feature Services de ArcGIS detrás del StoryMap de UNDP geosmart. |
| *(el índice ajustado no es una fuente propia)* | Combina las anteriores por cascada -- cada celda declara cuál ganó, en `{d}_ajust_fuente`. |

Detalle de extracción (endpoint, formato, frecuencia) de cada una en
`docs/metodologia_fuentes.md`; investigación completa (bloqueos,
intentos, decisiones) en `docs/investigacion_*.md`.
