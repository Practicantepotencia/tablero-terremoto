# Denominadores sectoriales: decisión y evidencia

Rama `denominadores-sectoriales`, creada desde `priorizacion-integrada` en
`36e9afc`. Auditoría del 10 de septiembre de 2026. Numeradores del inventario
capturado el 9 de septiembre de 2026. La captura no equivale a la fecha de cada
observación en terreno. Solo cambian la segunda matriz y el segundo radar.

## San José del Palmar y Atrato

El municipio es **San José del Palmar**, Chocó, DIVIPOLA `27660`.
El otro es **Atrato**, `27050`, no Medio Atrato ni El Carmen de Atrato.

| Comprobación | San José del Palmar | Atrato |
|---|---:|---:|
| Puntos de salud afectados, 3iS | 1 | 9 |
| Centros de salud afectados, PNUD | 1 | 9 |
| Población proyectada DANE 2026 | 5.136 | 6.532 |
| Sedes IPS distintas, REPS 12/03/2026 | 2 | 3 |
| Total viviendas proyectadas DANE 2026 | 2.425 | 2.635 |
| Hogares proyectados DANE 2026 | 1.781 | 2.191 |

Se contaron **sedes por ubicación de la sede**, campo `municipiosede`, y código
único `codigohabilitacionsede`. No se contó la sede principal del prestador ni sus
servicios como edificios distintos. Se filtró la clase IPS. REPS también trae
un registro de otra clase en Atrato (jardín gerontológico); no se sumó a IPS.
El JSON conserva la consulta exacta, corte, hash, número total de filas y los seis
registros de ambos municipios antes de filtrar por clase, para poder repetirlo.

La división automática de Atrato daría `9 / 3 = 300%`. **No se publica como tasa**:
falta demostrar que numerador y denominador representan el mismo universo. Los
reportes agregados no identifican las sedes afectadas con códigos REPS. Tampoco
se verificó que varias sedes administrativas no compartan edificio.

La hipótesis de que San José del Palmar tenía un único punto no quedó confirmada.
Además de los dos registros IPS, [Minsalud, rendición de cuentas de paz 2024](https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/PES/rendicion-cuentas-construccion-paz-entidades-nacionales-2024.pdf)
documenta inversiones separadas en el centro de salud municipal y en el puesto
de La Italia, bajo la resolución 2115 de 2024. Esto acredita referencias a dos
equipamientos, no su operación ni su estado después del sismo. No se asume que
se correspondan uno a uno con los dos nombres administrativos de REPS.

Incluso conocer `1 afectado / 1 existente` no demostraría que el 100% de los
habitantes perdió toda atención: faltan funcionamiento, gravedad, capacidad,
servicios ofrecidos, atención alternativa y acceso a otros municipios. El
inventario de establecimientos es un denominador de activos, no de pacientes.

## Los 17 campos

**7 campos tienen un tipo de denominador habilitado; 10 quedan sin tasa.** Tener
un tipo habilitado no garantiza dato para cada municipio. Solo se utilizan
registros con DIVIPOLA y año exactos, valor positivo y procedencia verificable.

| Dimensión | Campo | Denominador definido | Aplicación actual |
|---|---|---|---|
| Impacto humano | Familias afectadas (`3is_familias`) | Total de hogares, previa homologación de familia a hogar | Sin tasa. DANE tiene hogares 2026, pero no se verificó equivalencia ni deduplicación del reporte de familias. |
| Impacto humano | Fallecidos (`3is_fallecidos`) | Población municipal DANE 2026 | Por 10.000 habitantes. |
| Impacto humano | Desaparecidos (`3is_desaparecidos`) | Población municipal DANE 2026 | Por 10.000 habitantes, si el numerador existe. |
| Impacto humano | Heridos (`3is_heridos`) | Población municipal DANE 2026 | Por 10.000 habitantes. |
| Vivienda | Destruidas 3iS (`3is_vivdestruidas`) | Total de viviendas DANE 2026, ocupadas y desocupadas | Por 100 viviendas de la base proyectada. |
| Vivienda | Averiadas 3iS (`3is_vivaveriadas`) | Total de viviendas DANE 2026, ocupadas y desocupadas | Por 100 viviendas de la base proyectada. |
| Vivienda | Destruidas PNUD (`pnud_vd`) | Total de viviendas DANE 2026, ocupadas y desocupadas | Por 100 viviendas de la base proyectada. |
| Vivienda | Averiadas PNUD (`pnud_va`) | Total de viviendas DANE 2026, ocupadas y desocupadas | Por 100 viviendas de la base proyectada. |
| Salud | Puntos 3iS (`3is_salud`) | Sedes físicas de salud preevento, homologadas al reporte | Sin tasa. REPS descargado y auditado, aún incompatible con los agregados de daño. |
| Salud | Centros PNUD (`pnud_csalud`) | Sedes físicas de salud preevento, homologadas al reporte | Sin tasa, por la misma falta de conciliación. |
| Educación | Puntos 3iS (`3is_educativos`) | Total de sedes educativas del mismo universo, antes del evento | Sin tasa: falta cruce por sede y definición del alcance educativo. |
| Educación | Centros PNUD (`pnud_cedu`) | Total de sedes educativas del mismo universo, antes del evento | Sin tasa: falta cruce por sede y definición del alcance educativo. |
| Infraestructura | Colapsos (`3is_colapsos`) | Total de edificios físicos comparables preevento | Sin tasa. No se verificó ese inventario; viviendas y predios no son edificios. |
| Infraestructura | Acueductos (`3is_acueductos`) | Total de sistemas urbanos y rurales del mismo universo preevento | Sin tasa. No se verificó inventario municipal exhaustivo compatible. |
| Infraestructura | Vías (`3is_vias`) | Total de vías/tramos identificados con igual delimitación | Sin tasa. El numerador es un conteo, por lo que longitud en km no sirve para una proporción. |
| Comunidad | Puntos 3iS (`3is_comunitarios`) | Total de equipamientos comunitarios comparables preevento | Sin tasa: inventario y exclusión de solapamientos no verificados. |
| Comunidad | Centros PNUD (`pnud_ccom`) | Total de equipamientos comunitarios comparables preevento | Sin tasa, por la misma falta de conciliación. |

No se añadieron matrícula, docentes o costos como si fueran campos del modelo:
no forman parte de estos 17 indicadores. Para una futura variable de matrícula
afectada sí correspondería matrícula total comparable; para daños en sedes,
matrícula total no es un denominador de proporción de edificios.

## Fuentes y decisiones

1. [DANE, proyecciones de viviendas y hogares](https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-viviendas-y-hogares).
   Publicadas el 24/12/2025. Se descargaron ambos anexos 2018–2042. Para viviendas
   se usa **Proye total viviendas mpio**, área **Total**, año **2026**, referencia
   **30 de junio**. Incluye ocupadas y desocupadas porque el numerador no está
   restringido a ocupadas. No se usa viviendas ocupadas ni se suma Total con
   cabecera/resto. El concepto DANE es vivienda censal, que puede ocupar parte de
   un edificio. Es una proyección oficial, no un conteo del parque tras el sismo.
   Los hogares se conservan como base candidata para familias, sin asignar tasa.
2. [DANE, población municipal 2018–2042](https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx).
   Se verificó de nuevo el hash del archivo que generó la base existente. Total
   municipal de 2026, publicado antes del evento. Las tasas de personas expresan
   reportes en el territorio por residentes proyectados: no son probabilidades
   individuales ni acreditan residencia de las víctimas o desplazamiento actual.
3. [Minsalud, REPS](https://www.datos.gov.co/d/c36g-9fc2).
   Datos con corte 12/03/2026. Se comprobó que la descarga contenía todas las filas
   de la consulta mediante `count(*)`. Identificadores de sede únicos, municipio
   de la sede, clase IPS, sin teléfonos ni datos de contacto en el archivo local.
   Permanece como **candidato**. Un municipio ausente de REPS no se rellena con cero.
4. [MEN, sedes SIMAT/DUE](https://www.datos.gov.co/d/x5ay-984n): la consulta agrupada
   por año devuelve exclusivamente **2019, 53.796 filas**. Una modificación de
   metadatos en 2026 no convierte los registros en matrícula o sedes de 2026.
   [El conjunto j9sd-zau5](https://www.datos.gov.co/d/j9sd-zau5) devuelve **2021,
   53.539 filas** y la atribución publicada es la Alcaldía de Santa Rosa de Cabal.
   Tampoco se asumió un dato SIMAT 2025 inexistente en esos archivos.
   [DANE EDUC 2024](https://microdatos.dane.gov.co/index.php/catalog/906) es otra
   fuente oficial de sedes de preescolar, básica y media. Su existencia tampoco
   demuestra que los agregados 3iS/PNUD usen exactamente ese universo; falta el
   inventario identificable de sedes afectadas para validar el cruce.
5. [Superservicios, inventario SSA/OCSAS 2024](https://www.superservicios.gov.co/sites/default/files/inline-files/Documento-de-lineamientos-tecnicos-OCSAS-2024.pdf):
   distingue organizaciones y sistemas, y reporta cobertura parcial. No se
   convierte el número de prestadores o la ausencia de reporte en total de
   acueductos urbanos y rurales de un municipio.
6. [INVÍAS, ficha de estado de la red primaria](https://www.invias.gov.co/index.php/archivo-y-documentos/servicios-al-ciudadano/proyectos-invias/red-nacional-de-carreteras/14617-ficha-metodologica-estadisticas-del-estado-de-la-red-vial-primaria/file):
   la longitud se mide en kilómetros y cubre la red a su cargo. No homologa el
   conteo municipal 3iS de vías afectadas.
7. [IGAC, conceptos catastrales](https://www.igac.gov.co/node/1135): un predio puede
   tener o no construcciones. No se sustituyó edificios físicos por predios.
8. Comunitarios: permanece la [auditoría de las categorías originales](auditoria_comunitarios.md).
   No se verificó una base nacional municipal compatible y excluyente.

## Cálculo y límites

Para cada campo habilitado:

```
t_mj = multiplicador_j × afectados_mj / denominador_mj
z_mj = 100 × t_mj / max(t_j en municipios comparables del universo seleccionado)
sector = suma(peso_interno_j × z_mj)
D = promedio de los seis sectores
P = D × (1 + 0,25 × IPM_DANE_2018/100) / 1,25
```

El multiplicador es 10.000 para personas y 100 para viviendas. Solo cambia la
unidad de presentación, no la normalización. Un 10% de viviendas afectadas no
equivale a 10 puntos: el puntaje depende de la máxima proporción comparable.
La escala máximo=100 mantiene su sensibilidad a valores extremos y al universo
de referencia; no se cambió esa metodología bajo una petición de denominadores.

Se conservan pesos e IPM para aislar este cambio. Los faltantes retienen su peso
y propagan límites, **nunca se redistribuye su peso a las variables disponibles**.
Como solo se habilitaron personas y vivienda, el resultado global es parcial.
No debe usarse su orden documentado como un ranking integral validado. La interfaz
lo advierte y muestra cobertura por municipio. El radar no dibuja ceros ni une
líneas a través de ejes sin datos relativos.

Reglas: sin numerador, denominador, año exacto o DIVIPOLA, no hay tasa. Bases
duplicadas, valores no positivos, unidad incompatible, procedencia sin hash o
fechas posteriores al evento se rechazan. Un numerador que supera el universo
se marca para conciliación, **no se recorta a 100%**. Un cero explícito solo se
calcula con denominador aprobado. Buscar y ordenar no cambian la referencia;
cambiar ámbito o captura sí. La primera matriz/radar conserva su cálculo absoluto.

## Reproducir y revisar

```
python preparar_denominadores_sectoriales.py  # red y openpyxl; valida fuentes
python generar_tablero_recuperacion.py       # reproduce HTML con JSON local
node --test tests/relativo.test.js
```

`data/denominadores_sectoriales.json` contiene valores extraídos, celda exacta,
fuente, fecha, código municipal, hash SHA256, consultas REPS y auditoría de años
MEN. Los registros candidatos están separados de las bases habilitadas. El código
de reglas es `web/denominadores.js`. Habilitar otro tipo exige primero documentar
su correspondencia con el numerador y la cobertura temporal y territorial; contar
filas de una fuente por sí solo no verifica esa correspondencia.
