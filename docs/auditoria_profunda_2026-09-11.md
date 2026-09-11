# Auditoría profunda del estado del proyecto -- 11 de septiembre de 2026

Auditoría independiente de lo que hay hoy en `main`, hecha releyendo el código
(no solo la documentación), corriendo la batería de pruebas completa
(incluida la que no está en CI) y verificando en GitHub Actions que lo que
dice el repositorio coincide con lo que de verdad se publica. No es una
auditoría de terreno ni valida el modelo contra resultados reales de
recuperación -- eso está fuera del alcance de cualquier revisión de código.

## Resumen ejecutivo

El proyecto es más maduro de lo que documenta su propia superficie: el
modelo de priorización (`web/priorizacion.js`) implementa exactamente la
fórmula que describe `docs/modelo_priorizacion.md` -- lo verifiqué línea por
línea, no encontré discrepancia entre lo documentado y lo que corre. Las
pruebas (36 Python + 49 JS + 3 de navegador con Playwright que no están en
CI pero sí corrí a mano) pasan todas. El despliegue está sincronizado: la
última corrida de `actualizar.yml` y el deploy de Pages que le sigue son
ambos de hoy y ambos exitosos.

Los problemas reales que encontré no son de cálculo -- son de **higiene del
repositorio**: documentación que describe una arquitectura que ya no es la
que se publica, un archivo de salida que pesa 24,7 MB (de los cuales 24,7 MB
son datos, no interfaz), pruebas de navegador reales que nunca se ejecutan
automáticamente, y once ramas remotas sin criterio visible de cuáles siguen
vivas.

## 1. Arquitectura verificada

```
indicadores_largo_no_calculo.csv ──┐
historial_indicadores_no_calculo.csv ┤→ generar_tablero_recuperacion.py
data/linea_base_priorizacion.json ───┤   (prepare_payload: valida, cruza
data/poblacion_relativa.json ────────┤    DIVIPOLA, excluye conflictos)
data/denominadores_sectoriales.json ─┘
                                          │
                                          ▼
                              web/tablero.html + 7 módulos JS
                              (modelo.js, priorizacion.js, radar.js,
                               relativo.js, denominadores.js,
                               comparacion.js, tablero.js)
                                          │
                                          ▼
                                    index.html (24,7 MB, autocontenido)
                                          │
                              eda_indicadores.html (redirect, 240 B)
```

`actualizar_indice_terremoto.py` (el script original de esta sesión) sigue
vivo y sigue corriendo en `main` -- descarga fuentes, recalcula
`indice_impacto_departamento.csv` y exporta `indicadores_largo*.csv` -- pero
**ya no genera la interfaz pública**. Su salida HTML (`--out index.html`)
se sobreescribe inmediatamente después por
`generar_tablero_recuperacion.py` en el mismo job (ver `actualizar.yml`,
paso "Publicar interfaz principal"). Es decir: dos generadores de HTML
compiten por el mismo archivo de salida y el segundo siempre gana. Esto
funciona por orden de pasos, no por diseño explícito -- si alguien
reordenara el workflow sin darse cuenta, el tablero unificado dejaría de
publicarse sin ningún error visible.

## 2. Verificación del modelo de priorización

Comparé `docs/modelo_priorizacion.md` contra `web/priorizacion.js` campo por
campo:

| Afirmación del doc | Verificado en código |
|---|---|
| 17 campos, 6 sectores, peso 1/6 cada uno | `SECTORS` suma 4+4+2+2+3+2 = 17 campos; `weights=SECTORS.map(()=>1)`, sin renormalizar |
| `P_m = D_m × (1 + 0,25×IPM/100) / 1,25` | `aggregate()`: `lo*(1+alpha*vLo)/(1+alpha)` con `alpha=.25` -- coincide |
| Solo el máximo llega a 100, sin log ni recorte P95 | `normalize()`: `100*clamp(value/anchor,0,1)`, sin transformación adicional |
| Faltantes propagan el intervalo 0–100, no se imputan como cero | `score==null` se excluye de `lower`; `unknown` acumula el peso de cada campo sin dato hacia `upper` |
| 39 escenarios de sensibilidad | Confirmé el conteo en el código: 1 (pesos iguales) + 6 sectores × 2 factores = 13 vectores de peso, × 3 valores de alpha = 39 -- coincide exacto |
| RAPIDA es solo comparación, no entra a la fórmula | `SECTORS` en `priorizacion.js` usa exclusivamente campos `3iS-Sheets` y `PNUD`; ningún campo `UNDP-RAPIDA` aparece en esa lista |

**No encontré ninguna discrepancia.** Es inusual: la documentación técnica de
este proyecto es más rigurosa que el promedio y el código la cumple.

### Un riesgo real que el propio código ya limita, pero vale la pena nombrar

El ancla de normalización (`anchor = Math.max(...values)`) se calcula sobre
el universo visible en cada corte -- un solo municipio con un valor atípico
o mal capturado comprime la escala de todos los demás. El propio documento
lo advierte ("Un máximo extremo o erróneo puede comprimir el resto"), así
que no es un hallazgo nuevo, pero no vi ningún control automático (test o
aviso en pantalla) que detecte cuándo el máximo de un campo se dispara de
una captura a la siguiente. Sería una prueba barata de agregar.

## 3. El hallazgo de doble conteo de la sesión anterior: contenido, no resuelto

En la auditoría previa (`docs/catalogo_indicadores.md`) documenté que
`bdg_comm_aff` y `bdg_edu_aff` de UNDP-RAPIDA no tienen garantía de
exclusión mutua. Verifiqué ahora dónde vive ese par de campos en el código
actual: aparecen en `web/modelo.js` (`sectors`, línea 9,
`'Instituciones': ['undp_rapida_bdg_comm_aff', 'undp_rapida_bdg_public_imp']`),
pero **ese `sectors` es una estructura distinta de `SECTORS` en
`priorizacion.js`** -- se usa solo para calcular cobertura y filas
comparables en la pestaña de RAPIDA/diagnóstico, nunca entra al puntaje de
priorización. El riesgo de doble conteo sigue sin resolverse a nivel de
dato, pero está contenido: no puede corromper la matriz principal, solo
podría inflar cifras de cobertura mostradas *sobre RAPIDA como fuente de
comparación*. Vale la pena que la advertencia en `catalogo_indicadores.md`
se traslade también a donde se explica esa cobertura, porque hoy ese doc ya
no está enlazado desde ningún lado activo (ver punto 5).

## 4. Cobertura de pruebas: lo que corre solo y lo que no

| Suite | Cómo se ejecuta | Estado verificado |
|---|---|---|
| `python -m unittest discover -s tests` (36 casos) | En ambos workflows, cada corrida | ✅ pasa |
| `node --test tests/*.test.js` (49 casos) | En ambos workflows, cada corrida | ✅ pasa |
| `node --check web/*.js` (7 archivos) | En ambos workflows | ✅ pasa |
| `tests/unificado.browser.cjs`, `radar.browser.cjs`, `relativo.browser.cjs` (Playwright, prueban el HTML generado de verdad: orden de columnas, teclado, móvil, diseño) | **Ninguno de los dos workflows las invoca** -- requieren Playwright, que no está declarado como dependencia en ningún `package.json` (no existe) | Las corrí a mano en este entorno: **las 3 pasan** |

Esto es la brecha más concreta que encontré. `docs/tablero_unificado.md`
dice textualmente que `unificado.browser.cjs` "comprueba las tres vistas,
independencia de controles, estadísticos, teclado y diseño móvil en el HTML
generado" -- una afirmación verificable y hoy cierta, pero que nadie
reconfirma automáticamente en cada cambio. Si una modificación a
`web/tablero.js` rompiera el orden de columnas o el foco de teclado, `node
--check` (que solo valida sintaxis) no lo detectaría, y las pruebas Node
puras tampoco, porque no renderizan HTML real. El repositorio tiene la
prueba correcta escrita y no la usa donde importaría.

## 5. Documentación: qué describe lo que se publica y qué quedó atrás

Revisé si `README.md` (la puerta de entrada) sigue enlazando la
documentación de la generación anterior de este proyecto:

| Documento | ¿Enlazado desde README.md o docs/publicacion_main.md? | Estado real |
|---|---|---|
| `docs/tablero_unificado.md`, `docs/modelo_priorizacion.md`, `docs/metodologia_recuperacion.md` | Sí | Describen la arquitectura vigente, verificados arriba |
| `docs/denominadores_sectoriales.md`, `docs/priorizacion_relativa.md` | Sí (vía tablero_unificado.md) | Vigentes |
| `docs/metodologia_fuentes.md` | **No** | Describe la extracción de cada fuente cruda -- sigue siendo técnicamente correcto, pero ya no hay ninguna puerta de entrada que lleve ahí |
| `docs/indice_ajustado.md` | **No** | Describe el índice ajustado (Fase B) que ya no se calcula como interfaz principal; solo lo referencian `catalogo_indicadores.md` y `correccion_3is_2026-09-09.md`, entre ellos mismos |
| `docs/catalogo_indicadores.md` | **No** | Mismo caso; incluye la advertencia de doble conteo del punto 3, que hoy nadie encuentra sin conocer el nombre del archivo |
| `data/README.md` | Indirectamente (está en `data/`, no en la raíz) | **Desactualizado**: sigue describiendo "el índice de impacto" y presenta `indice_ajustado.md` como "el SEGUNDO índice compuesto", cuando en realidad hay una tercera generación (el modelo sectorial 1.2) que ya la superó y que este README ni menciona |

Ninguno de estos documentos tiene contenido *incorrecto* -- describen con
precisión la generación de arquitectura a la que pertenecen. El problema es
de descubribilidad: alguien que solo lee `README.md` hoy no se entera de
que existen, y `data/README.md` activamente describe un estado de dos
generaciones atrás como si fuera el actual.

## 6. Higiene de ramas

Once ramas remotas, sin `formato-largo` ni `main` como únicas activas:

| Rama | Commits únicos sobre `main` | Lectura |
|---|---|---|
| `reestructuracion-recuperacion` | 7 | Antecesora directa de `priorizacion-integrada`; probablemente la base de desarrollo activa |
| `formato-largo` | 12 | La rama de la sesión anterior (índice ajustado, auditoría de fuentes) -- contenido ya superado por el modelo sectorial, pero nunca formalmente cerrada |
| `revision-notas-interfaz` | 2 | Pocos commits, posible trabajo en curso o abandonado reciente |
| `priorizacion-integrada` | 6 | Rama de desarrollo del modelo 1.1/1.2, aparentemente ya fusionada en espíritu a `main` |
| `denominadores-sectoriales` | 0 (0 por delante, 64 por detrás) | **Completamente fusionada -- candidata directa a borrar** |
| `horizon`, `fuentes-nuevas` | 3, 2 | Exploraciones puntuales (Horizon como referencia, fuentes DANE) -- bajo riesgo de contener algo no migrado, pero sin verificar |
| `3is`, `economica` | 15, 2 | De la sesión anterior a la anterior; contenido ya reemplazado |
| `claude/hola-2tl9nz`, `evolucion` | 0, 0 | **Completamente fusionadas -- candidatas directas a borrar** |

No borré ninguna -- es una decisión del equipo, no mía. Pero al menos
`denominadores-sectoriales`, `claude/hola-2tl9nz` y `evolucion` no contienen
ningún commit que no esté ya en `main`; conservarlas no cuesta nada técnico
pero sí hace más difícil para cualquiera (humano o IA) saber cuál es la
rama viva.

## 7. Tamaño y rendimiento

```
index.html total:        24.768.583 bytes
HTML + CSS + JS (código): 48.772 bytes   (0,2%)
Payload JSON embebido:   24.719.811 bytes (99,8%)
```

El código de interfaz es liviano (48 KB). Todo el peso es el `payload` --
el inventario completo (17.758 filas de `indicadores_largo_no_calculo.csv`)
más el historial, la línea base DANE de 1.122 territorios censales, la
población relativa y los denominadores sectoriales, todo embebido para que
el tablero funcione sin conexión. Es una decisión de diseño explícita (así
lo dice `README.md`: "autocontenido y funciona sin conexión"), no un
descuido -- pero tiene un costo real: en una conexión móvil típica (~1–2
Mbps efectivos), cargar 24,7 MB toma entre 15 y 30 segundos antes de que el
navegador pueda ejecutar el primer script. `indice_educacion.html` (12 MB)
tiene el mismo patrón.

No es una prioridad urgente si el público objetivo abre el link desde
escritorio con buena conexión, pero si se espera uso desde campo o celular,
valdría la pena separar el payload en un archivo `.json` externo cacheable
en vez de inline -- el navegador solo tendría que descargarlo una vez por
sesión en lugar de cada vez que se reabre `index.html`.

## 8. Otros hallazgos menores

- **`generar_tablero_recuperacion.py` sanea el payload contra inyección**:
  `data.replace("<", "\\u003c")` antes de insertarlo en el `<script>` --
  correcto y más estricto que el `.replace("</","<\\/")` que usaba el EDA
  anterior (ese solo neutralizaba el cierre de etiqueta; este neutraliza
  cualquier `<`, cerrando también la vía de un `<script>` inyectado a mitad
  de una cadena JSON). Buena práctica, sin acción pendiente.
- **`GEO_ALIASES` es una lista corta y explícita** (7 pares) de equivalencias
  municipales -- ningún emparejamiento por semejanza de texto, tal como
  documenta `modelo_priorizacion.md`. Verificado: coincide.
- **`.claude/` existe en la raíz del repo** (no lo audité en detalle, pero
  confirmá que no contiene credenciales ni tokens al listarlo -- solo
  configuración local del proyecto).
- **`docs/notas_metodologicas.docx` coexiste con `docs/notas_metodologicas.md`**
  -- mismo contenido en dos formatos; no es un problema pero sí una fuente
  potencial de desincronización si alguien edita uno y no el otro.

## 9. Hallazgos consolidados por severidad

| # | Hallazgo | Severidad | Acción sugerida |
|---|---|---|---|
| 1 | Pruebas de navegador reales (Playwright) no están en CI pese a existir y pasar | Media | Agregar Playwright como dependencia de desarrollo e incluir `tests/*.browser.cjs` en `actualizar.yml`/`priorizacion.yml` |
| 2 | `data/README.md` describe una arquitectura de dos generaciones atrás | Media | Reescribir su sección de "Fuentes remotas" y la intro para apuntar al modelo sectorial 1.2 |
| 3 | `docs/metodologia_fuentes.md`, `indice_ajustado.md`, `catalogo_indicadores.md` (con la advertencia de doble conteo) no están enlazados desde ningún punto de entrada activo | Media | Agregar una sección "Arquitectura anterior" en `README.md` o `docs/publicacion_main.md` que los enlace explícitamente |
| 4 | Dos generadores de HTML (`actualizar_indice_terremoto.py` y `generar_tablero_recuperacion.py`) escriben al mismo `index.html` en el mismo job, y el orden de pasos (no una guarda explícita) decide cuál gana | Baja-Media | Un comentario ya lo explica en el workflow, pero un cambio accidental de orden fallaría en silencio -- vale un `assert` o verificación post-generación |
| 5 | `index.html`/`indice_educacion.html` pesan 24,7 MB / 12 MB, 99,8% payload embebido | Baja (si el uso es de escritorio) | Evaluar externalizar el payload a JSON cacheable si el uso esperado incluye celular/campo |
| 6 | Riesgo de doble conteo `bdg_comm_aff`/`bdg_edu_aff` (documentado en sesión anterior) sigue sin resolverse a nivel de dato | Baja (contenido: no afecta el puntaje de priorización, solo cifras de cobertura de RAPIDA) | Ninguna acción urgente; mantener la advertencia visible si se usa esa cobertura para decisiones |
| 7 | 3 ramas remotas completamente fusionadas sin borrar (`denominadores-sectoriales`, `claude/hola-2tl9nz`, `evolucion`) | Muy baja | Housekeeping, sin urgencia |

## 10. Lo que esta auditoría no cubre

No valida el modelo contra resultados reales de recuperación en terreno --
eso lo dice el propio proyecto y sigue siendo cierto. No revisé la
corrección de cada fórmula de `web/relativo.js`, `web/denominadores.js` ni
`web/radar.js` línea por línea (sí verifiqué que pasan sus pruebas propias
y que las pruebas de navegador ejercitan su comportamiento real). No audité
`.claude/` en profundidad más allá de confirmar ausencia de secretos
visibles. No hay forma, desde el código, de verificar si las fuentes
externas (3iS, PNUD, DANE) siguen sirviendo los mismos datos que cuando se
capturaron -- eso solo lo prueba la próxima corrida automática.
