# Investigación: 3iS -- ¿cambiar o complementar la fuente principal?

**Estado:** integrada como inventario crudo (`fuente=3iS-Sheets`), no
reemplaza `registro.json`. Este doc resume la exploración original que
vive completa en la rama `3is` (nunca fusionada a `formato-largo`) más el
resultado final de la integración.

**Objetivo original:** evaluar si convenía reemplazar (o complementar)
`registro.json` de mapadelterremoto.com como fuente principal del índice,
con datos del dashboard de 3iS:
`3is.org/emergenciaslatam/terremoto_choco/`.

## Qué es realmente 3iS: un panel que agrega otras fuentes, no una fuente propia

El sitio no genera datos propios -- es una capa de presentación que
embebe/consume varias fuentes externas: Copernicus EMS (activación
EMSR916, evaluación satelital de daño estructural), USGS (sismo +
réplicas + ShakeMap), **4 hojas de Google Sheets públicas** (exportables
como CSV sin autenticación, mismo patrón `gviz/tq?tqx=out:csv` para las
4: `Datos_Territoriales`, `Tendencias`, `Bitacora_Noticias`,
`Necesidades`), un ArcGIS Dashboard embebido, otro del Ministerio de
Educación, y 2 reportes de Power BI.

**Conclusión de esa fase:** no tiene sentido "reemplazar" `registro.json`
por 3iS entero -- tiene más sentido extraer piezas específicas como
indicadores crudos adicionales, cada una con su propia fila `fuente=...`,
sin sustituir la fuente principal. Se priorizó `Datos_Territoriales` por
ser, con diferencia, la más valiosa: cifras oficiales consolidadas
(fallecidos, heridos, viviendas, salud, educación, vías...) por
departamento y por corte de tiempo, algo que `registro.json` no tiene en
absoluto (ahí solo hay *puntos* reportados, no totales oficiales).

Las otras 3 hojas (`Tendencias`, `Bitacora_Noticias`, `Necesidades`) y
Copernicus EMS quedaron identificadas pero **no integradas** -- ver "Qué
falta" abajo.

## Cómo se accedió

Mismo patrón que el resto de fuentes bloqueadas para el sandbox: `3is.org`
está bloqueado por la política de red del entorno de esta sesión de
Claude, pero **no** el Sheets público en sí (`docs.google.com`) ni el
script en producción (GitHub Actions tiene salida completa). Se confirmó
con un paso de diagnóstico temporal en el workflow, revertido después de
leer el log.

## Esquema real de `Datos_Territoriales`

Columnas: `Reporte, Nivel, Departamento, Municipio, Lat, Lon, Fallecidos,
Heridos, Desaparecidos, Rescatados, Familias, VivAveriadas,
VivDestruidas, Colapsos, Salud, Educativos, Comunitarios, Vias,
Aeropuertos, Acueductos, MunicipiosAfectados, DeptsAfectados,
PersonasAfectadas`.

Una fila por corte de tiempo (`Reporte`, ej. "3 Sep 06:30") x nivel
(`Nacional` / `Departamento` / **`Municipio`**). El nivel `Municipio` no
se documentó en la exploración inicial (que solo mencionaba
`Nacional`/`Departamento`) -- se confirmó después, al implementar el
loader, que la hoja también trae filas municipales con las mismas
columnas.

## Qué se integró: `load_3is_datos_territoriales()`

Descarga en vivo, cada corrida, la exportación pública del Sheets
(`gviz/tq?tqx=out:csv&sheet=Datos_Territoriales`, spreadsheet ID
`1fQ-LTlIEljzOKvW23epwevJeWLWORi88xL7XxkpTMzY`), sin API key. Extrae 14
campos (`CAMPOS_3IS_DATOS_TERRITORIALES`): Fallecidos, Heridos,
Desaparecidos, Rescatados, Familias, VivAveriadas, VivDestruidas,
Colapsos, Salud, Educativos, Comunitarios, Vias, Aeropuertos, Acueductos.

**Bug encontrado y corregido durante la integración:** la primera versión
del loader filtraba solo `Nivel=="Departamento"`, descartando ~2.484
filas municipales reales de la misma hoja. Se corrigió calculando el
corte más reciente **por separado para cada nivel** (departamental y
municipal no siempre comparten el mismo `Reporte` más reciente en la hoja
fuente) -- verificado en producción: pasó de 1.461 a 3.211 filas totales
tras el fix (125 municipios x 14 campos = 1.750 filas nuevas, coincidencia
exacta con lo esperado).

Solo inventario crudo (`fuente=3iS-Sheets`, `nivel=departamental` o
`nivel=municipal`), no se usa para recalcular el índice todavía.

## Qué falta

- **Copernicus EMS** (`dl_copernicus_buildings.csv`, evaluación satelital
  de daño estructural -- `aoi, aoi_name, lon, lat, grade` con grade
  Destroyed/Damaged/Possibly damaged) -- identificado como el dato más
  objetivo posible (no depende de reportes ciudadanos), pero no se
  confirmó si cubre el área del epicentro (las primeras filas vistas eran
  Cali y Pereira, no Chocó) ni se integró.
- **`Tendencias`** -- subconjunto de columnas de `Datos_Territoriales`
  pero llega a nivel municipal con series de tiempo (Fallecidos,
  Desaparecidos, Heridos, Rescatados, VivAveriadas, VivDestruidas) --
  redundante con lo ya integrado, salvo por la serie temporal completa
  (hoy solo tomamos el corte más reciente).
- **`Bitacora_Noticias`** -- log editorial (`Categoria`, `Titulo`,
  `Detalle`, `Enlace`), no es dato estructurado numérico -- útil como
  contexto/bitácora, no como indicador.
- **`Necesidades`** -- formato pivoteado/transpuesto (IDs tipo `NEC-191`
  como encabezados de columna), estilo tracking humanitario ONU/OCHA
  (clusters: WASH, Salud, Protección, Alojamientos, Educación en
  Emergencias, Recuperación Temprana...) -- no se releyó con cuidado para
  saber si es aprovechable tal cual o si hay que transponerla primero.
