# Corrección de importación 3iS — 9 de septiembre de 2026

- Colapsos de edificaciones corresponde a Infraestructura. Viviendas averiadas y destruidas permanecen en Vivienda. Se conserva el identificador 3is_colapsos.
- El diccionario de meses del importador tiene un nombre propio. El de presentación ya no lo reemplaza. El reporte 8 Sep 06:30 se ordena después de 30 Ago 18:30.
- Valores vacíos, no numéricos, no finitos o negativos se conservan como ausentes. Los ceros explícitos sí se conservan.
- La suma de campos en el índice ajustado requiere todos los campos presentes de una misma fuente. Un dato parcial no se transforma en un total; puede activar la siguiente fuente de la jerarquía existente.
- Si 3iS está habilitada y no puede descargarse, o devuelve un esquema o fechas inválidos, la ejecución falla y no publica una captura incompleta.
- La migración histórica cambia únicamente la dimensión y el nombre de colapsos; no reescribe cifras antiguas. Las capturas anteriores a esta corrección pueden conservar datos del 30 de agosto y ceros introducidos por el importador. Sus variaciones frente a nuevas capturas no deben interpretarse automáticamente como cambios reales de afectación.
- En la verificación pública del 9 de septiembre, Cali registra 515 colapsos en el reporte del 8 de septiembre a las 06:30; viviendas averiadas y destruidas están vacías.

## Automatización

El flujo programado vive en main y ejecuta una matriz sobre main, formato-largo y reestructuracion-recuperacion cada cuatro horas, al minuto 17 UTC. Cada trabajo descarga las fuentes y ejecuta los generadores de su propia rama. Los eventos push relevantes y workflow_dispatch actualizan la rama seleccionada. La exclusión mutua por rama evita publicaciones simultáneas del actualizador.

main integra las herramientas de formato-largo. reestructuracion-recuperacion conserva su tablero de recuperación, selección de fuentes y búsqueda. Las ramas 3is, economica, evolucion y claude/hola-2tl9nz fueron auditadas: no contienen el indicador 3is_colapsos ni esta importación y no se les añadió funcionalidad ajena.

## Efecto en índices y gráficos

El EDA y las fichas de 3iS sitúan colapsos en Infraestructura, también al leer el historial. El tablero de índices por dimensión traslada esa variable de Vivienda a Infraestructura: cambian los conjuntos de variables, denominadores, cobertura y puntajes de ambas dimensiones. El índice ajustado de seis dimensiones no sumaba colapsos a Vivienda, pero puede cambiar por el reporte actualizado y por conservar los faltantes. El índice original de puntos Naboo mantiene su metodología.

Fuente: https://docs.google.com/spreadsheets/d/1fQ-LTlIEljzOKvW23epwevJeWLWORi88xL7XxkpTMzY/edit
