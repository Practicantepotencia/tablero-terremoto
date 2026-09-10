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
