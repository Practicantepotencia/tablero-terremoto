# Índice ajustado (Fase B)

**Estado:** integrado, en beta -- convive con el índice original, no lo
reemplaza. Pestaña "Índice ajustado (beta)" en el tablero.

## Por qué existe

El índice compuesto original (`compute_indice()`, pestaña "Vista
departamental") se calcula **exclusivamente con Naboo** (`registro.json`)
desde el inicio del proyecto -- puntos individuales reportados, sin
proceso de validación declarado (ver `docs/metodologia_fuentes.md` y la
auditoría de fuentes publicada). Desde entonces se agregaron 6 fuentes
institucionales más al inventario crudo (Cámaras de Comercio, 3iS-Sheets,
FundacionExe, Decreto 1171, PNUD, UNDP-RAPIDA), pero ninguna se usaba para
recalcular nada -- quedaban como "materia prima" en
`indicadores_largo.csv`.

`compute_indice_ajustado()` es un **segundo índice compuesto**, calculado
en paralelo, que sí las usa -- sin tocar ni leer el cálculo original, para
no arriesgar lo que ya está en producción ni romper la comparabilidad de
`historial_indice.csv`.

## Las reglas, explícitas

1. **Nunca mezcla dos fuentes en la misma celda.** Cada dimensión tiene
   una jerarquía fija de fuentes (más completa/oficial primero); se usa
   la PRIMERA de la lista que tenga dato para esa unidad geográfica, y
   ninguna otra. Esto es deliberado: la auditoría de fuentes encontró que
   PNUD y UNDP-RAPIDA reportan literalmente el mismo daño económico
   (diferencia relativa ~0,00000002%, error de redondeo) -- sumarlas
   habría duplicado la cifra.
2. **Un campo sin dato queda en `None`, nunca en 0.** Cero significa
   "medido y en cero"; ninguna fuente reportando significa "no lo
   sabemos" -- son cosas distintas y se tratan distinto en toda la
   cadena (cascada, normalización, promedio del compuesto).
3. **Cada dimensión se normaliza 0-100 solo entre las unidades que sí
   tienen dato para ESA dimensión**, no sobre el universo completo de
   departamentos/municipios. Si se normalizara contra todos, una
   dimensión con poca cobertura (ej. "Pérdidas económicas", solo 17
   departamentos) quedaría aplastada contra 0 por los departamentos sin
   medir, que no es lo mismo que "sin pérdidas".
4. **El compuesto de cada unidad es el promedio de sus dimensiones
   disponibles, no de todas.** Un departamento con 4 de 6 dimensiones
   con dato no se penaliza por las 2 que faltan -- pero sí se muestra
   cuántas de las 6 tiene (columna "Dimensiones" en el tablero), para que
   quede claro que no todos los compuestos se calcularon con la misma
   base.

## Jerarquía de fuentes por dimensión

| Dimensión | Departamental | Municipal |
|---|---|---|
| Vivienda | PNUD (`vd`+`va`) → 3iS (`VivDestruidas`+`VivAveriadas`) → Naboo (`vivienda_n`) | UNDP-RAPIDA (`bdg_homes_dest`+`bdg_homes_dmg`) → PNUD → 3iS |
| Salud | PNUD (`csalud`) → 3iS (`Salud`) → Naboo (`salud_n`) | UNDP-RAPIDA (`bdg_health_aff`) → PNUD → 3iS |
| Educación | PNUD (`cedu`) → 3iS (`Educativos`) → FundacionExe (`n_sedes`, agregado por depto) → Naboo (`educacion_n`) | UNDP-RAPIDA (`bdg_edu_aff`) → PNUD → 3iS → FundacionExe |
| Instituciones | 3iS (`Comunitarios`) → Naboo (`instituciones_n`) | UNDP-RAPIDA (`bdg_comm_aff`+`bdg_public_imp`) → 3iS (`Comunitarios`) |
| Pérdidas económicas *(nueva)* | UNDP-RAPIDA (`econ_dmg_total_cop`) -- única fuente, nunca PNUD también | UNDP-RAPIDA (`econ_dmg_total_cop`) |
| Vulnerabilidad previa / IPM *(nueva)* | UNDP-RAPIDA (`mpi`), ponderado por población municipal | UNDP-RAPIDA (`mpi`) directo |

**Por qué UNDP-RAPIDA no encabeza la cascada departamental salvo en las
2 dimensiones nuevas:** su servicio departamental (`COL_adm1`) solo trae
escombros y daño económico -- personas y edificaciones viven únicamente
en su servicio municipal (`COL_RAPIDA_earthquake_adm2`, ver
`docs/investigacion_undp_geosmart.md`). Sumar sus municipios hacia arriba
daría un total parcial (solo lo que evaluó, no todo el departamento)
disfrazado de total departamental -- se prefirió no hacerlo y usar PNUD/
3iS, que sí traen filas departamentales nativas.

## Dos dimensiones nuevas que el índice original no tiene

- **Pérdidas económicas**: el original no mide costo en absoluto (solo
  cuenta puntos reportados). Viene directo de UNDP-RAPIDA.
- **Vulnerabilidad previa (IPM)**: pobreza multidimensional *antes* del
  sismo -- una medida de qué tan preparado/vulnerable estaba cada
  territorio, no de lo que el sismo causó. Es conceptualmente distinta a
  las demás (que sí miden daño), pero se incluye en el promedio del
  compuesto igual que las otras -- si en el futuro se decide que debería
  pesar distinto (o no promediarse junto con las de daño), es un cambio
  de diseño pendiente, no algo que este primer corte resolvió.

## Cobertura real (no universal)

- **Departamental**: los 25 departamentos siempre tienen algo (Naboo
  cubre los 25 como último respaldo en 4 de las 6 dimensiones), pero muy
  pocos tienen las 6 completas -- solo los que UNDP-RAPIDA evaluó.
- **Municipal**: solo entran los municipios con dato en al menos una
  dimensión -- nunca los ~1.122 del país. La cobertura real depende de
  qué fuente institucional llegó a esa zona; UNDP-RAPIDA en particular
  solo evaluó la zona con intensidad sísmica MMI≥5 (ver
  `docs/investigacion_undp_geosmart.md`), así que un municipio fuera de
  esa zona puede no aparecer aquí aunque sí aparezca en la pestaña
  "Vista municipal" (que usa la gravedad oficial UNGRD, una fuente
  distinta con su propia cobertura).

## Qué falta / decisiones pendientes

- **¿Reemplaza al índice original?** No, por ahora conviven (decisión
  explícita: ver el hilo de esta conversación). Si en algún momento se
  decide migrar, el patrón a seguir es el mismo "cutover con
  verificación" que ya usa `pivotar_a_rows()`/`verificar_pivote()` para
  el formato largo -- no un reemplazo silencioso.
- **Ponderar por rigor declarado.** Hoy cada dimensión pesa lo mismo en
  el promedio del compuesto (igual que el índice original) -- la
  auditoría de fuentes recomienda ponderar según qué tan documentada está
  la metodología de cada fuente (PNUD y UNDP-RAPIDA declaran su propia
  incertidumbre; Naboo no). No implementado todavía.
- **Severidad, no solo incidencia.** El índice original divide cada
  dimensión en incidencia (cuántos puntos) + severidad promedio (qué tan
  graves). Las fuentes institucionales no traen severidad por unidad
  (son conteos agregados, no puntos individuales con etiqueta), así que
  el índice ajustado usa solo incidencia -- una simplificación real
  frente al original, documentada aquí, no oculta.
- **Cruzar contra el DIVIPOLA municipal.** UNDP-RAPIDA y PNUD traen
  código municipal de 5 dígitos limpio (ver sus docs de investigación),
  todavía sin usar -- el cruce municipal de este índice sigue siendo por
  nombre (`(departamento, municipio)`), con los mismos riesgos de
  desajuste de tildes/tipografía que el resto del inventario.
