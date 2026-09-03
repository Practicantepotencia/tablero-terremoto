# Investigación: ¿cambiar la fuente principal a 3iS?

**Estado:** exploración inicial, sin decisión tomada. Vive en la rama `3is`,
no toca `main`.

**Objetivo:** evaluar si conviene reemplazar (o complementar) `registro.json`
de mapadelterremoto.com como fuente principal del índice, con datos del
dashboard de 3iS: https://3is.org/emergenciaslatam/terremoto_choco/

## Bloqueo actual

Esta sesión de Claude corre en un sandbox con salida de red restringida —
`3is.org` está bloqueado por la política de red del entorno (mismo tipo de
bloqueo que ya vimos con el ArcGIS Hub y mapadelterremoto.com en sesiones
anteriores; el script en producción, corriendo en GitHub Actions, no tiene
esta restricción). No pude abrir la página directamente para inspeccionar
su estructura real.

**Lo que necesito de ti para avanzar de verdad:**
1. Abrir https://3is.org/emergenciaslatam/terremoto_choco/ en tu navegador
2. Si el dashboard tiene un botón de descarga/exportar datos (CSV, GeoJSON,
   Excel) — bájalo y compártemelo, igual que hicimos con el Excel de
   municipios y el de Cámaras de Comercio
3. Si no hay botón de descarga pero el mapa carga datos dinámicamente:
   abre las herramientas de desarrollador del navegador (F12) → pestaña
   "Network"/"Red" → recarga la página → busca una petición que devuelva
   JSON o GeoJSON (usualmente contiene la palabra "api", "data", "geojson",
   o termina en `.json`) → clic derecho → "Copy as cURL" o "Open in new tab"
   → pásame esa URL o el contenido

Sin esto estoy limitado a lo que encuentro por búsqueda web, que no incluye
el detalle técnico (JSON de ejemplo, esquema de campos) que necesito para
diseñar un loader.

## Lo que sí sé por búsqueda (sin acceso directo)

- **3iS** es una organización que mantiene dashboards de emergencia para
  Latinoamérica (`emergenciaslatam`). Para este sismo específico, el
  dashboard **consolida información de fuentes oficiales**: UNGRD (Unidad
  Nacional para la Gestión del Riesgo de Desastres), OCHA (Oficina de la
  ONU para la Coordinación de Asuntos Humanitarios), y el Servicio
  Geológico Colombiano.
- Es, en principio, un dashboard de mapas — probablemente basado en un SIG
  (sistema de información geográfica), con capas descargables por
  municipio (similar en espíritu al ArcGIS Hub que ya evaluamos).
- No encontré documentación pública de API/endpoint por búsqueda — es
  posible que no exista una API pública formal, o que solo se pueda llegar
  a los datos crudos inspeccionando las peticiones de red del mapa (de ahí
  el paso 3 de arriba).

## Por qué esto importa: comparación preliminar contra la fuente actual

| | **mapadelterremoto.com** (fuente actual) | **3iS** (candidata) |
|---|---|---|
| Naturaleza | Agregador de prensa | Agregador de fuentes **oficiales** (UNGRD, OCHA, SGC) |
| Rigor | Sin proceso de validación declarado | Presumiblemente más cercano a cifras oficiales, a confirmar |
| Formato de acceso | JSON público en URL fija, automatizable sin fricción (`urllib` puro) | Desconocido todavía — puede requerir scraping, API no documentada, o descarga manual |
| Automatización cada 4h | Ya funciona, probado | **Incierto** — si no hay endpoint estable, no se puede automatizar igual de fácil, y el workflow tendría que cambiar de estrategia (o quedar semi-manual) |
| Granularidad | Punto individual, con tipo/severidad/texto libre | Desconocida — mapas SIG normalmente son por municipio/polígono, no necesariamente puntos individuales |
| Seguimos con el nivel de detalle que ya usamos (5 dimensiones por tipo de punto) | Sí, tal cual | Necesitaría rediseñar `compute_indice()` si el esquema es distinto (ej. si viene ya agregado por municipio en vez de puntos individuales) |

## Lo que hay que resolver antes de decidir

1. **¿Hay una forma de descargar/consultar los datos programáticamente?**
   Si no, cambiar la fuente principal significa perder la automatización
   cada 4h que hoy funciona — pasaría a ser un snapshot manual (como
   `data/`), no una fuente "principal" en el sentido actual.
2. **¿Qué esquema de datos trae?** Punto individual como `registro.json`,
   o ya agregado por municipio/departamento (como el Excel de municipios
   que ya tenemos en `data/`)? Esto determina si `compute_indice()` se
   puede reusar casi tal cual o hay que rediseñarlo.
3. **¿Vale la pena reemplazar o complementar?** Dado que 3iS parece más
   oficial, una opción intermedia (sin descartar `registro.json`) es
   usar 3iS como **fuente de validación cruzada** — comparar los números
   que arroja cada una y ver qué tan distintos son, antes de decidir
   cuál gobierna el índice.

## Próximo paso

Esperando que compartas el contenido de la página o un endpoint de datos
(ver "Bloqueo actual" arriba) para poder diseñar un loader real y hacer la
comparación cuantitativa contra `main`.
