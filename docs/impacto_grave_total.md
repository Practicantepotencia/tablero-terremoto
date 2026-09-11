# Impacto total y grave · modelo 1.3

Rama `impacto-grave-total`, creada el 11/09/2026 desde `main`, commit
`6091265657ade2a949cdd2ffc1904256788e41c1`. No cambia main ni su publicación en Pages.

## Qué cambia

Un selector global **Impacto: Total / Grave** cambia las tres matrices, los tres
radares, las fichas y la comparación de nuestro puntaje con necesidad de
recuperación temprana. Mantiene seis sectores de peso 1/6. No crea dos sectores
superpuestos ni suma grave y total. La selección no modifica los datos originales
del diagnóstico ni la estimación publicada de PNUD/UNGRD.

| Sector | Total | Grave |
|---|---|---|
| Impacto humano | Fallecidos, desaparecidos y heridos; 1/3 cada campo | Fallecidos y desaparecidos; 1/2 cada campo |
| Vivienda | Destruidas y averiadas, de 3iS y PNUD; 1/4 cada campo | Destruidas de 3iS y PNUD; 1/2 cada campo |
| Salud, educación, infraestructura y acceso, servicios comunitarios | Sin cambios | Sin cambios |

**Familias afectadas sale del índice**, por la definición solicitada de impacto
humano, pero permanece en los datos originales del diagnóstico. Rescatados sigue
fuera. Total usa 16 campos; grave usa 13. En el relativo sectorial, 7 tipos de campo
del total y 4 del grave tienen denominador habilitado; su existencia por municipio
todavía debe verificarse. Los otros 9 siguen sin tasa.

## Fórmulas

Sea z el puntaje de cada campo normalizado por separado:

```
Absoluto: q = conteo original
Per cápita: q = conteo × 10.000 / población municipal
Relativo sectorial: q = conteo × factor / denominador homologado
z = 100 × q / máximo q comparable del ámbito y captura elegidos

H_total = (z_fallecidos + z_desaparecidos + z_heridos) / 3
H_grave = (z_fallecidos + z_desaparecidos) / 2
V_total = (z_destruidas_3iS + z_averiadas_3iS + z_destruidas_PNUD + z_averiadas_PNUD) / 4
V_grave = (z_destruidas_3iS + z_destruidas_PNUD) / 2
D = (H + V + Salud + Educación + Infraestructura + Comunidad) / 6
P = D × (1 + 0,25 × IPM_censal_2018 / 100) / 1,25
```

Si q es un cero explícito, z=0, incluso cuando todos los valores son cero. Si no
hay numerador o denominador válido, z es desconocido, no cero. Su peso se conserva:
se usa 0 solo como límite inferior y 100 como superior. No se redistribuye el peso
de un dato ausente. Cambiar a grave sí redefine de antemano el conjunto de campos,
independientemente de cuáles estén disponibles en cada municipio.

Grave y total son **promedios de intensidades normalizadas**, no sumas de víctimas
únicas ni porcentajes de daño. Grave puede superar a total: quitar heridos o
averiadas de intensidad baja eleva el promedio. No significa que haya más víctimas
graves que víctimas totales. Tampoco fallecidos y desaparecidos implican una
equivalencia clínica: es la agrupación analítica pedida. Deben mantenerse categorías
mutuamente excluyentes dentro de cada corte; no sumar estados de una misma persona
en capturas distintas. No se verificó deduplicación individual en los agregados.

Los dos canales de vivienda pueden compartir insumos. Se promedian sus puntajes,
**no se suman como viviendas diferentes**, y no constituyen validación independiente.
El máximo observado, las referencias cambiantes, el IPM censal y los límites por
faltantes conservan sus limitaciones; esta versión no valida el índice global.

## Qué era la tarjeta del 33,33%

Se eliminó `Cobertura ponderada mediana`. Calculaba, entre municipios con algún
componente puntuable de la vista, la mediana de:

```
cobertura municipal = 100 × (1/6) × suma_sector(suma_pesos de campos con puntaje válido)
```

El IPM no estaba incluido en esa cobertura sectorial. No era porcentaje de daño,
certeza, avance de recuperación ni porcentaje simple de columnas llenas. 33,33%
equivale a un tercio del peso sectorial conocido: por ejemplo, dos sectores completos,
o datos parciales repartidos entre más sectores. Se conserva la cobertura individual
para no esconder los faltantes; se quita la tarjeta agregada, no la evidencia.

## Viabilidad: salud con REPS / IPS

**Viable de forma condicionada**, usando sedes físicas comparables, no el número
de personas jurídicas IPS. [SISPRO distingue prestador y sede](https://sig.sispro.gov.co/sigmsp/Views/pg/prestadoresSedes/PRESTADORESSEDES.html):
sus códigos de habilitación tienen 10 y 12 caracteres respectivamente. Tampoco
se pueden contar los servicios habilitados de una sede como edificios diferentes.

La proporción propuesta es `100 × sedes afectadas únicas / sedes existentes
comparables antes del evento`. Debe homologarse: unidad física, cobertura pública
y privada, clase de prestador, nivel de atención, ubicación y fecha. Un cruce por
identificador sería preferible, pero una definición agregada oficialmente acreditada,
exhaustiva y consistente también puede servir. El registro debe conservar fecha,
fuente y consulta para reproducir el denominador.

La [auditoría previa del repositorio](denominadores_sectoriales.md) encontró 9
puntos afectados en Atrato y 3 sedes IPS REPS, y en San José del Palmar 1 afectado
y 2 sedes IPS, con corte REPS 12/03/2026. **No son conteos nuevamente descargados
en esta tarea.** El 9/3 indica una inconsistencia de universos pendiente de resolver,
no demuestra por sí solo qué fuente es incorrecta. No se habilita una tasa del 300%
ni se recorta al 100%. Se deja sin dato relativo.

Una proporción de establecimientos afectados tampoco estima directamente pacientes
sin atención: faltan capacidad, servicios, funcionamiento y alternativas de acceso.
Para capacidad perdida, se necesitarían numeradores y denominadores compatibles
de camas, consultas u otra capacidad, no solo edificios.

## Viabilidad: educación con SIMAT y DUE

Se interpreta «SIMAD» como **SIMAT**, Sistema Integrado de Matrícula. Si se refiere
a otro sistema, esta evaluación no aplica a ese otro sistema.

| Numerador | Denominador pertinente | Fuente candidata |
|---|---|---|
| Puntos / centros educativos afectados del modelo actual | Total de sedes educativas físicas comparables | DUE / SINEB, por código de sede y municipio |
| Matrícula afectada, si se incorporara como campo en otra revisión | Matrícula total del mismo universo | SIMAT / consolidado oficial MEN |

[SIMAT organiza la matrícula](https://www.mineducacion.gov.co/1780/w3-article-168883.html?_noredirect=1).
Es adecuado para una proporción de estudiantes, no para dividir edificios por
estudiantes y llamarlo porcentaje de infraestructura perdida. Un corte 2025
oficial, documentado y anterior al evento sería una línea base razonable de
matrícula, pero no el inventario exacto de 2026; deben reconocerse aperturas,
cierres y traslados. No se requiere información personal de estudiantes: bastan
agregados confiables por municipio o sede.

El [portal oficial SINEB ofrece bases distintas de matrícula, establecimientos y
sedes](https://portalsineb.mineducacion.gov.co/portal/secciones/Informacion-Estadistica/Bases-consolidadas/).
La página verificada el 11/09/2026 muestra enlaces a sedes y matrícula 2022; esto
**no acredita disponer de SIMAT 2025**. Las otras bases abiertas auditadas antes
contenían 2019 y 2021. La fecha de modificación del portal no actualiza el año
de las observaciones. Para usar 2025 debe obtenerse el consolidado oficial con
su corte y diccionario, del MEN o la secretaría correspondiente.

Antes de habilitar educación hay que confirmar que los puntos 3iS/PNUD representan
sedes (no bloques, aulas o instituciones administrativas), y si abarcan únicamente
preescolar, básica y media o también superior. El denominador debe tener ese mismo
alcance y sector oficial/privado. SIMAT/DUE no debe imponerse a un numerador que
incluya universidades sin separarlas.

## Decisión de esta rama

No se incorporan denominadores nuevos sin conciliación ni se completan municipios
sin base. Salud y educación sectoriales permanecen sin tasa; sus vistas absolutas
y per cápita siguen disponibles. El diagnóstico conserva todas las fuentes. Esta
nota actualiza las definiciones activas; los documentos 1.2 se conservan como
antecedentes históricos.
