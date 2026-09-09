# Tablero territorial de recuperación temprana

Esta rama integra el EDA y el tablero del índice en **un solo `index.html`**,
con tres pestañas: Prioridades, Diagnóstico territorial y Fuentes y método.
Conserva el lenguaje visual del tablero original: fondo gris, tarjetas blancas,
acento azul, tablas y fichas desplegables.

En `fuentes-nuevas` se añaden tablas originales DANE (IPM censal 2018), MEN
(educación 2024), OPS/OMS (situación del terremoto, septiembre 2026) y acceso
al visor de alojamientos de OIM. [Fuentes, límites y reproducción](docs/fuentes_nuevas.md).
Para actualizarlas: `python -m pip install -r requirements_fuentes_nuevas.txt`,
`python actualizar_fuentes_nuevas.py` y `python generar_tablero_recuperacion.py`.

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

- **Prioridades:** orden por el valor original de recuperación RAPIDA. IPM
  se muestra como contexto, no se suma. Se ven cobertura, municipios sin
  evaluación, matriz sectorial y seguimiento de capturas en panel constante.
- **Diagnóstico territorial:** rankings, distribución y ficha por una sola
  fuente, indicador, definición, unidad, nivel y captura. Permite descargar
  la selección. Un indicador sin observaciones sigue seleccionado y muestra
  el vacío, incluso al cambiar el filtro del decreto.
- **Fuentes y método:** cobertura, vínculos de origen, diccionario,
  incidencias de integridad y limitaciones metodológicas.

La fecha del inventario es una **captura**, no el corte efectivo de las
observaciones. Las nuevas fuentes indican su periodo y copia verificable;
en las fuentes anteriores puede faltar acreditar versión y fecha. No se
presentan tasas sin denominadores verificados ni probabilidades de confianza.

## Desarrollo

`generar_tablero_recuperacion.py` valida y prepara los registros. `web/modelo.js`
contiene los cálculos sin interfaz; `web/tablero.js` controla filtros y vistas;
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
