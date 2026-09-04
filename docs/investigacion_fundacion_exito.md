# Investigación: fundacionexe.org.co/unmillonderazones

**Estado:** integrada parcialmente. El sitio en sí es inaccesible por
scraping, pero Daniel encontró y compartió a mano un CSV real que sale
de ahí -- ver "Qué se integró" abajo.

## Qué es

La campaña "Un millón de razones" de la Fundación Éxito (fundación del
Grupo Éxito) para el terremoto de Chocó: coordina donaciones de mercados
para ~26.000 familias en Valle del Cauca, Risaralda, Caldas, Quindío y
Chocó, y aparentemente también sirve como panel de coordinación de
"organizaciones aliadas" que apoyan sedes educativas afectadas (ver CSV).

Fuentes de contexto (por búsqueda web, no por acceso al sitio):
[La República](https://www.larepublica.co/empresas/la-solidaridad-por-las-victimas-del-terremoto-lleva-el-sello-empresarial-4460416) ·
[El Colombiano](https://www.elcolombiano.com/negocios/terremoto-colombia-donaciones-empresas-reconstruccion-GH40032664) ·
[El País](https://www.elpais.com.co/colombia/el-llamado-es-a-la-solidaridad-grupo-y-fundacion-exito-entregan-ayuda-alimentaria-a-familias-afectadas-por-el-sismo-1019.html)

## Por qué no se pudo automatizar

El dominio completo `fundacionexe.org.co` bloquea cualquier scraping con
un **reto de Cloudflare** ("Just a moment...", verificación tipo
Turnstire/Managed Challenge) -- no es un simple 403 por IP, exige
ejecutar JavaScript real y resolver un desafío como lo haría un
navegador humano. Se probaron, todas sin éxito:

1. Sandbox de esta sesión de Claude -- bloqueado por política de red del
   entorno (esperado).
2. GitHub Actions, `urllib` con user-agent simple -- `403 Forbidden`.
3. GitHub Actions, headers de navegador completo (Chrome real,
   Accept-Language, Referer) -- `403 Forbidden` otra vez.
4. Wayback Machine (por si había un snapshot archivado) -- no existe
   ningún snapshot de esa URL.
5. Mapeo de rutas alternas del dominio (raíz `/`, `robots.txt`,
   `sitemap.xml`, `wp-json/`, con/sin `www`, http/https) -- **403 en las
   10**, incluida la raíz del dominio. No es un bloqueo de esa página en
   particular, es el dominio entero.
6. `r.jina.ai` (proxy de lectura externo que normalmente sí renderiza
   JavaScript con un navegador real antes de devolver texto) -- también
   recibió la pantalla de reto de Cloudflare. Si ni ese servicio lo pasa,
   ningún script lo va a pasar.

**Conclusión:** no hay vía automática posible desde ningún entorno
disponible en esta sesión. La única forma de ver el contenido es un
navegador humano de verdad (la IP residencial de Daniel).

## Qué se integró

Daniel abrió el sitio en su navegador y encontró un botón de descarga
con el detalle de **sedes educativas afectadas** -- lo bajó y lo compartió
directamente, sin necesidad de scraping. Ver `data/README.md` para el
detalle del archivo (`sedes_educativas_afectadas_choco_ago2026.csv`) y
`load_sedes_educativas_afectadas()` en `actualizar_indice_terremoto.py`
para cómo se agrega a `indicadores_largo.csv` (`fuente=FundacionExito`,
nivel municipal: sedes afectadas, sedes en estado crítico, matrícula
afectada, docentes afectados).

Es un snapshot manual -- si Daniel encuentra una versión más nueva en el
sitio, reemplaza el CSV en `data/` con el mismo nombre y el loader lo
recoge solo en la siguiente corrida.

## Qué falta

- El CSV solo trae sedes con severidad ≥ algún umbral ("filtradas" en el
  nombre) -- no sabemos si excluye sedes sin daño o es el universo
  completo de sedes de Chocó. Confirmar con Daniel si hace falta.
- La columna "Organizaciones aliadas" (qué empresa/fundación ya apoya
  cada sede) es potencialmente útil para otra dimensión ("cobertura de
  ayuda" vs. "necesidad") -- no se usó todavía, solo se agregaron los
  conteos numéricos (sedes, matrícula, docentes).
- No se exploró si hay más botones de descarga en el sitio (el original
  "Un millón de razones" habla de mercados/alimentos, no solo colegios)
  -- si Daniel encuentra algo más, mismo proceso.
