# Tres lecturas y comparación con necesidad de recuperación temprana

Disponible en `priorizacion-integrada` y `denominadores-sectoriales`, en `index.html`.

## Vistas conservadas

1. Prioridades: matrices absoluta, per cápita y relativa sectorial; búsqueda y orden de columnas independientes, con fichas y fórmulas.
2. Comparar municipios: tres radares en ese mismo orden; selectores, búsqueda y cálculo al enfocar o tocar cada punto.
3. Necesidad de recuperación temprana: KPIs, ranking original, dispersión necesidad de recuperación temprana–IPM y municipios sin evaluación de la vista de `reestructuracion-recuperacion`. Sin matriz de necesidades duplicada ni seguimiento. Nueva dispersión frente a nuestras tres versiones.
4. Diagnóstico territorial.
5. Fuentes y método.

Las tres versiones usan el mismo modelo sectorial 1.2, pesos, IPM y propagación de faltantes. Solo cambia la entrada antes de normalizar:

| Versión | Entrada del indicador |
| --- | --- |
| Absoluta | Conteo original |
| Per cápita | Conteo × 10.000 / población DANE del año de captura |
| Relativa sectorial | Conteo × factor / base propia homologada |

La per cápita restaura la comparación poblacional, no reemplaza ni relaja las reglas de las bases sectoriales. La relativa sigue siendo parcial: solo personas y vivienda tienen bases habilitadas. No se usa población para rellenar inventarios ausentes de sedes, infraestructura o comunidad. Ver [reglas por indicador](denominadores_sectoriales.md).

## Comparación

X es P documentado (límite inferior, 0–100), exactamente el de cada matriz y radar. Y es el puntaje original de necesidad de recuperación temprana (fuente UNDP/PNUD RAPIDA), sin convertirlo en puesto ni reescalarlo a 100. El eje aumenta hacia arriba.

- La interfaz solo ofrece «Nuestro índice» (Absoluto, Per cápita, Relativo) y «Resaltar municipio». El universo, departamento y captura se seleccionan en los filtros generales.
- Se incluyen todos los pares disponibles de la versión elegida dentro de esos filtros. No se exige que el municipio tenga puntaje en las otras versiones. N puede cambiar al cambiar de versión; se muestra junto al gráfico. Las exclusiones mutuamente excluyentes y los límites metodológicos están dentro del desplegable de método, sin aviso amarillo.
- Las anclas y puestos se calculan antes de restringir al panel pareado. Universo y captura los recalculan; departamento restringe los pares y recalcula la asociación sin renormalizar índices.
- La búsqueda resalta puntos, no modifica la muestra ni los estadísticos.
- Los ceros explícitos válidos se incluyen. No se imputan observaciones, denominadores ni puntuaciones totalmente ausentes. No se usa el límite superior en la regresión.

Se calcula una regresión lineal con intercepto Y = a + bX. Pearson r conserva dirección; R² = r² mide el ajuste lineal descriptivo. Con puntajes, **r positivo** indica que valores altos de ambos índices tienden a presentarse juntos. Spearman usa rangos promedio para empates dentro de los pares. Los puestos visibles son de competencia (1, 2, 2, 4); no confundirlos con los rangos promedio usados en Spearman.

No se muestra ajuste ni correlación con menos de tres pares o varianza nula. Se publican pendiente, intercepto, N, cobertura municipal y tabla de pares. El R² no estima causalidad, probabilidad, significación ni exactitud. PNUD, RAPIDA y 3iS pueden compartir insumos; no es validación independiente. El ranking conservador y la escasez de campos relativos afectan la asociación.

En el ranking original de la pestaña «Necesidad de recuperación temprana» se conserva la lógica de `reestructuracion-recuperacion`: puestos dentro del departamento visible. En la dispersión y las matrices se conservan los puestos del ámbito de referencia; ambos alcances están rotulados.

## Reproducción

`python generar_tablero_recuperacion.py` produce el HTML autónomo desde las observaciones y bases de cada rama. La comparación no consulta servicios externos al abrirlo.

Pruebas de cálculos: `node --test tests/modelo.test.js tests/priorizacion.test.js tests/relativo.test.js tests/unificado.test.js`. La prueba `tests/unificado.browser.cjs` comprueba las tres vistas, independencia de controles, estadísticos, teclado y diseño móvil en el HTML generado.
