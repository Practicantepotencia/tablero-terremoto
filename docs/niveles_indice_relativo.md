# Tres niveles del índice relativo

Rama `indice-relativo-ipm-idf`, creada desde `main` en
`a08ab81928ceb43d3707785392e0d94db4b5958f`. No cambia la publicación de main.

## Qué cambia

La matriz relativa, su radar y la comparación relativa con PNUD comparten un
selector. Cambiarlo en cualquiera de las tres vistas sincroniza las demás.
El valor inicial es **Índice con IPM**, idéntico al cálculo anterior.
Las vistas absoluta y per cápita, sus fuentes y cálculos no cambian.

| Nivel | Fórmula del puntaje global |
| --- | --- |
| Índice | `D` |
| Índice con IPM | `P = D × (1 + 0,25 × IPM/100) / 1,25` |
| Índice con IPM y opción C de IDF | `C = P × (1 − IDF/100)` |

`D` es el promedio de cinco sectores, con los pesos internos ya establecidos en
main. Se conservan los dos límites por datos faltantes. IPM es el dato municipal
censal DANE 2018 que ya usa el tablero, no la proyección de RAPIDA.

El ajuste se aplica **después** de promediar los sectores. Cambian el puntaje
global, sus límites, los puestos y las estadísticas frente a PNUD. No cambian
las variables, los denominadores, las normalizaciones sectoriales ni los ejes
del radar: estos muestran los cinco sectores antes del ajuste global.

## Fuente fiscal y reproducción

- Fuente primaria: Departamento Nacional de Planeación (DNP).
- [Página oficial de información fiscal y financiera](https://www.dnp.gov.co/LaEntidad_/subdireccion-general-descentralizacion-desarrollo-territorial/direccion-descentralizacion-fortalecimiento-fiscal/Paginas/informacion-fiscal-y-financiera.aspx).
- [Anexo oficial: Resultados IDF, Nueva Metodología 2023, actualizado](https://colaboracion.dnp.gov.co/CDT/Desarrollo%20Territorial/Desempeno_Fiscal/ResultadosIDF_Nueva_MetodologIa_2023_Act.xlsx).
- Hoja `Municipios 2023`, columna **Nuevo IDF** (`AE`), no `Nuevo IDF (sin bonos)`.
- 1.102 códigos municipales únicos. Descarga verificada el 21 de septiembre de 2026.
- Archivo original: `data/fuentes/ResultadosIDF_Nueva_MetodologIa_2023_Act.xlsx`.
- SHA256: `8ed6c18c648b614b546d4777fb1a77859ced24bac960342f1ea0b47384ac35f1`.
- Extracto: `data/idf_municipal_2023.json`, conservando precisión, año y celda de origen.
- Cruce exclusivamente por código municipal DIVIPOLA de cinco dígitos; no por similitud de nombres.

Se utiliza **2023 porque es el corte solicitado en el PDF**, sin presentarlo
como el dato fiscal más reciente disponible. No se mezcla con otra metodología
o vigencia. La actualización habitual del tablero incorpora este extracto
congelado; no lo sustituye automáticamente por un nuevo anexo fiscal.

Para reconstruir el extracto se requiere Python y `openpyxl`:

```sh
python preparar_idf.py
python generar_tablero_recuperacion.py --eda-redirect ""
node --test tests/*.test.js
python -m unittest discover -s tests -v
node scripts/auditar_niveles_relativo.cjs a08ab81928ceb43d3707785392e0d94db4b5958f
```

Las pruebas de Python comprueban cada dato contra la celda del XLSX usando
solo la biblioteca estándar. El último comando verifica también que el
contenido previo de DATA, los resultados absolutos, los per cápita y el relativo
inicial coinciden con el commit de partida. Requiere disponer de ese commit.
Produce `docs/verificacion_niveles_relativo.json`.

Las pruebas de navegador `tests/niveles_relativo.browser.cjs` y
`tests/unificado.browser.cjs` requieren Playwright y Chromium. Comprueban
sincronización, cálculos mostrados, comparación y navegación en escritorio y móvil.

## Faltantes y lectura metodológica

- Sin IDF válido, el tercer escenario no tiene puntaje ni puesto. Los sectores
  permanecen consultables y el municipio se excluye de los pares de comparación.
- Se rechazan códigos duplicados, IDF no numérico, fuera de 0–100 o de otra vigencia.
  Un IDF de cero sí es válido; uno de 100 produce un puntaje C de cero.
- Sin IPM se mantiene el intervalo ya establecido en el modelo. El primer
  escenario no utiliza IPM, por lo que esa ausencia no amplía su intervalo.
- Las anclas sectoriales usan el mismo universo territorial, incluso para
  municipios sin IDF. No se recalibran por disponibilidad fiscal, departamento
  o búsqueda. El filtro general del decreto mantiene su comportamiento existente.
- **No se vuelve a dividir por el máximo de C**. Su escala está acotada en
  0–100, pero no fuerza que el municipio primero alcance 100.
- El IDF mide desempeño fiscal, no caja disponible, costo de reconstrucción
  ni porcentaje de necesidad sin financiación. Por tanto, `1 − IDF/100` es
  una decisión de modelación para explorar menor desempeño fiscal, **no una
  fracción observada de financiación externa necesaria**. Un IDF alto no elimina
  el daño ni demuestra que el municipio pueda autofinanciarlo.
- Coincidir más o menos con PNUD describe asociación, no acredita por sí solo
  que uno de estos escenarios sea el correcto. Los faltantes siguen siendo
  límites de información, no intervalos de confianza.
