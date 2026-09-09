# Matriz relativa a la población

Esta vista se sitúa debajo de la matriz absoluta y antes de «Cómo leer la prioridad
y sus límites». Compara afectación por habitante. Las dos matrices tienen búsquedas
y ordenación independientes y comparten universo territorial, departamento y captura.
Los encabezados alternan mayor a menor, menor a mayor y orden global normal.

## Denominador verificable

Se usa exclusivamente población total municipal proyectada para **2026**, DANE,
[serie municipal por área 2018–2042](https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx).
La [página oficial](https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion)
indica publicación del 8 de agosto de 2025; la introducción del libro indica
actualización del 30 de julio de 2025.

`preparar_poblacion_relativa.py` extrae filas con año 2026 y área `Total` de
`PobMunicipalxÁrea`. No suma total, cabecera y rural. Guarda URL, año, fecha de
descarga, SHA256 del XLSX y referencia de fila en `data/poblacion_relativa.json`.
Los 1.122 registros positivos son una referencia demográfica; no se añaden como
municipios afectados. Una fila sin población positiva queda en `excluded`.

Se vincula por DIVIPOLA validado del inventario. Se rechazan denominadores
ausentes, no positivos, duplicados o de otro año. No se usan población expuesta,
damnificados ni población departamental como sustitutos. Para capturas de otro año
hace falta incorporar una proyección correspondiente; no se reutiliza 2026 en silencio.

En la captura del 9 de septiembre de 2026 y ámbito del decreto hay 509 identidades:
498 con población vinculada y 468 con algún campo puntuable relativo. Once no
tienen código homologado que permita el cruce; esto no demuestra ausencia de
población en la fuente. Permanecen visibles sin puntaje relativo. El absoluto
mantiene sus 470 municipios con componentes.

## Fórmula

Para cada municipio m e indicador j:

```
t_mj = 10.000 × x_mj / población_m
a_j = máximo(t_mj) entre municipios con numerador comparable y población válida
z_mj = 100 × t_mj / a_j
S_md = suma_j (peso interno_dj × z_mj)
D_m = promedio de los seis S_md
P_m = D_m × (1 + 0,25 × IPM_DANE_2018 / 100) / 1,25
```

Cada indicador conserva su fuente, unidad, definición y captura. Sus máximos
relativos son independientes de los máximos absolutos. El factor 10.000 mejora
la lectura de la tasa y se cancela en la normalización; no cambia los puntajes.
Se mantienen 17 campos y los pesos de la versión 1.2. Esto no equivale a dividir
el índice global absoluto por población. Buscar u ordenar no cambia la referencia;
cambiar el ámbito o la captura sí. El filtro departamental solo cambia la vista.

Un cero explícito con denominador válido puntúa cero; una tasa no calculable
queda desconocida. Los faltantes mantienen su peso y propagan límites 0–100 en
su puntaje. Un municipio sin ningún campo relativo no recibe puesto. La ficha
municipal muestra numerador, población, tasa, máximo, N, pesos y resultados.

## Interpretación por dimensión

| Variable o dimensión | Qué permite leer la tasa | Denominador necesario para otra interpretación |
| --- | --- | --- |
| Fallecidos, desaparecidos y heridos | Personas registradas por 10.000 residentes | Población expuesta, si se quisiera medir afectación dentro de la zona expuesta y existiera una delimitación compatible |
| Familias afectadas | Familias reportadas por 10.000 habitantes | Hogares/familias del municipio, para una proporción de hogares afectados; familia y hogar también requieren homologación |
| Vivienda | Unidades afectadas por 10.000 habitantes | Total de viviendas comparables, para fracción del parque habitacional perdida |
| Educación | Establecimientos afectados por 10.000 habitantes | Sedes existentes o matrícula/cupos afectados sobre matrícula/cupos totales; un colegio pequeño no equivale a uno grande |
| Salud | Centros afectados por 10.000 habitantes | Establecimientos, camas, capacidad o población usuaria; un hospital regional atiende otros municipios |
| Infraestructura y acceso | Colapsos, acueductos y vías reportados por 10.000 habitantes | Edificios existentes, conexiones/usuarios sin servicio y longitud/capacidad vial; contar acueductos no mide hogares sin agua |
| Servicios comunitarios | Centros reportados por 10.000 habitantes | Equipamientos existentes, capacidad o usuarios; sigue pendiente descartar solapamiento con salud y educación |

Los índices de establecimientos por habitante son indicadores exploratorios de
concentración del daño, no porcentajes de capacidad perdida. Los conteos siguen
siendo esenciales para dimensionar recursos. La población proyectada de 2026,
publicada antes del evento, no refleja desplazamientos posteriores ni cambios de
usuarios entre municipios. Tampoco garantiza que los heridos sean residentes.

Los municipios pequeños pueden mostrar tasas altas con pocos casos. La escala
máximo=100 es sensible a tasas extremas o errores y a la cobertura del inventario.
No se aplican suavizados, umbrales ni pesos nuevos sin explicarlos. Los faltantes
y la reutilización de reportes entre PNUD y 3iS siguen afectando ambas vistas.

## Ejemplo y resultado de esta captura

Pereira: proyección 2026 de 487.820 habitantes; 259 heridos reportados dan
`259 × 10.000 / 487.820 = 5,3093` heridos por 10.000 habitantes. Luego se compara
esa tasa con el máximo del indicador, no con el máximo de heridos absolutos.

En el ámbito del decreto, el orden relativo documentado empieza por Atrato,
Sipí y Argelia (Valle del Cauca). Pereira pasa del puesto absoluto 1 al relativo 35.
Estos puestos responden a preguntas distintas: volumen total y concentración por
habitante. No constituyen una validación de mayor necesidad neta en terreno.

## Reproducir

```
python preparar_poblacion_relativa.py --year 2026  # requiere openpyxl y conexión
python generar_tablero_recuperacion.py            # JSON local, sin red
node --test tests/relativo.test.js
```
