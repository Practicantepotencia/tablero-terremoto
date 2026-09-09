# Modelo de priorización sectorial 1.1

Rama `priorizacion-integrada`, creada desde `reestructuracion-recuperacion`,
commit `e65bc81f2d384dc0f07f1a6ea1df3c0dd9af83c0`.

## Decisión que apoya

Ordenar la revisión de intervenciones de recuperación a partir de afectación
sectorial y vulnerabilidad previa. El índice es una propuesta multicriterio
reproducible, no una predicción validada ni una estimación de necesidades netas
pendientes. RAPIDA queda disponible como comparación externa y no entra al cálculo.

La pantalla principal es la matriz municipal. El selector cambia los datos
visibles sin cambiar el orden elegido. Conserva RAPIDA y las distinciones internas
de ExE, 3iS y las demás fuentes. Buscar y filtrar departamento no recalcula el
puntaje; cambiar el ámbito del decreto o la captura sí lo recalcula.

El selector `Puntaje para ordenar` permite cambiar del índice global a cualquiera
de los seis sectores. En ese caso, el puesto sectorial se calcula únicamente entre
municipios con algún dato en el sector seleccionado; los que no tienen datos quedan
sin puesto, al final. `Puntaje documentado` ordena por el límite inferior y
`Puntaje posible por faltantes` por el superior. El puesto global se conserva como
referencia y la dimensión elegida pasa a la primera columna. RAPIDA mantiene su
orden propio y no usa el selector sectorial.

## Variables y pesos

Cada sector tiene peso **1/6**. Los pesos internos siempre suman uno; no se
renormalizan por la disponibilidad de cada municipio.

| Sector | Variables | Pesos internos |
| --- | --- | --- |
| Hogares afectados | Familias afectadas, 3iS | 100% |
| Vivienda | Destruidas y averiadas, 3iS; destruidas y averiadas, PNUD | 25% cada campo |
| Salud | Puntos de salud 3iS; centros de salud PNUD | 50% cada canal |
| Educación | Puntos educativos 3iS; centros educativos PNUD | 50% cada canal |
| Infraestructura y acceso | Colapsos de edificios, acueductos y vías, 3iS | 1/3 cada campo |
| Servicios comunitarios | Puntos comunitarios 3iS; centros comunitarios PNUD | 50% cada canal |

Son 14 campos de daño/afectación y una línea base de pobreza. No se interpreta
que un conteo de 3iS sea idéntico en definición al campo PNUD. Son entradas
separadas, con normalización propia. Los dos canales pueden compartir reportes
de origen: no representan votos independientes ni corroboración doble.
Su participación 50/50 es una elección de diseño, no una probabilidad de acierto.

Ponderar sectores por igual evita que infraestructura pese más solo por tener
más variables. Hogares y vivienda pueden estar correlacionados: responden a
demanda humana y daño material, pero no son independientes. El índice no suma
sus cantidades como si fueran personas o edificios distintos.

## Fórmula exacta

Para cada campo `j`, con fuente, definición, unidad, nivel y captura fijos:

```
a_j = máximo de los valores disponibles comparables del campo j
z_mj = 100 × x_mj / a_j
z_mj = 0 si x_mj es un cero explícito

S_md = suma_j peso_interno_dj × z_mj
D_m = suma_d S_md / 6
V_m = IPM censal DANE 2018 / 100
P_m = D_m × (1 + 0.25 × V_m) / 1.25
```

La versión 1.1 conserva proporciones entre cantidades de un mismo campo. No
recorta en P95 ni aplica logaritmos. Solo el máximo alcanza 100 (salvo empates).
Los ceros explícitos permanecen en cero, incluso si toda la referencia es cero.
Un máximo extremo o erróneo puede comprimir el resto: esta escala tampoco es
una validación de prioridad ni una tasa de afectación. Los límites de faltantes
son condicionales a esta referencia; si aparece un valor mayor, se recalcula.

La versión 1.0 buscaba atenuar extremos con logaritmo y recorte P95, pero igualaba
12.098 y 20.998 familias a 100. Se retira ese diseño en todos los campos para
mantener una regla consistente, no para producir un municipio ganador concreto.
Ahora: Armenia = 100 × 12098/43052 = 28,1009; Buenaventura = 48,7736;
Cali = 100 (referencia: 124 municipios con familias, captura 2026-09-09, decreto).

La referencia incluye municipios con dato comparable en el ámbito administrativo
elegido, antes de buscar o filtrar departamento. No se convierten los conteos en
tasas: los denominadores municipales de vivienda, servicios y matrícula todavía
no están acreditados como compatibles para todos estos numeradores.

El ajuste censal hace que, a igual daño, el resultado de un municipio con IPM
100 sea 25% mayor que el de uno con IPM cero. No suma pobreza como daño y no da
puntaje positivo a un municipio con todos los daños explícitamente iguales a cero.
La medición de 2018 es antigua; no se presenta como pobreza municipal de 2026.

## Faltantes: límites, no sustitución

Una observación faltante corresponde a una intensidad desconocida entre 0 y 100.
Se propagan ambos extremos manteniendo todos los pesos fijos. El extremo cero es
un supuesto para calcular el límite inferior, **no un dato imputado guardado como cero**.
Si falta IPM, se propaga el rango 0–100 de esa variable también.

La pantalla muestra `P inferior – P superior`. No es un intervalo de confianza:
no cubre errores de los reportes, fechas incompatibles, modelos de origen ni
subregistro. Describe solamente lo que los faltantes permiten dentro de esta fórmula.

El orden por defecto usa el límite inferior: demanda respaldada por la evidencia
disponible bajo el modelo. **Puede favorecer municipios mejor documentados.**
No se afirma que sea un orden total definitivo. El selector de límite superior
permite localizar municipios donde completar información podría cambiar decisiones.
Los municipios sin ningún campo puntuable siguen consultables sin puesto global.

La cobertura es la suma de los pesos de los campos conocidos, entre 0 y 100%.
No se multiplica el puntaje por cobertura ni se redistribuyen pesos disponibles.
La cobertura refleja la anchura del intervalo de daño, no la calidad del reporte.

El mejor puesto compatible con los intervalos cuenta municipios cuyo límite
inferior supera el superior del municipio consultado, más uno. El peor cuenta
los superiores ajenos que superan su inferior, más uno. Solo se comparan
municipios con algún campo del modelo. Empates numéricos comparten posición.

## Sensibilidad

Se ensayan 39 escenarios: el vector de seis pesos iguales y doce vectores que
suben o bajan un sector 25%, normalizados para sumar uno; cada vector se cruza
con ajustes de pobreza de 0%, 25% y 50%. La ficha muestra el rango de puestos
del límite inferior. Los demás datos y anclas se mantienen fijos.

Esto evalúa sensibilidad a esos pesos. No cubre todas las normalizaciones,
definiciones o errores posibles, ni justifica probabilidades de pertenecer al top.
El criterio de examinar estas decisiones sigue la guía de
[JRC sobre sensibilidad de compuestos](https://knowledge4policy.ec.europa.eu/composite-indicators/toolkit_en/navigation-page/10-step-guide_en/step-8-sensitivity-analysis_en).

## Qué queda fuera y por qué

- Recuperación RAPIDA: referencia comparativa; no realimentamos el modelo con
  el resultado que queremos superar. Sus campos duplicados con PNUD tampoco entran.
- Costos de reposición PNUD: repiten parte de las cantidades de daño físico
  multiplicadas por precios. Se consultan para dimensionar costos, sin otro voto.
- Rescatados: actividad de respuesta realizada. No equivale a necesidad pendiente.
- Fallecidos, heridos y desaparecidos: permanecen visibles en 3iS. La prioridad
  de búsqueda, rescate o atención clínica inmediata requiere un protocolo distinto;
  este índice aborda recuperación territorial.
- ExE: conserva su matriz de sedes, criticidad, matrícula y docentes. La
  atribución al sismo no está acreditada por sede; no se usa para inflar el índice.
- Cámaras y OPS departamentales: no se prorratean a municipios.
- Naboo: puntos de reporte no son totales de personas o activos afectados.
- Aeropuertos: un conteo aislado sin capacidad ni interrupción del servicio no
  permite representar adecuadamente acceso aeroportuario en todos los municipios.

No hay un componente municipal verificable de pérdida de ingresos, empleo,
capacidad institucional de respuesta o ayudas entregadas. «Global» significa
el compuesto de los sectores disponibles, no una medición exhaustiva de todas
las necesidades. Debe ampliarse cuando existan variables compatibles y relevantes.

## Identidad y origen de la línea base

Se reutiliza únicamente el IPM total y la referencia geográfica del DANE ya
incorporados en `fuentes-nuevas`, commit
`85fe4adcf00f0749f1a9449f18da6d50a7a17b65`. El archivo generado
`data/linea_base_priorizacion.json` conserva periodo, código, hoja/celda, URL,
hash del paquete de origen y metadatos del Excel original. El extractor es
`preparar_linea_base_priorizacion.py`.

No se añadieron cientos de indicadores de línea base al frente del tablero.
Los 1.122 territorios censales tampoco se insertan como municipios afectados:
solo se vinculan a los que ya aparecen en el inventario.

Se corrigen equivalencias explícitas entre Cali/Santiago de Cali, Anserma
Nuevo/Ansermanuevo, Calima (Darién)/Calima y tres nombres de Chocó. Siempre
se exige el departamento correspondiente y un código existente en la referencia.
Los códigos incompatibles o ambiguos se excluyen y registran como incidencia.
No hay emparejamiento aproximado por semejanza de texto.

## Resultado de la captura auditada

Captura del inventario: 9 de septiembre de 2026. En los departamentos del decreto:
509 identidades municipales después del cruce, 470 con algún componente, 39
sin componentes y ninguna con los 14 campos completos. El top 20 de prioridad
documentada comparte 10 municipios con el top 20 de RAPIDA.

Con la versión 1.1, los primeros por límite inferior son Pereira, Cali, Quibdó,
Armenia y Buenaventura. Armenia pasa al puesto 4, con intervalo 23,7865–28,3909. Sus
intervalos se solapan, de modo que ese orden exacto no se identifica solo con
los datos observados. Santiago de Cali integra correctamente los **515 colapsos**
3iS en infraestructura; su vivienda 3iS sigue sin dato y no se convierte en cero.

Estos resultados describen la propuesta de pesos y esa captura. No prueban que
el nuevo orden sea más acertado que RAPIDA en terreno. Para validarlo hacen falta
evaluaciones posteriores y resultados de intervenciones independientes del modelo.

## Reproducir

```
python generar_tablero_recuperacion.py
python -m unittest discover -s tests -v
node --test tests/modelo.test.js tests/priorizacion.test.js
```

El HTML incorpora código, datos y línea base, y se puede abrir localmente.
GitHub Actions verifica y regenera este HTML solo en `priorizacion-integrada`.
La descarga de nuevas capturas sigue disponible mediante el actualizador original.
La rama nueva no modifica los horarios de las otras ramas.

## Horizon: decisión práctica

Se conservó como referencia su enfoque de comparar criterios y acercarse a
necesidades concretas. No se incorporaron sus demostraciones operativas. El mapa
y EDAN/alojamientos son los módulos útiles para una fase posterior; antes de
unir sus cifras hacen falta los archivos originales y procesos reproducibles.
La prioridad actual es una matriz legible con una fórmula propia y descomposición.

## Acueductos de Armenia y comparación radar

Consulta directa realizada el 9 de septiembre de 2026 a la hoja pública
[Datos_Territoriales de 3iS](https://docs.google.com/spreadsheets/d/1fQ-LTlIEljzOKvW23epwevJeWLWORi88xL7XxkpTMzY/edit).
Se comprobó la respuesta GViz JSON tipada, no solo el formato visual del CSV:
para Armenia, Quindío, reporte `9 Sep 06:30`, `Acueductos` es `null`, no `v:0`.
Los reportes `8 Sep 06:30` y `7 Sep 06:30` también están vacíos.
El reporte `27 Ago 06:30` sí contenía `v:1`. No hay fundamento para interpretar
el vacío posterior como reparación o cero. No se rellena con el valor antiguo.

La pestaña Comparar municipios, inmediatamente después de Prioridades, usa los
mismos objetos calculados por el modelo. Admite hasta tres municipios, búsqueda
por nombre y departamento, hover, foco de teclado y toque. Cada eje corresponde
a uno de los seis sectores. Su inspector muestra entradas, máximo, N de referencia,
normalización, pesos, aportes, límites sectoriales y cálculo global con IPM.
La línea discontinua representa faltantes, no un segundo dato observado. Los
botones de sector permiten acceder a puntos superpuestos. El área no es el índice.
