# ¿Comunitario incluye colegios u hospitales?

Revisión del 9 de septiembre de 2026. No se ha acreditado exclusividad entre
categorías; tampoco se ha demostrado un duplicado concreto con los agregados.

## Evidencia consultada

- [PNUD: tablero original y nota metodológica integrada](https://pnudco.github.io/Respuesta-a-crisis-y-recuperaci-n-temprana/):
  presenta salud, educación y equipamiento comunitario como tres categorías.
  Su código conserva `csalud`, `cedu` y `ccom` por separado y suma sus conteos
  para mostrar centros de infraestructura. Cita un registro EDAN del 27 de agosto
  de 2026. Su metodología diferencia costos por tipología y advierte que no es
  un levantamiento individual de cada centro. Esto evidencia una intención de
  separación, no prueba que los establecimientos originales sean disjuntos.
- [3iS: hoja Datos_territoriales](https://docs.google.com/spreadsheets/d/1fQ-LTlIEljzOKvW23epwevJeWLWORi88xL7XxkpTMzY/edit):
  la respuesta GViz tipada contiene columnas distintas `Salud`, `Educativos` y
  `Comunitarios`. Es un agregado territorial por reporte: estas columnas no
  contienen nombre ni identificador de cada establecimiento. La hoja consultada
  no proporciona una regla explícita de exclusión entre esos tres conteos.
- El servicio original ArcGIS RAPIDA no pudo verificarse en esta revisión por
  un error de certificado TLS. No se extrapola a RAPIDA la conclusión de PNUD.

No basta que una institución se llame «colegio comunitario» u «hospital
comunitario» para asignarla al campo comunitario: su función y la regla de
clasificación del registro son las que deben determinarlo. Aquí no tenemos
evidencia suficiente para saber cómo se clasificó cada establecimiento.

## Implicación en nuestro modelo

El modelo 1.1 promedia puntajes normalizados, no suma edificios únicos. Sin
embargo, si un mismo daño figura en salud y comunidad, influye en dos sectores:
habría doble ponderación aunque no se sumen cantidades brutas. Cada sector
pesa 1/6; dentro de comunidad, 3iS y PNUD pesan 1/2 cada uno. Además, dos fuentes
pueden reutilizar el mismo reporte y no constituyen evidencias independientes.

No se cambiaron pesos ni se restaron agregados a ciegas en esta corrección del
buscador. No es válido calcular comunitario menos salud menos educación: no
sabemos si son subconjuntos, si comparten corte ni si cada cifra cuenta el mismo
tipo de unidad. La interfaz advierte esta limitación.

Para resolverlo hacen falta el diccionario del EDAN/3iS y el listado por activo:
identificador, nombre, ubicación, uso principal, usos secundarios, fuente y
fecha. El cruce permitiría detectar coincidencias y asignar un uso principal o
repartir explícitamente el peso de edificios multiuso. Hasta entonces no debe
afirmarse que este componente es independiente ni que el total de categorías
representa edificios distintos. Una variante sin comunidad sería un análisis
de sensibilidad, no evidencia de que todos los comunitarios estén duplicados.
