# Panorama territorial: revisión de interfaz

Rama local: `interfaz-publica-panorama`, basada en `POTENCIA2026/analisis-territorial-terremoto`, commit `0fe69704f8d97ff7ebddb5bc5afff13a6ec03fb3`.

## Cambios visibles

- Título «Panorama territorial» y pestaña «Índice».
- Un solo perfil municipal con selector entre afectación total, per cápita y relativa; la búsqueda se conserva al cambiar de medida.
- Dos resúmenes: alcance territorial y escala humana, en sustitución de los cuatro cuadros técnicos anteriores. Se retiró también el cuadro de municipios críticos, por petición posterior del usuario.
- Tabla con puntaje, resultado y evidencia por sector. La cifra municipal siempre corresponde al índice global, incluso al ordenar por una columna sectorial.
- Se conserva el orden de tres clics: mayor a menor, menor a mayor y orden inicial.
- Menos texto repetido: sin la unidad «Número», sin intervalos repetidos ni comparación con el puesto PNUD en cada fila. Fichas y fuentes mantienen los datos técnicos.
- Los tres radares, comparación con PNUD, diagnóstico territorial y fuentes/método permanecen disponibles.
- Paleta contenida, menos sombras y contenedores; adaptación a pantalla estrecha.

## Qué no cambió

No se modificaron los archivos de datos, denominadores, selección de fuentes, pesos, IPM, reglas para ceros/faltantes, normalización o límites del modelo. Se regeneró `index.html` con los mismos datos. La prueba de navegador compara la carga de datos con la versión base, excluyendo solamente la marca temporal de generación, y verifica que los cinco módulos de cálculo son idénticos.

El puntaje público es el límite inferior ya calculado por el modelo. Los límites por faltantes continúan en las fichas; no se sustituyeron por una estimación puntual nueva. Un sector sin evidencia puntuable muestra «Sin dato», no cero. Un conteo conocido sin denominador permanece visible como «Reportado» aunque no tenga tasa.

## Comparación municipal y radares

- En los tres radares, el resumen separa el puntaje documentado, el límite con información faltante y la cobertura. Los puntajes del resumen se presentan con un decimal sin cambiar los valores calculados.
- Una matriz coloca **cada indicador en una fila y los municipios en columnas**. Por ejemplo, los desaparecidos de Pereira, Cali y Atrato se leen en la misma fila. Los campos se emparejan por identificador, no por posición ni por la fuente elegida en la cascada.
- La matriz incluye el puntaje de cada dimensión, los valores de sus indicadores y, en las variantes relativas, la unidad de la tasa y el conteo original. Las familias siguen visibles como información, sin intervenir en el cálculo. Un dato ausente nunca se muestra como cero.
- Al pasar por un punto del radar se actualiza un resumen breve. El botón «Cómo se calcula» y los puntajes de dimensión abren una ventana modal con el desarrollo completo que antes ocupaba permanentemente el panel derecho. Se cierra con «Cerrar», Escape o un clic fuera, y devuelve el foco al control de origen.
- Un único bloque «Municipios a comparar», antes de las tres gráficas, controla total, per cápita y relativo. Buscar, seleccionar, quitar o evitar duplicados actualiza los tres radares y sus matrices. Los filtros generales depuran la misma selección; un denominador ausente no sustituye el municipio en una de las vistas.
- Cada radar conserva su punto inspeccionado y sus fórmulas. Geometría, líneas de faltantes y modelos de cálculo no cambian. No se añaden clasificaciones de gravedad ni un segundo cálculo del índice.

## Lectura de los coeficientes

Las tarjetas de comparación con PNUD presentan primero su interpretación y luego el método:

- «Qué tan bien se ajustan los índices — R²»: el mismo coeficiente, presentado como porcentaje con hasta dos decimales. Es el ajuste lineal entre los puntajes observados, no un porcentaje de aciertos de pronóstico. La precisión completa permanece en el cálculo y en el detalle de la recta.
- «Cómo se relacionan los puntajes — Pearson r»: conserva valor y signo; positivo indica que tienden a subir juntos, negativo que se mueven en sentido opuesto.
- «Qué tanto coincide el orden — Spearman ρ»: conserva la correlación de rangos con tratamiento de empates. Los extremos corresponden al mismo orden o al inverso.

No cambian los pares incluidos, el ajuste, las correlaciones ni los puntajes. Los coeficientes no definidos siguen mostrando «—», no cero.

## Definiciones de los nuevos resúmenes

1. **Alcance territorial.** Municipios del ámbito con al menos un conteo positivo de daño o impacto humano en 3iS/PNUD, o una categoría positiva de afectación en Naboo/UNGRD. No basta con tener población, IPM, costos o datos educativos ajenos a la atribución del sismo. Se cuenta cada municipio una sola vez.
2. **Escala humana.** Suma de las proyecciones municipales DANE del año seleccionado, en los municipios anteriores. No equivale a personas damnificadas. La línea secundaria suma población en los primeros 20 puestos dentro de los filtros territoriales, incluidos empates, según la medida seleccionada. Es una descripción del ranking, no una nueva definición oficial de territorio prioritario. Las sumas incompletas llevan asterisco; su cobertura está en «Cómo se cuentan estos datos».

Los resúmenes responden al ámbito, departamento y fecha; la búsqueda y el orden de columnas no cambian sus universos.

## Decisiones de presentación

- No se añadieron bandas nuevas «alta/media/baja» al índice: exigirían umbrales metodológicos distintos de un cambio estético. Se usa «Puntaje de afectación».
- La etiqueta «Fecha de reporte» solicitada conserva una aclaración: es la fecha de incorporación/captura del tablero, no una fecha original del hecho acreditada.
- «100» se explica una vez como escala del índice, no como 100 % de pérdidas. La regla particular de educación relativa sigue en la ficha.
- Las cuatro tarjetas técnicas se reemplazaron por los resúmenes anotados en la imagen; después se retiró el de severidad. No se borraron las pestañas de navegación ni sus análisis.

## Verificación

Desde la raíz del repositorio:

```powershell
python generar_tablero_recuperacion.py --eda-redirect ""
node --test tests/*.test.js
python -m unittest discover -s tests -q
node tests/panorama.browser.cjs
node tests/radar_publico.browser.cjs
node tests/familias_informativas.browser.cjs
```

Las pruebas de navegador requieren Playwright. Se puede indicar una instalación local de Chrome con `CHROME_PATH` (o `BROWSER_PATH` para los ensayos históricos). Las capturas de revisión y el informe de la prueba nueva se generan en `tmp/panorama-qa/`; no son datos del modelo ni parte de la publicación.

La prueba de conservación de datos se refiere al commit base indicado arriba; `BASELINE_REF` permite especificar otra referencia cuando se revise una actualización posterior. Los cinco módulos de cálculo se comparan byte a byte; `radar.js` contiene presentación y se permite modificar, mientras la prueba del radar contrasta las celdas de las tres variantes con los objetos calculados. Las pruebas de navegación existentes se adaptaron al selector y al buscador compartido. En la prueba histórica del radar se retiraron dos expectativas obsoletas: heridos dentro del impacto humano y ausencia de salud relativa. Se verifica la configuración ya vigente en `main`, sin cambiarla.

La primera revisión de interfaz se publicó en `Practicantepotencia/tablero-terremoto/main` el 22 de septiembre de 2026. La copia de ramas a POTENCIA2026 y la comprobación de la conexión de Netlify quedan pendientes por separado.
