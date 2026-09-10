# Tablero territorial de recuperación temprana

## Ramas priorizacion-integrada y denominadores-sectoriales

Abre **index.html**. La matriz «Qué necesita cada municipio» es la vista
principal: búsqueda de municipios, puntaje sectorial y rango por faltantes.
Cada encabezado alterna orden descendente, ascendente y orden global normal.
Inmediatamente debajo aparece una segunda matriz por cada 10.000 habitantes,
con población municipal DANE 2026, conteos originales y cálculo verificable.
La tercera matriz usa bases propias verificadas por indicador y conserva los vacíos
sin homologación. Las tres tienen búsqueda y orden independientes.
En «Comparar municipios» aparecen los tres radares en el mismo orden.

«Necesidad de recuperación temprana», antes de «Diagnóstico territorial» y «Fuentes y método»,
conserva el ranking original y Necesidad de recuperación temprana e IPM. Incluye la nueva dispersión
entre nuestro índice (selector absoluto / per cápita / relativo) y el puesto de
necesidad de recuperación temprana, con Pearson, Spearman, R² y cobertura.
Solo hay dos controles locales: versión del índice y resaltar municipio. Los pares
se seleccionan mediante los filtros territoriales generales.
[Guía y método de la integración](docs/tablero_unificado.md).

El modelo combina 17 campos en seis sectores con peso igual y aplica un ajuste
por IPM censal DANE 2018. Usa pesos fijos, separa canales y muestra la sensibilidad
del orden. RAPIDA se conserva como comparación y no entra en la fórmula. La ficha
de cada municipio muestra los valores originales y sus aportes.

El orden por límite inferior es conservador y puede favorecer a municipios mejor
documentados. El intervalo muestra esa limitación. No es un ranking validado en
terreno ni una medición de ayudas pendientes. Método y resultados de la captura:
[modelo_priorizacion.md](docs/modelo_priorizacion.md).

```sh
git fetch origin
git switch priorizacion-integrada
git pull --ff-only origin priorizacion-integrada
python generar_tablero_recuperacion.py
```

La generación local no requiere descargar nuevas fuentes. La línea base reutiliza
el archivo DANE ya verificado en `fuentes-nuevas`, con su procedencia conservada.
El cruce municipal corrige Cali/Santiago de Cali y vincula sus 515 colapsos a
infraestructura. No altera los valores originales de los CSV.

Para comprobar el modelo: `node --test tests/modelo.test.js tests/priorizacion.test.js`.
GitHub Actions verifica y genera el HTML al cambiar el código en esta rama.

## Arquitectura heredada y consultas por fuente

Esta rama integra el EDA y el tablero del índice en **un solo `index.html`**,
con tres pestañas: Prioridades, Diagnóstico territorial y Fuentes y método.
Conserva el lenguaje visual del tablero original: fondo gris, tarjetas blancas,
acento azul, tablas y fichas desplegables.

## Consultar y generar

Abre `index.html` directamente en un navegador. Es autocontenido y funciona
sin conexión. `eda_indicadores.html` redirige al mismo tablero.

Para regenerar desde el inventario local, sin descargar ni modificar datos:

```sh
python generar_tablero_recuperacion.py
```

Para descargar las fuentes, actualizar la captura y generar el tablero:

```sh
python actualizar_indice_terremoto.py --out index.html
```

El comando anterior ya no publica los compuestos Naboo o ajustado. Mantiene
los cargadores originales y su exportación a formato largo; los campos con
fuente `Calculo` quedan excluidos del nuevo tablero. El historial anterior
del índice y los CSV ajustados se conservan como archivos históricos.

La entrada anterior `python generar_eda_indicadores.py --out eda_indicadores.html`
también genera el tablero unificado y su redirección, para no romper comandos
locales existentes.

## Lectura

- **Prioridades:** matriz de necesidades por municipio, orden del modelo
  sectorial, contraste con RAPIDA e intervalos por datos faltantes.
- **Diagnóstico territorial:** rankings, distribución y ficha por una sola
  fuente, indicador, definición, unidad, nivel y captura. Permite descargar
  la selección. Un indicador sin observaciones sigue seleccionado y muestra
  el vacío, incluso al cambiar el filtro del decreto.
- **Fuentes y método:** cobertura, vínculos de origen, diccionario,
  incidencias de integridad y limitaciones metodológicas.

La fecha del inventario es una **captura**, no el corte efectivo de las
observaciones. Falta acreditar la versión y fecha de cada fuente. No se
presentan tasas sin denominadores verificados ni probabilidades de confianza.

## Desarrollo

`generar_tablero_recuperacion.py` valida y prepara los registros. `web/modelo.js`
contiene consultas por fuente y `web/priorizacion.js` el nuevo modelo;
`web/tablero.js` controla filtros y vistas;
`web/tablero.html` y `web/tablero.css` conservan la presentación. El generador
inserta los recursos y datos en un único HTML.

```sh
python -m unittest discover -s tests -v
node --test tests/modelo.test.js
node --check web/tablero.js
```

Para reproducir el tablero histórico de forma explícita:

```sh
python actualizar_indice_terremoto.py --legado --out dashboard_impacto_terremoto.html
```

El modo legado también actualiza sus CSV históricos; no es el flujo operativo.
GitHub Actions ejecuta el flujo unificado en esta rama. Los horarios de GitHub
solo se ejecutan en la rama predeterminada; una rama de trabajo se actualiza
mediante `push` o `workflow_dispatch`. No se cambia la configuración de Pages.

Metodología y criterios de transición: [docs/metodologia_recuperacion.md](docs/metodologia_recuperacion.md).
