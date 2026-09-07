# Auditoría del inventario crudo y diseño del EDA territorial

> Documento histórico de la auditoría inicial. La propuesta de promediar
> percentiles de IPM y resultado descrita más abajo fue retirada. La metodología
> vigente en esta rama está en [metodologia_recuperacion.md](metodologia_recuperacion.md):
> orden por recuperación sola y fuentes sectoriales separadas. `fecha_corte`
> se presenta como captura del inventario, no como fecha efectiva de observación.

**Archivo auditado:** `indicadores_largo_no_calculo.csv` de la rama `formato-largo`  
**Corte disponible al iniciar la auditoría:** 4 de septiembre de 2026  
**Alcance:** estructura, cobertura, coherencia interna, duplicidad entre fuentes, comparabilidad geográfica y uso del IPM como línea base.

## Resumen ejecutivo

El archivo es técnicamente consistente en su estructura básica: 17.758 filas, 65 indicadores, 8 fuentes, 674 observaciones departamentales y 17.084 municipales. Todos los valores son numéricos, no hay negativos ni claves duplicadas por nivel, territorio, indicador y fuente. El principal riesgo no es de formato sino de interpretación: las fuentes cubren universos geográficos distintos y varias miden el mismo fenómeno con datos idénticos o casi idénticos.

El IPM sí está disponible a nivel municipal. La fuente `UNDP-RAPIDA` contiene 301 observaciones de `undp_rapida_mpi`, correspondientes a 292 nombres municipales distintos en 12 departamentos. El rango observado es 1,02–71,65 y la mediana es 12,15. Esta cobertura pertenece al área evaluada por la respuesta rápida, no a los aproximadamente 1.122 municipios del país. Por tanto, el IPM sirve como línea base previa al sismo para comparar vulnerabilidad y afectación dentro de ese universo, pero no como una base municipal nacional completa.

## Hallazgos prioritarios

### 1. No existe todavía una evolución temporal de indicadores crudos

El archivo auditado no conservaba `fecha_corte` ni `divipola`, aunque ambas columnas sí existían en `indicadores_largo.csv`. Además, el CSV se sobrescribía en cada actualización. Con un solo corte no es válido mostrar tendencias, tasas de cambio o flechas de evolución.

La solución implementada conserva las dos columnas en el archivo sin cálculos y acumula `historial_indicadores_no_calculo.csv`, deduplicado por fecha, nivel, territorio, indicador y fuente. La pestaña de evolución permanece explícitamente vacía hasta tener al menos dos fechas reales.

### 2. La cobertura no es homogénea

| Fuente | Filas | Indicadores | Departamentos | Municipios/pares geográficos |
|---|---:|---:|---:|---:|
| UNDP-RAPIDA | 7.332 | 31 | 17 | 301 filas por indicador en hasta 292 nombres municipales |
| PNUD | 6.061 | 11 | 17 | 534 filas por indicador en hasta 509 nombres municipales |
| 3iS-Sheets | 1.974 | 14 | 16 | 125 filas por indicador en hasta 124 nombres municipales |
| FundacionExe | 1.804 | 4 | 21 | 451 filas por indicador en hasta 439 nombres municipales |
| Naboo/UNGRD | 432 | 1 | 25 | 432 registros, 415 nombres municipales |
| Naboo | 125 | 5 | 25 | Sin detalle municipal en esta fuente |
| Decreto1171 | 25 | 1 | 25 | No aplica |
| Camaras | 5 | 1 | 5 | No aplica |

Un vacío significa “sin observación de esa fuente”, no cero. El EDA restringe cada ranking a los territorios que sí tienen valor para el indicador seleccionado y muestra el tamaño de ese universo.

### 3. PNUD y UNDP-RÁPIDA duplican datos en la cobertura común

En 258 municipios compartidos:

- `pnud_vd` y `undp_rapida_bdg_homes_dest` coinciden exactamente en 258/258 casos.
- `pnud_va` y `undp_rapida_bdg_homes_dmg` coinciden exactamente en 258/258 casos.
- `pnud_tot_cop` y `undp_rapida_econ_dmg_total_cop` coinciden en todos los casos salvo diferencias máximas de 1 COP atribuibles al redondeo.

Estas fuentes no deben sumarse ni entrar dos veces en un compuesto. Son dos canales de publicación del mismo bloque de datos para esos indicadores. El tablero las conserva para trazabilidad y contraste, pero no las interpreta como observaciones independientes.

### 4. Las categorías de edificios no forman un total confiable

Las categorías de edificaciones afectadas de UNDP-RÁPIDA no cuentan con identificadores de edificio que permitan probar exclusividad. En 32 de 301 municipios, la suma de categorías de afectación supera el conteo de edificaciones expuestas. El EDA evita sumar automáticamente vivienda, salud, educación, comunitario, público y otros como si fueran categorías mutuamente excluyentes.

### 5. Los nombres municipales requieren una llave compuesta

Hay 32 nombres de municipio que aparecen en más de un departamento, entre ellos Armenia, Granada, Riosucio, Bolívar y La Unión. Las comparaciones y perfiles usan `departamento + municipio`; cuando existe DIVIPOLA, se conserva como llave canónica.

## Coherencia aritmética

- No se encontraron valores no numéricos ni negativos.
- No se encontraron claves duplicadas dentro del mismo corte.
- Los componentes de costo PNUD cuadran: infraestructura = salud + educación + comunitario y total = vivienda + infraestructura, con diferencias máximas de 1 COP por redondeo.
- El daño económico total UNDP-RÁPIDA cuadra con vivienda + infraestructura en 288 de 301 municipios; los 13 restantes difieren en máximo 1 COP.
- Población expuesta urbana + rural difiere del total en 275 de 301 municipios, pero la diferencia máxima es menor a una persona (0,491). Esto indica valores modelados con decimales y redondeos, no una inconsistencia material.
- El IPM se mantiene dentro del dominio 0–100.

## Uso recomendado del IPM

El IPM debe presentarse como vulnerabilidad previa, separado de la afectación causada por el sismo. La comparación útil es bidimensional:

1. percentil municipal de IPM dentro del universo con cobertura;
2. percentil del indicador de necesidad o afectación seleccionado;
3. cuadrante alto–alto para identificar municipios con vulnerabilidad previa y necesidad actual simultáneamente elevadas.

Con `necesidades de recuperación temprana` como resultado, los primeros municipios por promedio de ambos percentiles incluyen Alto Baudó, Bagadó, El Litoral del San Juan, Bajo Baudó y Medio Baudó. Este ranking es exploratorio y sensible al universo observado; no reemplaza criterios operativos, costos de acceso, población total ni verificación en terreno.

## Decisiones del nuevo tablero

- Rankings por indicador, nunca sumas de unidades incompatibles.
- Percentiles calculados dentro del mismo indicador y nivel geográfico.
- Perfil territorial que muestra valor, fuente, dimensión y percentil.
- Comparación IPM–resultado con cuadrantes y puntaje exploratorio transparente.
- Cobertura y controles de calidad visibles junto a los resultados.
- Evolución solo cuando existan dos o más fechas de corte en el historial.
- PNUD y UNDP-RÁPIDA se mantienen separados por trazabilidad, con advertencia explícita de dependencia.

## Limitaciones pendientes

- La `fecha_corte` actual corresponde a la fecha de generación común del inventario; algunas fuentes, especialmente 3iS, tienen cortes operativos propios que el cargador conoce pero no asigna todavía fila por fila.
- La columna DIVIPOLA municipal no era válida en el corte auditado: repetía el código departamental de dos dígitos. El EDA limpia esas llaves falsas, por lo que los 673 pares municipales del corte inicial quedan pendientes de código. El cargador ahora conserva `mpcodigo` de UNDP-RÁPIDA y lo reutiliza para otras fuentes cuando coincide `departamento + municipio`; los territorios fuera de esa cobertura todavía requieren un catálogo DIVIPOLA municipal completo.
- No se dispone de una fuente IPM municipal nacional completa ni de su año/base metodológica dentro del inventario actual. Antes de interpretar el IPM como tasa oficial nacional, debe verificarse el metadato original o cruzarse con una fuente DANE oficial.
- Los rankings de valores absolutos favorecen municipios grandes. Cuando exista población municipal confiable y trazable para todo el universo, conviene añadir tasas por habitante sin reemplazar los conteos originales.

