# Tablero de priorización municipal

Rama `cepal-capitulo-2-priorizacion-municipal`, creada desde `main`
`c66aa361fb713fdaf741e0c0ceedf9c5798bb6bb`. Esta rama no despliega producción.
[Tablero publicado en main](https://practicantepotencia.github.io/tablero-terremoto/).

## Uso

Abrir `index.html`. Es autocontenido y funciona sin conexión. La vista principal
ordena municipios mediante un índice propio de afectaciones documentadas.
Un selector alterna medidas absolutas, por 10.000 habitantes y relativas por
indicador. La búsqueda se comparte; solo hay una matriz visible. Los encabezados
alternan orden descendente, ascendente y global. Las fichas explican el cálculo.

Cinco pestañas: Índice, Comparar municipios, Necesidad de recuperación temprana
(RAPIDA), Diagnóstico territorial y Fuentes y método. RAPIDA se conserva como
comparación externa y nunca entra en la fórmula propia.

## Modelo vigente

- Cinco sectores con peso 1/5: Impacto humano, Vivienda, Salud, Educación e
  Infraestructura y acceso. Nueve campos puntúan; diez se muestran.
- Impacto humano promedia fallecidos y desaparecidos. Familias solo informativa.
- Vivienda pondera destruidas 2/3 y averiadas 1/3.
- PNUD tiene precedencia; 3iS completa ausencias. Cero explícito es válido.
  Diferencias entre fuentes se conservan en la ficha y no se suman.
- `P = D × (1 + 0,25 × IPM/100) / 1,25`, con IPM DANE censal 2018.
- Faltantes mantienen pesos e intervalos; no se convierten en cero observado.
  El orden usa el límite inferior y puede favorecer municipios mejor documentados.
- Buscar o filtrar departamento no renormaliza. Cambiar ámbito o captura sí.
- Salud relativa es heridos/camas REPS 2022, una carga potencial frente a capacidad
  histórica. Educación relativa es un cociente frente al registro SIMAT 2022,
  con tope del índice en 1; no acredita porcentaje de sedes dañadas.

Los pesos y el ajuste son elecciones del producto. El índice no es una fórmula
CEPAL, una valoración monetaria, un presupuesto ni una medida de ayudas pendientes.
La comparación con RAPIDA no lo valida en terreno.

## Adaptación al capítulo II de CEPAL

[Metodología vigente, controles y límites](docs/cepal_capitulo_2.md).

Se distinguen afectación física, daños monetarios, pérdidas de flujos y costos
adicionales. Las estimaciones publicadas en COP permanecen consultables pero
pendientes de acreditar valoración, línea base y solapamientos. No se suman entre
fuentes ni con conteos. Las tres cuentas CEPAL aparecen no evaluadas mientras
falten datos admisibles. La fecha del selector es una captura, no el corte de las
fuentes. El CSV conserva fecha efectiva y versión cuando existen.

`cepal.py` valida la cuenta independiente de `data/evaluacion_cepal.json`.
Exige evidencia de causalidad, acervo y precios previos para daños, escenarios
mensuales para pérdidas y gastos incrementales efectuados para costos adicionales.
Se excluyen conflictos y solapamientos; no se calcula impacto macroeconómico.

La rama `educacion-matricula-critica` se inspeccionó como referencia, sin fusionarla
ni incorporar sus libros originales. Sus datos MEN no modifican retrospectivamente
los pesos de esta rama. Matrícula crítica no significa alumnos sin clase.

## Generación y comprobación

```sh
python scripts/validar_cepal.py
python generar_tablero_recuperacion.py
python -m unittest discover -s tests -v
node --test tests/*.test.js
node tests/cepal.browser.cjs
```

La generación usa los CSV locales y no descarga fuentes ni modifica historiales.
La prueba de navegador requiere Playwright y Chromium; admite `CHROME_PATH`.
Comprueba valores y puntajes contra main, filtros, exportaciones y vista móvil.

El actualizador original se conserva: `python actualizar_indice_terremoto.py --out index.html`.
No se modifican los flujos de publicación o horarios de producción.

`generar_tablero_recuperacion.py` prepara datos y HTML; `web/priorizacion.js`
calcula el índice; `web/modelo.js` organiza consultas; `web/tablero.js` controla
vistas y exportaciones. La documentación de versiones anteriores está en
[modelo_priorizacion.md](docs/modelo_priorizacion.md) y
[notas_metodologicas.md](docs/notas_metodologicas.md); no sustituye la configuración
vigente descrita arriba.
