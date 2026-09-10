# Priorización territorial sin cascada de fuentes

## Decisión de diseño

La vista operativa abandona el promedio de dimensiones tomadas de fuentes
distintas. Su variable principal es `undp_rapida_recovery_needs`, tal como
la publica UNDP-RAPIDA. La unidad de priorización es municipal; no se crea
un índice departamental sumando o promediando ese resultado.

El IPM es contexto de vulnerabilidad. No modifica el orden, no desempata y
no se promedia con recuperación o daño. El inventario consultado no contiene
la fórmula completa ni los pesos de RAPIDA: no permite reconstruir qué parte
exacta del resultado corresponde a IPM. La relación se explora en el gráfico,
sin tratar ambos ejes como mediciones independientes. El año base del IPM
y su correspondencia con la medición DANE requieren documentación adicional.

Los índices originales siguen disponibles mediante `--legado`. Sus archivos
históricos no son entradas del nuevo ranking. La exportación larga puede
retener campos calculados por compatibilidad; el preparador excluye toda fila
con fuente `Calculo`.

## Comparabilidad exigida

Una comparación sectorial identifica una cohorte por:

`fuente + nivel + dimensión + indicador_id + unidad + nombre registrado`

Además exige una sola fecha de captura seleccionada. La misma cohorte se
conserva al cambiar de ámbito territorial, incluso cuando no quedan datos.
Una selección vacía nunca activa otra fuente o un indicador alternativo.

Esta regla elimina la mezcla automática de metodologías de la cascada, pero
no acredita comparabilidad absoluta: los nombres iguales pueden ocultar
revisiones metodológicas y el esquema no conserva fecha efectiva por fila.
El tablero muestra esa limitación junto a las comparaciones. No se etiqueta
una captura como un corte operativo verificado.

No se calculan tasas sin denominadores trazables para el mismo universo,
periodo y definición. Los conteos y COP son magnitudes absolutas y pueden
depender del tamaño del territorio. No se aplican logaritmos, percentiles o
mínimo–máximo como supuesto remedio a una diferencia de unidades.

## Ranking, percentiles y cobertura

- Ranking de recuperación: valor descendente, empate con la misma posición,
  orden alfabético de presentación entre empates. No depende de IPM ni de
  indicadores publicados por otras fuentes.
- Tramo superior: valor >= cuantil 0,75, interpolación lineal, con al menos
  cuatro observaciones y más de un valor distinto. Es un criterio exploratorio
  relativo; no ordena intervenciones inmediatas ni define un umbral oficial.
- Referencia P75: universo territorial seleccionado antes del filtro de
  departamento y búsqueda. Se recalcula si cambia la captura o el ámbito del
  decreto; el tamaño y el umbral se muestran.
- Percentil sectorial: `(n_menores + 0.5*n_iguales) / n * 100`, en la misma
  cohorte, captura, universo y departamento. La búsqueda solo recorta las
  tablas; no recalcula posiciones, distribución o percentiles.
- No se añade un índice de confianza inventado. Se informa número de campos
  observados, origen, identidad geográfica y las limitaciones de fecha.

La cobertura sectorial RAPIDA considera cinco grupos. Un grupo cuenta como
disponible cuando están todos sus campos de referencia, incluidos los ceros:

| Grupo | Campos |
| --- | --- |
| Vivienda | `bdg_homes_dest`, `bdg_homes_dmg` |
| Salud | `bdg_health_aff` |
| Educación | `bdg_edu_aff` |
| Instituciones | `bdg_comm_aff`, `bdg_public_imp` |
| Economía | `econ_dmg_total_cop` |

El indicador de cobertura no suma valores de estos grupos ni condiciona el
orden de recuperación. Las categorías de edificios se muestran por separado:
no se ha probado que sean mutuamente excluyentes. Los municipios sin resultado
RAPIDA se muestran como no evaluados en recuperación, sin asignarles cero.

## Geografía y atribución

Se usa DIVIPOLA cuando es válido y unívoco. Un nombre normalizado por espacios,
mayúsculas y tildes solo hereda un código si la asociación es única. Cuando no
existe código, se usa departamento + municipio y se informa. Los homónimos
de departamentos diferentes permanecen separados. No se aplica coincidencia
difusa. Una identidad con códigos contradictorios se excluye y se reporta.

El filtro del Decreto 1171 utiliza los departamentos marcados por el indicador
normativo en la captura seleccionada. No prueba afectación municipio por
municipio. Las observaciones Fundación ExE se conservan para diagnóstico:
fuera del ámbito se etiquetan «No atribuida al sismo» y dentro «Atribución al
sismo no verificada». No alimentan el ranking de recuperación.

## Integridad y tiempo

Se rechazan filas sin metadatos, valor finito no negativo, fecha ISO o identidad
válida. Los ceros numéricos permanecen. Copias idénticas se deduplican; valores
o metadatos contradictorios para la misma unidad/fuente/indicador/captura se
excluyen. La incidencia queda visible en Fuentes y método. No se elige el
primer dato contradictorio ni se suman duplicados.

Cada captura actual reemplaza la captura completa de esa fecha. Si una fuente
deja de aparecer tras una descarga, sus valores de una captura anterior no se
reintroducen como actuales. Las capturas de fechas anteriores se conservan.
El generador aislado no modifica archivos CSV; la actualización explícita del
historial usa reemplazo de archivo temporal.

Para evolución se usa la intersección de territorios con observación en
**todas** las capturas hasta la seleccionada, para una cohorte fija. Se muestran
mediana, n del panel y n observado en cada fecha. Un corte sin la fuente invalida
el panel. Con menos de dos capturas o sin intersección no se traza una tendencia.
Recuperación e IPM tienen sus propios paneles y denominadores visibles; no se
restan entre sí. Una variación entre capturas puede ser revisión de datos, no
recuperación efectiva del territorio.

## Validación implementada

Pruebas con datos sintéticos verifican exclusión de conflictos, cero frente a
ausencia, homónimos, no imputación entre fuentes, incompatibilidad de unidades,
invariancia del ranking respecto al IPM, empates, conservación de selección con
universo vacío, umbrales estables al buscar y filtrado departamental, y panel
temporal constante. Los tests no acreditan exactitud de los datos originales.

El flujo de actualización mantiene los cargadores existentes. Sus limitaciones
de red, metadatos y cobertura siguen siendo límites de la evidencia publicada.
