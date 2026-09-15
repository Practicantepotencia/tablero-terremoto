# Revisión dirigida del ML de urgencias

Fecha: 2026-09-15. Alcance: auditoría y notebook; **sin cambios a index.html, denominadores ni main**.

## Dictamen

No se demostró mejora del error logarítmico de los dos modelos Poisson sobre «siempre 1» en los municipios observados pequeños sin registro de camas. La mediana de comparables empata. Esto no convierte la constante en un dato verificado ni demuestra ausencia o existencia de servicio en los municipios sin registro.

| Método | Menores de 10.000 sin registro de camas, N=69 | Sin registro de camas, N=125 | Nacional, N=901 |
|---|---:|---:|---:|
| Siempre 1 | 0,040182 | 0,095210 | 0,560421 |
| Mediana comparable | 0,040182 | 0,095210 | 0,286622 |
| Poisson demográfico | 0,058564 | 0,229081 | 0,332371 |
| Poisson con capacidades | 0,042423 | 0,119712 | 0,252658 |

Métrica: media de `abs(log(predicho)-log(observado))`. Menor es mejor. Todos los métodos se evalúan en los mismos casos. Las predicciones de Poisson tienen el mismo piso 1 que el modelo aplicado.

La población objetivo de esta revisión no se escogió por resultados de las etiquetas: se define por covariables conocidas. Sin embargo, el umbral y el protocolo se eligieron DESPUÉS de examinar el ensayo anterior. Toda la revisión es exploratoria, con datos reutilizados.

## Correspondencia con el uso

- Observados: 901; mediana poblacional 17.825; 776 con registro de camas.
- Faltantes: 221; mediana poblacional 4.926; 34 con registro de camas.
- Estimaciones aplicadas: 203; 173 sin registro de camas, de ellas 146 menores de 10.000 habitantes.
- Salidas aplicadas exactamente iguales a 1: 174. Las otras 29 superan 1.
- Grupo principal de evaluación: 69 observados, 11 departamentos; 65 tienen 1 consultorio y 4 tienen 2.

El grupo sin registro de camas no significa municipios sin camas. Los 815 observados con 1–5 consultorios son el 90% de los 901 observados, no del país ni de todos los faltantes.

## Diseño de la comparación

Mismos cinco grupos departamentales exteriores que el experimento original. En cada entrenamiento, tres particiones departamentales internas eligen entre los cuatro candidatos por error del grupo principal. Los candidatos se entrenan con todos los observados de ese entrenamiento, sin la etiqueta ni el departamento exterior reservado.

La mediana usa disponibilidad de camas y bandas de población fijas: <5.000, 5–10 mil, 10–20 mil, 20–50 mil, 50–100 mil, ≥100 mil. Si no hay comparables en entrenamiento, amplía a igual disponibilidad de camas; si tampoco hay, a todo el entrenamiento. No hay uso de objetivos desconocidos en la construcción del grupo.

La constante gana los cinco grupos internos; los tamaños principales exteriores son 2, 29, 24, 8 y 6. No se la recomienda por ello para grandes ciudades o para imputación oficial.

## Estabilidad y magnitud

En el grupo principal, la diferencia del Poisson con capacidades frente a 1 es +0,002241. La banda percentil descriptiva al remuestrear 11 departamentos 2.000 veces es [0; 0,004934]. Toda la diferencia está en Albán y Puerres, Nariño. Esto no prueba una inferioridad amplia del modelo: muestra que no añadió una mejora en este grupo.

En 125 observados sin registro de camas, la diferencia es +0,024501; banda descriptiva [0,000622; 0,064107], 16 departamentos. Son diferencias emparejadas sobre observados. No son intervalos de predicción ni garantías para faltantes y no se usan como prueba confirmatoria tras selección exploratoria.

Se conserva el R² nacional 0,786588, pero también se muestra el R² −0,503289 en los 815 casos con 1–5 consultorios. El acierto dentro de ±1 nacional es 78,58% del modelo frente a 77,47% de la constante. En grupos casi constantes, R² negativo puede coexistir con MAE bajo; ninguna métrica aislada sustituye la comparación pertinente.

## Sensibilidad conjunta

Se ejecutó el motor original de seis dimensiones en 18 escenarios: 9 combinaciones de bases hipotéticas de Atrato y Trujillo (1, 2 o 3), para decreto y todos. Cambian el máximo, Salud y los puntajes y puestos derivados; no cambia el resto de las dimensiones.

| Base Atrato | Base Trujillo | Máximo | Salud Atrato | Puesto global Atrato, decreto |
|---:|---:|---:|---:|---:|
| 1 | 1 | 16, Trujillo | 56,25 | 3 |
| 1 | 2 | 9, Atrato | 100 | 1 |
| 2 | 1 | 16, Trujillo | 28,125 | 8 |
| 2 | 2 | 8, Trujillo | 56,25 | 4 |
| 2 | 3 | 5,497269, Acandí | 81,858826 | 4 |

Con Atrato=1 y Trujillo=2 cambian Salud y el puntaje global de 159 municipios, y el puesto de 260 municipios del decreto. La cifra 2 es hipotética, no una corrección hallada de REPS. La aparición de Acandí ilustra por qué hay que recalcular el máximo completo.

## Qué se ejecutó y qué no

Comparación y sensibilidad ejecutadas en JavaScript V8. 32 verificaciones de datos y escenarios y cuatro cuerpos de pruebas Node en adaptadores de memoria. No se ejecutó Node nativo ni las nuevas celdas Python, por el bloqueo del entorno. La traducción Python incluye comprobaciones contra las salidas reales de JavaScript.

No se reentrenó para mejorar la correlación con UNGRD, no se buscaron hiperparámetros nuevos, no se imputaron daños ni se cambió la rama del tablero. Las cifras siguen condicionadas a capacidad positiva registrada en 2022; no hay validación de ceros reales ni de operación 2026.
