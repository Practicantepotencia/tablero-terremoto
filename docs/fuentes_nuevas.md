# Fuentes verificables incorporadas

Rama `fuentes-nuevas`, derivada de `reestructuracion-recuperacion`.
Los números proceden de tablas publicadas: no se creó una encuesta, un Excel
de observaciones manuales ni una estimación en lenguaje natural.

## Contenido de esta versión

| Proveedor y original | Periodo | Cobertura importada | Uso |
| --- | --- | --- | --- |
| [DANE: IPM de fuente censal](https://www.dane.gov.co/index.php/estadisticas-por-tema/pobreza-y-condiciones-de-vida/pobreza-y-desigualdad/medida-de-pobreza-multidimensional-de-fuente-censal) | 2018 | 1.122 territorios, 18 indicadores, 20.176 valores | IPM total, cabeceras, rural y 15 privaciones: línea base, no daños |
| [MEN: estadísticas educativas municipales](https://www.datos.gov.co/d/nudc-7mev) | 2024 | 1.122 territorios, 12 indicadores, 13.464 valores | Población escolar, matrícula, cobertura, deserción y repitencia: línea base |
| [OPS/OMS: informe de situación 7](https://www.paho.org/es/documentos/informe-situacion-7-colombia-terremoto-agosto-2026-4-septiembre-2026) | 4 septiembre 2026 | 16 departamentos, 7 indicadores, 68 valores | Afectación territorial, personas, rescates y centros de salud |
| [OIM: mapeo de alojamientos colectivos](https://reliefweb.int/report/colombia/oim-tablero-mapeo-de-alojamientos-colectivos) | Publicación del 19 agosto 2026; consulta viva con su propio corte | Visor original y documento de publicación | Consulta externa; ninguna cifra municipal transcrita de su portada |

Son **33.708 observaciones nuevas**, no 33.708 municipios. Se preservan las
unidades del proveedor. Cada valor tiene fuente, periodo, código territorial
y localizador (hoja/celda, registro/campo API o página/tabla PDF).

## Lectura y límites

- DANE es censal municipal, no una actualización municipal anual. Su geografía
  de 2018 incluye áreas no municipalizadas. El IPM censal no reemplaza al IPM
  contenido en RAPIDA ni se añade al índice de recuperación temprana.
- MEN: la API ya expresa tasas en puntos porcentuales; no se multiplica por
  100. Algunos valores de cobertura superan 100 y se conservan. El creador del
  conjunto en el catálogo es Ministerio de Educación Nacional, pero el campo
  `attribution` del portal dice Alcaldía de Pitalito: ambos metadatos se archivan
  y la discrepancia se muestra. Se importa el último año publicado común, no
  un año diferente para cada municipio.
- OPS reproduce datos UNGRD: no se suma a 3iS ni cuenta como corroboración
  independiente. La tabla 1 reporta 122 desaparecidos: los departamentos
  suman 121; la nota del documento explica uno sin departamento identificado.
  La tabla 2 suma 400 centros de salud, pero su encabezado dice 4 de septiembre
  y el pie cita UNGRD del 1 de septiembre. La advertencia acompaña cada valor.
- Un guion del PDF se conserva como ausencia de observación, nunca como cero.
  Los ceros explícitos sí se importan. No se reparten totales departamentales
  entre municipios. No se infieren daños a partir de pobreza o cobertura escolar.
- OIM se abre a petición del usuario. El visor requiere internet y conserva
  sus propios filtros y actualización; los filtros locales no controlan ese
  Power BI. El PDF archivado solo contiene una portada: no permite un cruce
  municipal auditable y por eso no se extraen observaciones de él.

## Integración

`index.html` conserva las tres pestañas. Los accesos DANE, MEN y OPS llevan a
Diagnóstico; están también en el selector de fuentes de la matriz territorial.
OIM se consulta en Fuentes y método. Los datos tabulares están incrustados en
el HTML y pueden consultarse sin conexión; los enlaces originales y OIM no.

No cambia la fórmula del ranking: valor original de recuperación RAPIDA,
sin sumar nuevas fuentes, IPM ni premios por cobertura. Los percentiles se
calculan por fuente + indicador + unidad + nivel + selección geográfica:
`100 × (n menores + 0,5 × n iguales) / n con dato`. No indican daño absoluto;
por ejemplo, más cobertura educativa no significa más necesidad.

Se cruza por DIVIPOLA. Solo se completan códigos faltantes mediante nombres
exactos normalizados de departamento **y** municipio, con un único código en
la referencia. No se hacen emparejamientos aproximados ni solo por municipio.
Las etiquetas de agrupación facilitan la lectura; los valores y nombres de
las privaciones DANE se conservan como están publicados.

Las nuevas tablas se consultan con la captura más reciente del inventario,
mostrando su periodo publicado por separado. No se proyectan retrospectivamente
en capturas viejas ni se fabrica evolución con descargas idénticas. El historial
de capturas previo no se sobrescribe con estas líneas base.

## Reproducción y actualización

```sh
python -m pip install -r requirements_fuentes_nuevas.txt
python actualizar_fuentes_nuevas.py
python generar_tablero_recuperacion.py
```

Para reproducir desde las copias originales guardadas, sin red:

```sh
python actualizar_fuentes_nuevas.py --offline
python generar_tablero_recuperacion.py
python -m unittest discover -s tests -v
node --test tests/modelo.test.js
```

`data/fuentes_nuevas/originales/` conserva los archivos descargados sin editar.
`data/fuentes_nuevas/datos.json` contiene los registros convertidos, URLs,
fecha real de descarga, tamaños, hashes SHA-256 y conciliaciones de OPS.
Si cambia la estructura o hay duplicados, el importador falla: no inventa un
reemplazo. Los lectores necesarios están fijados en `requirements_fuentes_nuevas.txt`.

El actualizador obtiene el último año disponible del MEN. DANE se mantiene
en el anexo censal identificado; OPS está fijado al informe 7 verificado.
No se afirma que esos dos documentos sean feeds que descubren publicaciones
nuevas automáticamente. Un informe OPS posterior debe auditarse y versionarse.

GitHub Actions instala los lectores, descarga, valida y regenera al recibir
un cambio relevante o al ejecutar manualmente el flujo sobre esta rama. El
horario de GitHub corre desde la rama predeterminada: **no queda programada
una actualización periódica de esta nueva rama por el solo hecho de crearla**.
No se cambia main, la rama de recuperación ni la configuración de GitHub Pages.

## Fuentes descartadas en esta búsqueda

El conjunto UNGRD `wwkg-r6te` encontrado en datos.gov.co contiene emergencias
de 2019–2022: no se usa como reporte del terremoto de 2026. Se evitó presentar
resultados de buscador, agregadores sin tabla original o cifras de una portada
como si fueran datos municipales nuevos.
