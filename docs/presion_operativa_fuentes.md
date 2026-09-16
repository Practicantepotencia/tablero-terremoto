# Comprobación de presión operativa real

Investigación del 16 de septiembre de 2026. Esta evidencia no se convierte en un censo municipal ni se mezcla con heridos/REPS2022.

## Hospital Universitario San Jorge, Pereira

Fuente primaria institucional, publicación del 24 de agosto de 2026:
https://husj.gov.co/comienzan-obras-de-demolicion-en-algunas-areas-del-san-jorge-para-disminuir-los-riesgos/

Valores expresados en la misma fuente y corte:
- Camas habituales: 560.
- Camas habilitadas: 426.
- Camas ocupadas: 386.

Cálculos reproducibles:
- Ocupación de la capacidad habilitada: 386 / 426 × 100 = 90,6103%.
- Camas no habilitadas respecto de la oferta habitual: (560 - 426) / 560 × 100 = 23,9286%.
- Camas habilitadas no ocupadas: 426 - 386 = 40.

No son datos de toda Pereira, ni de ocupación actual, ni exclusivamente de urgencias.
La diferencia de camas no determina por sí sola cuántas personas quedaron sin atención.
No se extrapola este hospital al resto del municipio y no se presenta como validación estadística de los indicadores experimentales.

## REPS ocupación diaria

https://prestadores.minsalud.gov.co/habilitacion/capacidad_instalada_ocupacion.aspx
Se comprobó la existencia del módulo. La página revisada pide usuario y contraseña del prestador para registrar ocupación. Esto no prueba que no haya otro acceso público; no se obtuvieron por esta vía series descargables por municipio y fecha y no se intentó eludir autenticación.

## Naboo

https://www.mapadelterremoto.com/datos/registro.json
Se obtuvo el registro completo: 3.857 puntos, de los que 239 son de tipo HOSPITAL. Esta cifra no equivale a 239 sedes dañadas únicas ni a 239 hospitales operantes.
Las fichas contienen mezcla de daño, apertura, ampliación, evacuación, cierre, ocupación y hospitales de campaña. Fechas y ámbitos varían.
Hay referencias a ocupación para Pereira, Quibdó, Cali, La Virginia y Popayán, entre otras. Algunas cifras describen un servicio y otras toda una institución; no se promedian ni se suman entre sí.
Las notas se usan para localizar el reporte original. No se convierte una mención no encontrada en cero.
El registro no ofrece una lista exhaustiva de todos los hospitales funcionando normalmente contra la cual validar su cobertura.

## OPS, SITREP 8, 11 de septiembre

https://www.paho.org/sites/default/files/2026/09/sitrep-8-colombia-sismo-11092026.pdf
Se descargó y examinó. La densidad de ocupación hallada corresponde a alojamientos temporales, no a camas hospitalarias. Se excluye de los indicadores de presión asistencial.

## Resultado

Hay evidencia institucional que permite medir ocupación real en casos concretos. En la búsqueda realizada no se obtuvo una serie homogénea de ocupación municipal para integrar una tercera comparación nacional.
Por eso se entregan dos ramas calculables de carga potencial y esta auditoría de medición operativa, sin rellenar municipios ausentes ni convertir casos aislados en ocupación municipal.

## SIHO y SISPRO

Se revisaron también las páginas oficiales:
- https://www.sispro.gov.co/central-prestadores-de-servicios/Pages/Prestadores-de-Servicios.aspx
- https://www.sispro.gov.co/central-prestadores-de-servicios/Pages/SIHO-Sistema-de-gestion-hospitalaria.aspx
- https://prestadores.minsalud.gov.co/SIHO/

SISPRO describe las consultas de gestión de la red pública como anuales y por entidad territorial/nivel de atención. SIHO cubre empresas sociales del Estado, no automáticamente toda la red privada.
Los accesos examinados no entregaron una tabla municipal homogénea de ocupación posterior al sismo (una página entró en bucle de redirección y el acceso SIHO no devolvió datos tabulares al lector).
No se interpreta este resultado de acceso como inexistencia de los registros.
