# Notas metodológicas del tablero de recuperación

Guía de consulta para interpretar la prioridad municipal, sus tres versiones y las comparaciones con la necesidad de recuperación temprana de PNUD y UNGRD. Reúne las aclaraciones que acompañaban las matrices y los radares, ahora separadas de la vista operativa.

La simplificación cambia la presentación, no los datos, las variables, los pesos ni el cálculo. Los puntajes expresan una prioridad según el modelo; no equivalen a un porcentaje de daño. Los valores faltantes conservan su incertidumbre y no se convierten en observaciones iguales a cero.

Versión del documento 10 de septiembre de 2026. Las cifras de cobertura, referencias y ejemplos reproducen la selección del decreto en la captura de ese día. Son ejemplos fechados, no constantes del modelo: en el tablero se actualizan con los filtros y las nuevas capturas.


## Las tres versiones y sus denominadores

Absoluto usa los conteos publicados. Per cápita divide todos los conteos entre población municipal y los expresa por 10.000 habitantes. Relativo usa una base compatible propia del indicador; si esa base no está verificada, no calcula la tasa.

En relativo están habilitados siete campos: fallecidos, desaparecidos y heridos de 3iS por población DANE 2026; viviendas destruidas y averiadas de 3iS y PNUD por el total municipal de viviendas DANE 2026. Estas últimas se expresan por 100 viviendas e incluyen viviendas ocupadas y desocupadas. Tener una regla habilitada no garantiza datos para cada municipio.

Los otros diez campos quedan sin tasa: familias afectadas, puntos y centros de salud, puntos y centros educativos, colapsos de edificios, acueductos, vías y puntos y centros comunitarios. Faltan equivalencias de definición o inventarios comparables. No se sustituye un denominador sectorial ausente por población.

Hogares sería la base candidata para familias; sedes físicas para salud y educación; edificios para colapsos; sistemas para acueductos; vías o tramos equivalentes para el conteo vial; equipamientos equivalentes para comunitarios. Familias no se homologa automáticamente a hogares, edificios a viviendas, prestadores a sistemas ni conteos viales a kilómetros.


## Fórmulas y pesos

Cada variable se normaliza respecto al máximo comparable del ámbito territorial y de la captura seleccionados. En las versiones per cápita y relativa se normaliza la tasa; en la absoluta se normaliza el conteo.

Tasa = afectados × multiplicador / denominador

z = 100 × valor comparable / máximo comparable

Sector = suma de z × peso interno

D = suma de los seis sectores / 6

P = D × (1 + 0,25 × IPM / 100) / 1,25

Cada sector pesa 1/6. Impacto humano tiene cuatro campos con 25% cada uno; vivienda cuatro campos con 25%; salud, educación y comunidad dos campos con 50%; infraestructura tres campos con un tercio cada uno. Se conserva por separado cada canal de fuente; coincidencia de cifras no acredita independencia.

El IPM de nuestro modelo corresponde a DANE censal 2018. Su antigüedad limita la representación de la vulnerabilidad actual. No es el IPM de RAPIDA ni se añade al puntaje publicado de necesidad de recuperación temprana.

Un campo sin valor tiene un puntaje desconocido entre 0 y 100. Para los límites se calculan ambos extremos conservando su peso. El límite documentado es conservador y puede favorecer municipios con más información. El límite posible no es una predicción y el intervalo no es un intervalo de confianza.


## Ámbito territorial

Tres lecturas de las mismas necesidades: absoluta, per cápita y relativa a bases sectoriales verificadas. Datos, fórmulas y cobertura a la vista.

12 departamentos nombrados en el inventario del Decreto 1171. El ámbito administrativo no acredita afectación en cada municipio.


## Matrices de prioridades

Orden normal: prioridad global documentada de mayor a menor. Pulsa una columna: mayor a menor → menor a mayor → orden normal. Selecciona un municipio para ver su fórmula.

3iS: reportes consolidados · PNUD: inventario de daños usado para la estimación · DANE 2018: vulnerabilidad

El intervalo propaga datos faltantes; no es un intervalo de confianza. El color representa la intensidad normalizada de cada campo. «—» es sin dato.

Las cifras PNUD y 3iS pueden compartir insumos. Cada sector mantiene un peso fijo; coincidir no cuenta como corroboración independiente.

509 municipios visibles · 509 en la referencia. El filtro del decreto recalcula anclas, puntajes y posiciones. La búsqueda no los cambia.

Todos los conteos por 10.000 habitantes

Concentración del reporte por residente, no proporción del parque de viviendas, sedes o infraestructura dañado. Una tasa de 3,8 heridos por 10.000 habitantes no significa 3,8 personas reales; consulta el conteo original.

Orden por límite documentado de la prioridad relativa. Pulsa una dimensión: mayor a menor → menor a mayor → orden normal. Todos los conteos por 10.000 habitantes. Bases DANE 2026.

Cada variable: tasa = valor × 10.000 / población municipal; puntaje = 100 × tasa / máxima tasa comparable. Se conservan los 17 campos, los seis sectores (1/6 cada uno) y el ajuste IPM. Referencia: departamentos del decreto, captura 2026-09-10. Buscar, ordenar o filtrar departamento no cambia esa referencia. Mide concentración por residente, no porcentaje de instalaciones dañadas. No se imputa población ausente.

Familias por habitante no equivale a porcentaje de hogares afectados. Sedes de salud o educación por habitante no mide pérdida de capacidad ni acceso. Viviendas, vías, acueductos y edificios requieren sus propios inventarios para medir la proporción afectada: consulta la tercera matriz. La población proyectada no refleja desplazamientos posteriores al sismo.

509 municipios visibles · 468 con algún puntaje relativo · 509 en la referencia. Cada variable excluye numeradores y denominadores faltantes, incompatibles o no verificados.

Denominador propio por indicador

Comparación parcial: hay bases habilitadas para personas y vivienda. Los sectores sin denominador no tienen puntaje relativo; su ausencia no acredita menor necesidad. El orden global es solo el límite documentado y conserva el peso de los faltantes.

Orden por límite documentado de la prioridad relativa. Pulsa una dimensión: mayor a menor → menor a mayor → orden normal. Personas: por 10.000 habitantes; vivienda: por 100 viviendas. Bases DANE 2026.

Cada variable: tasa = valor × factor / denominador propio; puntaje = 100 × tasa / máxima tasa comparable. Se conservan los 17 campos, los seis sectores (1/6 cada uno) y el ajuste IPM. Referencia: departamentos del decreto, captura 2026-09-10. Buscar, ordenar o filtrar departamento no cambia esa referencia. No se sustituye un denominador ausente por población. Bases verificadas el 2026-09-10.

Personas: reportes por 10.000 habitantes. Viviendas: porcentaje respecto al total proyectado de viviendas, ocupadas y desocupadas. La proporción de viviendas y el puntaje normalizado son distintos. Familias, salud, educación, infraestructura y comunidad quedan sin valor relativo mientras no se verifique un denominador compatible. Ver lista de los 17 campos, fuentes y motivos de exclusión.

Se conserva el ajuste por IPM censal 2018. Población proyectada es una referencia previa: no mide desplazamientos tras el sismo. Los reportes siguen teniendo las limitaciones de cobertura y clasificación del índice absoluto.

El puntaje combina seis sectores con el mismo peso. En vivienda, salud, educación y servicios comunitarios se conservan por separado los reportes 3iS y las cifras del inventario PNUD. Impacto humano e infraestructura usan 3iS. La necesidad de recuperación temprana se usa como comparación, sin entrar a la fórmula.

El primer número es el límite inferior compatible con las observaciones. El intervalo muestra cuánto podría cambiar al completar los faltantes. Un intervalo amplio impide afirmar un puesto definitivo. Este orden conservador puede favorecer territorios mejor documentados; «Prioridad posible» permite revisar los que faltan por caracterizar.

La pobreza censal municipal de 2018 ajusta la prioridad hasta un 25% respecto al mismo daño. No crea prioridad donde no hay daño. Los pesos son una propuesta de decisión; se prueban 39 escenarios de sensibilidad.


## Comparación mediante radares

Selecciona hasta tres municipios. Cada eje representa un sector de 0 a 100, no un porcentaje de daño. La línea continua es el límite documentado; la discontinua muestra el límite posible por faltantes. El área del polígono no es el índice global.

Modelo 1.2 · Captura 2026-09-10 · Referencia: departamentos del decreto, 509 municipios; cada variable usa solo los que tienen dato comparable. Buscar o seleccionar municipios no recalcula la referencia; cambiar universo o captura sí.

Comunitario: las fuentes presentan esta categoría separada de salud y educación, pero no se ha verificado que sus establecimientos sean excluyentes. Puede haber doble ponderación de un mismo daño. No sumes estas cantidades como edificios únicos. Ver comprobación y límites.

Pasa el mouse sobre un punto para ver sus entradas y su resultado a la derecha. También puedes enfocarlo con Tab o tocarlo. Los botones de sector ofrecen la misma consulta cuando los puntos se superponen.

El mismo radar, con los conteos por 10.000 habitantes antes de normalizar de 0 a 100. No representa el porcentaje de instalaciones afectadas. Línea continua: documentado; discontinua: posible por faltantes. Los ejes sin datos no tienen puntos.

Modelo 1.2 · Per cápita · población DANE 2026 · Captura 2026-09-10 · Referencia: departamentos del decreto, 509 municipios; cada variable usa solo los que tienen dato comparable. Buscar o seleccionar municipios no recalcula la referencia; cambiar universo o captura sí.

Pasa el mouse, enfoca con Tab o toca un punto para ver el conteo original, la población, la tasa y el cálculo completo. Las selecciones son independientes de los otros radares.

Selecciona hasta tres municipios. Cada eje representa un puntaje normalizado de 0 a 100 con el denominador propio de cada indicador. Personas por 10.000 habitantes y viviendas por 100 viviendas. Los sectores sin base válida no se dibujan; sus motivos se consultan en los botones de sector. La línea continua es el límite documentado; la discontinua muestra el límite posible por faltantes. El área del polígono no es el índice global.

Modelo 1.2 · Denominadores sectoriales · bases DANE 2026 · Captura 2026-09-10 · Referencia: departamentos del decreto, 509 municipios; cada variable usa solo los que tienen dato comparable. Buscar o seleccionar municipios no recalcula la referencia; cambiar universo o captura sí.

Comparación parcial: hay bases habilitadas para personas y vivienda. Salud, educación, infraestructura y comunidad no tienen denominador homologado. Sus ejes quedan sin puntos; conserva la lectura de los faltantes al comparar municipios. Ver bases, fuentes y comprobación de San José del Palmar y Atrato.


## Necesidad de recuperación temprana y dispersión

Resultado original de necesidades de recuperación temprana UNDP/PNUD RAPIDA. Se conserva sin mezclarlo ni sustituirlo por nuestro índice.

Orden exclusivamente por necesidad de recuperación temprana. 298 municipios coinciden con la búsqueda. Captura 2026-09-10; corte de fuente no verificado. Cobertura: sectores con todos sus campos / 5. Los puestos de esta tabla se calculan dentro del departamento visible; el gráfico de comparación conserva los del ámbito completo.

El IPM contextualiza el resultado. Los ejes no constituyen mediciones independientes.

Selecciona un punto para abrir su ficha.

298 pares visibles. Líneas P75: necesidad de recuperación temprana 0,426 e IPM 18,08. Referencia: ámbito territorial seleccionado, antes de filtrar departamento.

Base: departamentos del decreto · captura 2026-09-10. 286 pares de 509 municipios.

509 municipios en la referencia; 298 con necesidad de recuperación temprana. Excluidos de la dispersión: 39 sin índice documentado; 184 sin necesidad de recuperación temprana comparable (categorías excluyentes). Se incluyen todos los pares disponibles de la versión seleccionada; no se rellenan faltantes.

X es el límite documentado de nuestro índice (0–100); Y es el puntaje original de necesidad de recuperación temprana, sin convertirlo en puesto ni reescalarlo a 100. Los valores más altos se dibujan arriba.

El ajuste es una recta con intercepto: Y = a + bX. Pearson r = cov(X,Y) / (desv(X) × desv(Y)); R² = r² = 1 − Σ(Y − Ŷ)² / Σ(Y − promedio Y)². Spearman es Pearson aplicado a los rangos de los pares, con rango promedio en empates. Los estadísticos usan precisión completa; no se calculan con menos de tres pares ni con una serie constante.

Una correlación positiva indica que los puntajes altos de nuestro índice tienden a acompañarse de puntajes altos de necesidad de recuperación temprana. R² no conserva ese signo ni prueba que alguno de los índices sea correcto. No se estima causalidad, significación estadística ni validación independiente: los modelos comparten parte de sus insumos.

El universo y la captura recalculan las anclas y los puestos de referencia. El departamento restringe los pares y recalcula r y R², pero no las anclas ni los puestos. La búsqueda solo resalta puntos. Se incluyen todos los municipios de los filtros generales que tengan ambos datos en la versión elegida. Al cambiar de versión, la cantidad de pares puede cambiar si faltan datos. La versión relativa conserva sus límites de cobertura; los detalles se consultan en «Fuentes y método». Ceros explícitos válidos se incluyen; faltantes no se imputan. Los límites superiores no entran en la regresión.

Su ausencia del ranking no significa necesidad baja.


## Diagnóstico territorial

UNDP · RAPIDA · municipal · Índice · captura 2026-09-10. La selección de fuente e indicador se conserva aunque el filtro deje la vista sin datos.

298 territorios. Percentiles y distribución dentro del mismo indicador, fuente, unidad y captura. La búsqueda solo reduce las tablas.

Abejorral, Antioquia · UNDP-RAPIDA. Vínculo territorial: DIVIPOLA (05002). Los percentiles usan la misma fuente, indicador y selección geográfica.

Panel constante: 1 territorio. Cambio entre primera y última captura: 0 Índice.


## Alcance y límites del método

Un cero explícito tiene intensidad cero. Si falta una observación, su intensidad puede estar entre 0 y 100. Se propagan ambos extremos sin repartir su peso a otra variable ni rellenarla desde otra fuente. Los valores originales se conservan. La escala proporcional conserva las razones entre cantidades de un mismo indicador, sin recorte P95. Es sensible a máximos extremos o erróneos y al tamaño municipal; no mide tasas de afectación.

Se usa la captura 2026-09-10 y el ámbito de departamentos del decreto: 509 municipios del inventario. Cada ancla usa exclusivamente su propia fuente, definición y unidad. Esta limitación corresponde a la versión absoluta; la versión relativa sí usa viviendas DANE donde la base es válida.

39 escenarios: pesos sectoriales iguales o un sector ±25%, cruzados con un ajuste de pobreza de 0%, 25% y 50%. La ficha muestra el rango de puestos del límite inferior. Es sensibilidad a decisiones metodológicas, no confianza estadística ni validación del daño. Los intervalos por faltantes se muestran por separado.

La necesidad de recuperación temprana se usa como comparación. No se suman sus componentes duplicados con PNUD, ni costos de reposición que repiten el daño físico. Rescatados mide una respuesta realizada. Impacto humano incorpora familias afectadas, fallecidos, desaparecidos y heridos de 3iS, con un peso interno de 25% cada uno. Sus conteos se normalizan por separado: no se suman como personas únicas. ExE se mantiene en su matriz porque falta atribuir cada sede al sismo. OPS departamental y puntos Naboo no se asignan como daños municipales.

El modelo no mide necesidad neta pendiente: todavía faltan entregas, reparación realizada, costos de acceso y capacidades locales. Sus pesos son una propuesta explícita y el orden conservador puede favorecer territorios con más evidencia. JRC: sensibilidad de indicadores compuestos.

Universo, departamento y captura seleccionados. Los territorios pueden repetirse entre fuentes; sus coberturas no se suman.

El orden principal es el límite inferior del modelo sectorial. Los empates comparten posición. Se puede contrastar con la necesidad de recuperación temprana o revisar el límite superior para orientar la búsqueda de información.

La referencia de normalización cambia al elegir todos los departamentos o solo los del decreto. La búsqueda, el filtro de departamento y el selector de fuente solo cambian la vista, no el puntaje.

Cada ranking sectorial exige la misma fuente, indicador, nivel, unidad, definición registrada y captura. Las otras fuentes se consultan por separado. Nunca rellenan los huecos de la fuente elegida.

Las magnitudes absolutas sirven para dimensionar la respuesta y dependen del tamaño territorial. No se calculan tasas sin denominadores compatibles y verificados.

La cobertura pondera la fracción conocida de los 17 campos del modelo. Cuenta disponibilidad, no calidad o certeza. Las categorías de edificios se normalizan por separado; sus cantidades no se suman.

La fecha de captura es la del inventario. Falta acreditar la fecha efectiva y la versión metodológica de cada observación. Las comparaciones dentro de una fuente siguen siendo provisionales.

El modelo usa el IPM censal DANE 2018 ya verificado en fuentes-nuevas. Su antigüedad limita la representación de la vulnerabilidad actual. El IPM de RAPIDA se conserva únicamente en las consultas de esa fuente.

PNUD y RAPIDA comparten cifras en el solapamiento auditado. Su coincidencia no demuestra validación independiente. La fuente elegida tampoco elimina posibles errores internos o sesgos de cobertura.

El decreto delimita el filtro administrativo. No demuestra daño en todos sus municipios, ni ausencia de daño fuera de ellos. Las observaciones ExE conservan una advertencia de atribución.

El historial individual del diagnóstico usa únicamente territorios presentes en todas las capturas comparadas. Se informa su tamaño; no representa automáticamente al departamento completo.

Se excluyen registros inválidos o conflictivos; un dato ausente no se convierte en cero. Los nombres solo se vinculan si el código no es ambiguo.

Modelo sectorial y decisiones metodológicas · Auditoría de los indicadores · Historial del índice original


## Precisiones que acompañaban las fichas

Las referencias comparables mantienen fuente, indicador, unidad y captura. N incluye ceros explícitos y excluye vacíos y conflictos. Un cero explícito solo obtiene tasa cero cuando existe un denominador válido. Los aportes desconocidos se incorporan como límites, no como daños observados.

Los cálculos utilizan precisión completa; la interfaz redondea su presentación. En el radar, el aporte de cada sector al índice global incluye el peso sectorial de 1/6 y el ajuste por IPM. El área del polígono no representa el índice global.

El ajuste de la dispersión describe una asociación entre los pares disponibles. La recta no es una fórmula de priorización ni convierte puntajes en probabilidades. El puntaje relativo global sigue siendo parcial, porque cuatro sectores carecen de denominadores compatibles.


## Notas específicas de cada fuente


### UNDP · RAPIDA

Se conservan los valores publicados por PNUD/UNGRD; la cobertura depende del indicador y del ámbito seleccionado. La documentación incorporada al repositorio no permite reproducir la fórmula y los pesos de la necesidad de recuperación temprana ni verificar el año base del IPM de esta fuente. Ese IPM es distinto de la línea base DANE censal 2018 documentada para nuestro modelo. El puntaje original se consulta sin añadirle IPM.

[Consultar fuente](https://geosmart.undp.org/arcgis/apps/storymaps/stories/9d0ef01099a64edda2caecbd34135d7e)


### PNUD · estimación de daños

Vivienda y daño económico coinciden con RAPIDA en la cobertura común auditada. No constituyen corroboración independiente ni se suman entre fuentes.

[Consultar fuente](https://pnudco.github.io/Respuesta-a-crisis-y-recuperaci-n-temprana/)


### 3iS · reportes territoriales

Cobertura de reportes por territorio. Su corte operativo no está conservado fila por fila en este inventario.

[Consultar fuente](https://docs.google.com/spreadsheets/d/1fQ-LTlIEljzOKvW23epwevJeWLWORi88xL7XxkpTMzY)


### Fundación ExE · sedes educativas

Necesidades educativas de alcance amplio. Estar dentro de un departamento del decreto no prueba que el daño de cada sede sea causado por el sismo. Fuera de ese ámbito: no atribuida al sismo.

[Consultar fuente](https://practicantepotencia.github.io/tablero-terremoto/data/sedes_educativas_afectadas_ago2026.csv)


### Naboo · puntos reportados

Mide puntos registrados; intensidad de reporte y daño pueden confundirse. Un cero no acredita ausencia de afectación.

[Consultar fuente](https://www.mapadelterremoto.com/datos/registro.json)


### Listado municipal · gravedad

El valor 0 significa sin clasificación oficial en el listado, no sin daño. Las categorías no son cantidades sumables.

[Consultar fuente](https://practicantepotencia.github.io/tablero-terremoto/data/municipios_afectados_terremoto_colombia_ago2026.csv)


### Cámaras · empresarios

Cobertura departamental parcial. Empresarios reportados no equivalen a pérdida de producción ni a empleo perdido.

[Consultar fuente](https://practicantepotencia.github.io/tablero-terremoto/data/camaras_comercio_empresarios_afectados_ago2026.csv)


### Ámbito del Decreto 1171

Filtro por departamentos nombrados en el inventario. No es una delimitación municipal del daño ni una prueba de atribución causal.

[Consultar fuente](https://practicantepotencia.github.io/tablero-terremoto/data/decreto_1171_11ago2026.pdf)


## Documentación para profundizar

[Modelo de priorización](https://github.com/Practicantepotencia/tablero-terremoto/blob/main/docs/modelo_priorizacion.md)

[Denominadores y exclusiones](https://github.com/Practicantepotencia/tablero-terremoto/blob/main/docs/denominadores_sectoriales.md)

[Las tres vistas y la comparación](https://github.com/Practicantepotencia/tablero-terremoto/blob/main/docs/tablero_unificado.md)

[Auditoría de los indicadores](https://github.com/Practicantepotencia/tablero-terremoto/blob/main/docs/auditoria_indicadores_largo.md)

[Categorías comunitarias](https://github.com/Practicantepotencia/tablero-terremoto/blob/main/docs/auditoria_comunitarios.md)

