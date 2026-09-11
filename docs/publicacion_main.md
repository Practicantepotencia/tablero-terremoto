# Tablero principal y GitHub Pages

La versión aprobada de `denominadores-sectoriales` se incorpora a `main`.
La dirección pública se conserva:

https://practicantepotencia.github.io/tablero-terremoto/

## Qué publica

- Tres matrices y tres radares: absoluto, per cápita y relativo sectorial.
- Necesidad de recuperación temprana: resultado original y comparación por
  puntaje, con solo el selector de nuestro índice y el buscador para resaltar.
- Diagnóstico territorial y Fuentes y método.

`index.html` es la entrada pública; `eda_indicadores.html` redirige a ella.
Se trasladan también los generadores, módulos, pruebas y bases verificadas.
Los CSV y los historiales existentes de main no se reemplazan por capturas
anteriores de las ramas de trabajo. Los archivos históricos siguen conservados.

## Actualización y protección de la interfaz

GitHub Pages publica main desde la raíz, sin cambiar el enlace ni el alojamiento.
`.nojekyll` conserva el HTML autocontenido como archivo estático.

Al cambiar código en main, el flujo valida y regenera el tablero desde el
inventario conservado, sin depender de que cada fuente externa esté disponible.
La descarga de nuevos datos continúa en las ejecuciones programadas cada cuatro
horas y en la ejecución manual de «Actualizar datos y tableros». En ambos casos,
el generador operativo es el del tablero unificado, no el índice histórico.

Las ramas de trabajo conservan sus propios tableros. No se borran sus historiales
ni se publica una nueva dirección.

## Auditorías

- [Auditoría profunda, 11 sep 2026](auditoria_profunda_2026-09-11.md) --
  verifica el modelo de priorización contra su código, la cobertura real de
  pruebas (incluidas las de navegador, fuera de CI), estado de despliegue,
  higiene de ramas y documentación desactualizada.

## Arquitectura anterior (histórica, no publicada)

Antes del modelo sectorial 1.2, `main` publicaba el índice compuesto
original (Naboo) y, en paralelo como beta, un índice ajustado con fuentes
institucionales (PNUD, UNDP-RAPIDA, 3iS). Ambos se conservan como cálculo
en `actualizar_indice_terremoto.py` pero ya no son la interfaz pública --
ver arquitectura verificada en la auditoría de arriba. Documentación de esa
generación, por si hace falta consultarla:

- [Metodología de extracción por fuente](metodologia_fuentes.md)
- [Índice ajustado (Fase B)](indice_ajustado.md)
- [Catálogo de indicadores](catalogo_indicadores.md) -- incluye la
  advertencia sobre posible doble conteo en categorías de edificaciones de
  UNDP-RAPIDA (`bdg_comm_aff`/`bdg_edu_aff`), contenida hoy al modelo
  sectorial: no entra a su puntaje de priorización.
