# ML de denominadores de salud
Fecha: 15 de septiembre de 2026. Experimento reproducible, sin modificar el tablero.

## Resultado ejecutivo

Sí se entrenaron y evaluaron los modelos. Se predice el denominador, no el índice ni los puntos afectados. Son predicciones exploratorias de capacidad histórica positiva registrada, no nuevas observaciones.

| Denominador | Modelo elegido | Municipios observados | MAE nacional | R² nacional | MAE <50.000 habitantes | R² <50.000 |
|---|---|---:|---:|---:|---:|---:|
| Consulta externa | Gradient boosting | 1106 | 34,78 | 0,233 | 4,33 | 0,538 |
| Urgencias | Poisson regularizado | 901 | 1,24 | 0,787 | 0,41 | 0,343 |
| Hospitalización general | Gradient boosting | 810 | 37,44 | 0,305 | 4,87 | 0,252 |

MAE es el error absoluto medio, en consultorios o camas, según la fila. La población usada para definir <50.000 es la proyección 2026. Hay 954, 750 y 659 municipios pequeños observados, respectivamente. Las filas tienen distintas muestras: comparar sus errores en unidades diferentes no demuestra superioridad de una fuente.

El R² mide capacidad predictiva respecto del registro observado, NO concordancia con UNGRD. No se usó UNGRD para entrenar ni elegir modelos. El R² nacional de consulta externa baja con boosting porque falla en grandes ciudades fuera de su rango; no se ocultó ese resultado.

El resultado de urgencias es prometedor para estimaciones condicionales. Consulta externa y camas todavía tienen errores considerables a escala pequeña. No se autoriza sustituir faltantes oficiales por estos números.

## Qué se predice y con qué datos

Un modelo por objetivo:

- Consulta externa: consultorios registrados de consulta externa.
- Urgencias: consultorios registrados de urgencias, NO número de IPS.
- Hospitalización: camas generales de adultos y pediátricas, NO todas las camas ni camas disponibles para ocupación.

Base nacional: 1.122 territorios con población utilizable. Observaciones positivas del denominador: 1.106 / 901 / 810. Faltantes: 16 / 221 / 312. Una fila por código municipal, no una por captura diaria, prestador o sede.

Predictores:

1. log(1 + población municipal proyectada para 2026).
2. IPM municipal 2018.
3. Las otras DOS capacidades de salud registradas en 2022: log(1 + capacidad) y una bandera de dato faltante para cada una.
4. Bandera de IPM faltante. La imputación de predictores usa medianas calculadas SOLO en entrenamiento.

El denominador que se intenta predecir está excluido de los predictores. No se encadenan predicciones: una capacidad estimada nunca sirve para estimar otra. Los vacíos de predictores de capacidad se codifican con un valor técnico y una bandera, no se afirman como ceros observados.

No se usaron daños, muertos, afectados, puntos PNUD/3iS, recuperación UNGRD ni el índice global como predictores. Tampoco se usó SGP en esta corrida.

### Limitación temporal y de cobertura

La capacidad es del **05-11-2022**, el IPM es de **2018** y la población es una proyección **2026**. Esta combinación permite un ensayo retrospectivo con covariables disponibles, pero NO es una validación de stock operativo 2026 ni una reconstrucción estrictamente contemporánea de 2022. Una puntuación buena no resuelve este desajuste.

La población proviene de un archivo DANE publicado en 2025; no se incorporaron consecuencias del sismo como predictores. Aun así, la etiqueta objetivo sigue siendo 2022.

No hay ceros explícitos entre las capacidades objetivo aceptadas. Por tanto, el aprendizaje está condicionado a tener capacidad positiva registrada. **No se aprendió la probabilidad de que exista el servicio en un municipio sin registro.** Un vacío podría corresponder a ausencia real, subregistro o diferente cobertura.

## Modelos y selección

Se compararon cinco alternativas por denominador:

- Mediana del stock observado dentro de cinco grupos de población definidos en entrenamiento.
- Regresión de Poisson con población e IPM.
- Regresión de Poisson con población, IPM y otras capacidades.
- Gradient boosting con población e IPM.
- Gradient boosting con población, IPM y otras capacidades.

Poisson: enlace logarítmico, regularización L2 de 1, sin penalizar el intercepto. Covariables estandarizadas con media/desviación del conjunto de entrenamiento. Optimización Newton con búsqueda de paso.

Boosting: 160 árboles, profundidad máxima 2, mínimo 20 ejemplos por hoja, tasa de aprendizaje 0,05, hasta 24 cortes por variable calculados en entrenamiento. Minimiza el error cuadrático de log(1 + capacidad); no es un boosting de devianza Poisson. No se hizo una búsqueda exhaustiva de hiperparámetros.

El primer ensayo seleccionó por MAE nacional y eligió Poisson en los tres objetivos. Sus MAE fueron 15,36 / 1,32 / 28,06; R² 0,943 / 0,786 / 0,520. Al examinar el caso de uso, se añadió selección por error proporcional, que es la versión final de este experimento. Ese cambio de criterio fue exploratorio: NO se presenta como una decisión preregistrada ni como confirmación en un conjunto externo intacto.

Criterio final:

```
error_log_municipio = abs(log(predicción_positiva) - log(capacidad_observada))
criterio = promedio(error_log_municipio)
```

Así, confundir 1 con 2 tiene el mismo error logarítmico que confundir 100 con 200. Como el cociente de daño es D/B, el error logarítmico de B coincide en magnitud con el del cociente, cuando D y B son positivos. Esto no garantiza preservar el ranking: la normalización por un máximo puede transmitir errores de un municipio a los demás.

En los cinco grupos externos se eligió el mismo modelo final para cada objetivo. La comparación completa, incluido Poisson, boosting y la mediana, está en [resultados.json](../experimentos/ml_salud/resultados.json).

## Cómo se validó

1. Se repartieron departamentos completos en cinco grupos equilibrados por número de municipios observados. Las asignaciones quedan guardadas.
2. Cada grupo externo se reservó para evaluación; no intervino en el ajuste ni en las medianas, escalas o cortes de los árboles.
3. Dentro de los otros cuatro grupos se usaron tres particiones internas, también por departamento, para escoger el modelo con menor error logarítmico.
4. Se ajustó el elegido sin los departamentos reservados y se predijo la capacidad conocida de estos.
5. Se juntaron las predicciones fuera de muestra. Cada municipio observado aparece una sola vez.
6. Para estimar faltantes se eligió el modelo usando validación agrupada sobre todos los observados y se volvió a ajustar con ellos.

Las otras capacidades observadas del municipio reservado sí pueden ser predictores: es precisamente la información que estaría disponible al faltar SOLO el objetivo. Nunca se incorpora su objetivo observado. No se entrenó con los municipios sin etiqueta.

Es validación geográfica exploratoria, no temporal. Reservar departamentos reduce dependencia geográfica, pero no garantiza independencia respecto de redes regionales ni que los vacíos tengan el mismo patrón que los casos observados. Falta validación externa con ceros y stock actual.

## Fórmulas

### Urgencias

```
b_estimado = max(1, exp(beta0 + Σ beta_j * z_j))
z_j = (x_j - media_entrenamiento_j) / desviación_entrenamiento_j
```

Para el modelo final entrenado con los 901 municipios:

```json
{
  "beta": [
    0.5383238614371386,
    0.3644662969390554,
    -0.04852661232191624,
    0,
    0.32918191812449993,
    0,
    0.37089071309670407,
    0.10988858248311605
  ],
  "feature_order": [
    "log1p(poblacion_2026)",
    "ipm_2018",
    "ipm_faltante",
    "log1p(consulta_externa_2022) o 0 técnico",
    "consulta_externa_faltante",
    "log1p(camas_generales_2022) o 0 técnico",
    "camas_generales_faltantes"
  ],
  "mean": [
    9.897540836624408,
    41.48446170921197,
    0,
    2.623953038468557,
    0,
    2.261320648129364,
    0.13873473917869034
  ],
  "sd": [
    1.1347673431950045,
    16.88580771475624,
    1,
    1.352344639781237,
    1,
    1.465899874101131,
    0.34566951170693727
  ]
}
```

Estos coeficientes son predictivos, no causales. Población, IPM y otras capacidades están correlacionadas; no se debe interpretar un coeficiente como el efecto de invertir dinero o construir una sede.

### Consulta externa y hospitalización

```
log_estimado = media_entrenamiento(log(1+B)) + 0,05 * Σ arbol_t(x)
b_estimado = max(1, exp(log_estimado) - 1)
```

Los 160 árboles, sus umbrales y hojas se guardan en resultados.json. No hay una sola recta equivalente a este modelo.

### Por qué el mínimo es 1

Se impone el soporte del ensayo: capacidad POSITIVA registrada. No es un pseudoconteo para permitir dividir por cero ni una afirmación de que los municipios sin registro tengan al menos una unidad.

En urgencias, 289 de las 901 predicciones de validación y 192 de las 221 predicciones brutas para faltantes quedan exactamente en ese piso. Esta restricción mejora la evaluación en los positivos conocidos, pero **no está validada para municipios cuya capacidad real pudiera ser cero**.

Ejemplo: el modelo final devuelve 1 consultorio de urgencias para Atrato, condicionado a que exista capacidad positiva. NO demuestra que Atrato tenga ese consultorio. No se incorporó como dato al tablero.

## Algunos valores observados y predichos

Estas son predicciones fuera de muestra: el departamento del municipio no estuvo en entrenamiento.

| Municipio | Denominador | Registro 2022 | Predicho |
|---|---|---:|---:|
| Atrato | Consulta externa | 2 | 4,07 |
| San José del Palmar | Consulta externa | 1 | 3,52 |
| Trujillo | Consulta externa | 8 | 9,69 |
| Pereira | Consulta externa | 1035 | 958,33 |
| Pereira | Urgencias | 42 | 46,07 |
| Trujillo | Urgencias | 1 | 1,56 |
| San José del Palmar | Urgencias | 1 | 1,00 |
| Pereira | Hospitalización general | 970 | 881,14 |
| Atrato | Hospitalización general | 10 | 4,74 |
| San José del Palmar | Hospitalización general | 5 | 4,34 |
| Trujillo | Hospitalización general | 7 | 6,97 |

Atrato ilustra la cautela: consulta externa se predice en 4,07 frente a 2 registrados; camas, 4,74 frente a 10. Si se usaran esas estimaciones en lugar de observados, cambiaría materialmente el cociente. Los datos observados se conservan siempre.

## Faltantes: estimaciones y abstenciones

Se guardaron predicciones en un archivo separado, sin habilitarlas para el índice.

| Denominador | Faltantes | Estimación exploratoria con soporte básico | Abstención |
|---|---:|---:|---:|
| Consulta externa | 16 | 7 | 9 |
| Urgencias | 221 | 203 | 18 |
| Hospitalización general | 312 | 298 | 14 |

El filtro de soporte exige IPM observado, predictores dentro del rango de entrenamiento y al menos 30 ejemplos con la misma combinación de presencia/ausencia de las otras capacidades. Es una regla prudente de publicación del ensayo, NO un umbral de precisión validado. No acredita existencia del servicio ni actualidad.

Se guarda una banda descriptiva obtenida del 80% central de errores logarítmicos fuera de muestra. No es un intervalo de confianza, no hay garantía de cobertura para faltantes y no incluye incertidumbre por posible cero real. Las predicciones sin soporte conservan el diagnóstico bruto en JSON, pero su estimación publicable en CSV está vacía.

## Qué haríamos con el denominador, después

```
presion_salud = puntos_afectados_PNUD / denominador_observado_o_estimado_validado
puntaje_salud = 100 * min(1, presion_salud / maximo_de_referencia)
```

No se ejecutó esta sustitución en producción. Antes se necesita resolver o marcar de forma explícita la existencia del servicio, adecuar el periodo y someter a prueba el efecto sobre el máximo y los puntajes.

Puntos afectados / consultorios o camas es un indicador de presión relativa, NO la fracción de sedes destruidas: numerador y denominador no cuentan el mismo objeto. El ML no elimina esa diferencia de unidades.

Usar IPM como predictor del denominador y mantener el ajuste IPM del índice introduce una influencia indirecta adicional de pobreza. No es fuga de la etiqueta, pero sí una decisión de metodología que hay que reconocer; la comparación sin otras capacidades y los coeficientes se dejan visibles.

## Archivos y reproducción

- [Entradas municipales](../experimentos/ml_salud/entrada.json): 1.122 registros, fuentes y fechas; sin contactos personales de prestadores.
- [Resultados, modelos y particiones](../experimentos/ml_salud/resultados.json).
- [Observado frente a predicho](../experimentos/ml_salud/validacion.csv): 2.817 predicciones fuera de muestra.
- [Faltantes y abstenciones](../experimentos/ml_salud/estimaciones_faltantes.csv): 549 casos municipio-denominador, NO 549 municipios distintos.
- [Código de modelos](../scripts/ml_salud.cjs).
- [Reproductor](../scripts/ejecutar_ml_salud.cjs).
- [Pruebas](../tests/ml_salud.test.cjs).
- [Registro de verificaciones](../experimentos/ml_salud/verificacion.json).

Desde la raíz, con Node.js:

```powershell
node --test tests/ml_salud.test.cjs
node scripts/ejecutar_ml_salud.cjs
```

El script sólo genera archivos del experimento. No lee ni modifica index.html, los denominadores del tablero, las otras ramas ni main.

La ejecución de esta entrega fue en JavaScript V8. Node/Python locales fallaron por un error de sandbox; no se afirma haber ejecutado scikit-learn. Se implementaron los algoritmos en JavaScript sin dependencias y se comprobaron con ejemplos analíticos, particiones, invariancia del objetivo y repetibilidad. No se ha contrastado numéricamente esta implementación con una biblioteca ML independiente.

## Fuentes

- [Registro REPS, capacidad instalada — Ministerio de Salud / datos.gov.co](https://www.datos.gov.co/Salud-y-Protecci-n-Social/Relaci-n-de-IPS-p-blicas-y-privadas-seg-n-el-nivel/s2ru-bqt6/about_data). Corte 05-11-2022; el extracto usado y su SHA256 están en entrada.json.
- [Extracto inmutable del registro](https://github.com/edgardhdz07/prueba-tecnica-datos-salud/blob/95f33af6ab50e09bef92bb7872eb7246b3c23529/data/Relaci%C3%B3n_de_IPS_p%C3%BAblicas_y_privadas_seg%C3%BAn_el_nivel_de_atenci%C3%B3n_y_capacidad_instalada_20260226.csv). No contiene verificación de funcionamiento en 2026.
- [Proyecciones municipales DANE](https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion).
- [IPM municipal censal DANE 2018](https://www.dane.gov.co/files/investigaciones/condiciones_vida/pobreza/2018/informacion-censal/anexo-censal-pobreza-municipal-2018.xlsx).
- [Documentación primaria: GLM y regresión Poisson](https://scikit-learn.org/stable/modules/linear_model.html#generalized-linear-models).
- [Documentación primaria: gradient boosting](https://scikit-learn.org/stable/modules/ensemble.html#gradient-boosting).
- [Validación agrupada](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupKFold.html). Referencia conceptual; la partición y los modelos ejecutados aquí son propios.
