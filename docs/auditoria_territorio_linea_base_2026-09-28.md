# Auditoría de delimitación territorial y línea base — 28 de septiembre de 2026

Captura auditada: 2026-09-28. Código: rama `claude/wonderful-gates-48x4n7`
(con `main` fusionado), modelo 1.2-RS. Cifras del universo del Decreto 1171
salvo que se diga otra cosa. Todas se obtuvieron ejecutando el código del
tablero (`web/priorizacion.js`, `generar_tablero_recuperacion.py`) sobre los
datos del repositorio.

## Resumen

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| T1 | `main` sigue con 15 identidades municipales sin código (509 en vez de 500, 5 críticos en vez de 6) | Alta | Corregido en la rama; falta fusionar |
| T2 | Bogotá entra al universo del decreto porque RAPIDA la etiqueta como Cundinamarca; el filtro usa el nombre del departamento de cada fila, no el código | Media | Abierto |
| T3 | El universo con puntaje es, en la práctica, la lista de PNUD: los 470 municipios con puntaje son exactamente los que tienen filas PNUD | Media (de comunicación) | Abierto |
| T4 | 47 municipios de los 12 departamentos no aparecen en ninguna fuente; no son ceros, son invisibles | Media (de comunicación) | Abierto |
| T5 | El Cairo contradice el decreto (80 % de viviendas destruidas según el decreto; 2,4 % en los datos) | Media (de verificación) | Abierto |
| T6 | Los faltantes de 3iS se tratan como desconocidos incluso donde el total departamental confirma que son cero | Media | Abierto |
| T7 | Daño fuera de los 12 departamentos: 60 municipios, 0,25 % del costo estimado | Baja | Sin acción |
| B1 | La capacidad hospitalaria (camas REPS 2022) solo se reconstruye desde otra rama (`salud-relativa-hospitalizacion`) | Media | Abierto |
| B2 | Población, viviendas y hogares 2026 no guardan el Excel original; reproducirlos exige que DANE siga sirviendo el mismo archivo | Media | Abierto |
| B3 | El denominador de vivienda incluye viviendas desocupadas (Ricaurte: 0,59 personas por vivienda) | Baja-Media | Abierto |
| B4 | En el índice relativo, salud solo se puede medir en 81 municipios (los que tienen heridos) | Media | Abierto |
| B5 | Educación relativa: 4 municipios con más centros afectados (PNUD) que sedes registradas (SIMAT 2022) | Baja | Documentado por el modelo (tope 1) |
| B6 | IPM DANE 2018 frente a IPM RAPIDA: r = 0,95; en Chocó difieren mucho, pero el top 20 no cambia con ninguno | Informativo | Sin acción |

## Parte 1. Delimitación del territorio

### T1. `main` frente a la rama

Mismos datos (captura 2026-09-28), dos versiones del código:

| | `main` | Rama |
|---|---|---|
| Identidades sin código DIVIPOLA | 15 | 0 |
| Universo del decreto | 509 | 500 |
| Con puntaje / sin puntaje | 470 / 39 | 470 / 30 |
| Municipios críticos (UNGRD) en la tarjeta de resumen | 5 | 6 |
| Nuevo Belén de Bajirá (per cápita / relativo) | fuera | 142.º / 377.º |
| Sotará (total / per cápita / relativo) | 122.º / fuera / fuera | 105.º / 102.º / 104.º |

Los primeros puestos de los tres índices son idénticos en ambas versiones.
`main` recibió 11 actualizaciones automáticas desde el 25 de septiembre, todas
de datos y HTML generado; ningún cambio de código. La rama ya las incorporó.

### T2. Bogotá dentro del universo

El Decreto 1171 no incluye a Bogotá (la bandera `en_decreto_1171` de
«Bogotá D.C.» vale 0). Pero RAPIDA publica el código 11001 con departamento
«Cundinamarca», y el filtro del decreto (`web/modelo.js`, `visible()`)
compara el nombre del departamento de cada fila. Resultado: Bogotá entra al
universo del decreto como municipio de Cundinamarca. Hoy no tiene puntaje
(es uno de los 30 sin datos de daño), pero cuenta en el universo.

Es el único caso: de todas las filas municipales con código, solo estas 24
de RAPIDA tienen un departamento que no coincide con el prefijo del código.

Arreglo propuesto: filtrar por el prefijo DIVIPOLA (los dos primeros dígitos)
cuando la fila tiene código, y por nombre solo cuando no lo tiene.

### T3. Qué define el universo

| Combinación de fuentes | Municipios |
|---|---|
| ExE + UNGRD + PNUD + RAPIDA | 133 |
| 3iS + ExE + UNGRD + PNUD + RAPIDA | 113 |
| ExE + UNGRD + PNUD | 84 |
| Solo PNUD | 41 |
| UNGRD + PNUD | 31 |
| ExE + PNUD | 25 |
| Otras | 73 |

- Los 470 municipios con puntaje son exactamente los que tienen filas PNUD.
  La delimitación efectiva es «lista PNUD ∩ departamentos del decreto».
- Los 30 sin puntaje entran por ExE, RAPIDA o la lista UNGRD, sin ningún dato
  de daño medible.
- 41 municipios con puntaje tienen límite inferior 0: todos sus datos son
  cero o desconocidos. Quedan empatados en el puesto 430.
- 436 municipios tienen algún daño positivo en PNUD o 3iS. El reporte
  preliminar 4 de la UNGRD (10 de agosto) contaba 330 municipios con
  afectación; la diferencia es esperable seis semanas después.

### T4. Municipios ausentes

| Departamento | Municipios DANE | En el universo |
|---|---|---|
| Antioquia | 125 | 122 |
| Caldas | 27 | 27 |
| Cauca | 42 | 42 |
| Chocó | 31 | 31 |
| Cundinamarca | 116 | 106 |
| Huila | 37 | 34 |
| Norte de Santander | 40 | 20 |
| Putumayo | 13 | 2 |
| Quindío | 12 | 12 |
| Risaralda | 14 | 14 |
| Tolima | 47 | 47 |
| Valle del Cauca | 42 | 42 |

47 municipios de los 12 departamentos no tienen ninguna fila. El tablero no
los muestra ni como cero ni como faltante. Conviene decirlo explícitamente en
la interfaz: «el universo son los municipios del decreto que aparecen en al
menos una fuente».

### T5. Contraste con el texto del decreto

El decreto (considerandos, páginas 4 y 5) nombra casos concretos:

| Municipio | Lo que dice el decreto | Lo que dicen los datos | Puesto total / per cápita / relativo |
|---|---|---|---|
| El Cairo | 80 % de la infraestructura habitacional destruida, hospital colapsado | 90 destruidas y 1.000 averiadas de 3.732 viviendas (2,4 % y 29 %); gravedad UNGRD 80 | 189 / 14 / 32 |
| Bajo Baudó | 1.500 viviendas afectadas, 4.300 familias damnificadas (preliminar) | 1.363 viviendas afectadas; 1.363 familias; gravedad UNGRD 0 | 17 / 87 / 166 |
| Versalles, Toro, Cartago, La Victoria, Roldanillo | Intensidad máxima 7 (SGC) | — | Relativo: 18, 16, 116, 63, 17 |

El Cairo es la discrepancia más grande. El decreto se basó en reportes del
primer día y los datos son de seis semanas después, así que no prueba un
error. Pero si el 80 % fuera cierto, El Cairo debería estar entre los
primeros del índice relativo, no en el 32. Vale la pena verificarlo con
la fuente.

En Bajo Baudó, las viviendas de 3iS son idénticas a las de PNUD (91 y 1.272)
y las familias de 3iS son la suma exacta (1.363). Confirma que las dos
fuentes no son independientes, como ya documenta `docs/cascada_pnud_3is.md`.

### T6. Desconocido frente a cero confirmado

3iS registra 333 fallecidos en 27 municipios, y sus totales departamentales
suman 335 (la cifra oficial). En los departamentos donde la suma municipal
coincide con el total departamental, un municipio sin fila no tiene
fallecidos según 3iS; hoy el modelo lo trata como desconocido y le abre el
intervalo hasta 100.

| Indicador | Departamentos que cierran | Sin total departamental | No cierran |
|---|---|---|---|
| Fallecidos | 5 | 5 | Antioquia (1), Cauca (1) |
| Desaparecidos | 3 | 7 | Antioquia (1), Tolima (1) |
| Colapsos | 4 | 8 | — |
| Acueductos | 4 | 4 | Antioquia, Cauca, Cundinamarca, Tolima |
| Vías | 5 | 3 | Antioquia, Cauca, Huila, Tolima |

Simulación: convertir en cero confirmado solo los faltantes de los
departamentos que cierran (398 celdas):

| Índice | Ancho medio del intervalo | Municipios completos | Top 20 |
|---|---|---|---|
| Total | 32,7 → 27,2 | 1 → 14 | sin cambios |
| Per cápita | 32,7 → 27,2 | 1 → 14 | sin cambios |
| Relativo | 49,0 → 44,2 | 0 → 0 | sin cambios |

El rango de posiciones posibles se estrecha mucho: Atrato pasa de 1–27 a
1–6; Quibdó, de 2–418 a 3–348. Es una regla conservadora (solo usa cierres
exactos) y trazable. Recomiendo implementarla con una marca «cero por cierre
departamental» visible en la interfaz.

### T7. Daño fuera de los 12 departamentos

El decreto declara el desastre en 12 departamentos «y demás afectados». Hay
60 municipios fuera de esos departamentos con daño positivo en PNUD: Bolívar
(6), Caquetá (14), Nariño (17), Santander (20) y Sucre (3). Suman 181
viviendas averiadas, 2 destruidas y $105 mil millones: el 0,25 % del costo
estimado total. Caquetá, Sucre y Bolívar están lejos del epicentro; parte de
esos registros podría no corresponder a este sismo. Excluirlos no cambia el
ranking.

### Anclas

Se repitió la prueba del 25 de septiembre: ampliar el universo de 500 a 620
municipios no cambia ninguna ancla ni ninguna posición. Los máximos están
todos dentro del decreto.

## Parte 2. Construcción de la línea base

### Inventario

| Base | Periodo | Uso | Cobertura del universo | Reproducible desde la rama |
|---|---|---|---|---|
| IPM censal DANE | 2018 | Vulnerabilidad | 499 de 500 (falta Nuevo Belén, posterior al censo) | Sí: Excel original en `data/originales/`, hash y test |
| Población DANE | proyección 2026 | Per cápita; impacto humano relativo | 500 de 500 | Solo en línea: hash guardado, sin Excel original |
| Viviendas DANE | proyección 2026 | Vivienda relativa | 500 de 500 | Solo en línea: hash guardado, sin Excel original |
| Camas REPS | 5 nov 2022 | Salud relativa (presión hospitalaria) | 77 de los 81 municipios con heridos | Solo desde otra rama (`salud-relativa-hospitalizacion`, commit `d9124b4`) |
| Sedes SIMAT | 2022 | Educación relativa | 469 municipios | Sí: CSV en `data/simat_sedes_2022.csv` con hash |
| Sedes IPS REPS | 12 mar 2026 | Sin uso en el modelo activo (salud usa camas) | — | Solo en línea |

Todas las fechas de referencia son anteriores al evento (10 de agosto de
2026); el código lo verifica en cada cálculo.

### B1 y B2. Reproducibilidad

El IPM ya no depende de otra rama. Quedan dos casos:

- **Camas REPS 2022.** `scripts/reconstruir_capacidad_presion.py` descarga el
  extracto desde `raw.githubusercontent.com` en el commit `d9124b4`, que solo
  está en la rama `salud-relativa-hospitalizacion`. Si esa rama se borra, el
  extracto se pierde. Arreglo: copiar `data/salud_capacidad_reps_2022.json` a
  la rama principal y leerlo localmente, igual que se hizo con el IPM.
- **Población, viviendas y hogares 2026.** Los scripts guardan el hash pero no
  el archivo. Si DANE publica una revisión, el script se detiene (bien), pero
  ya no hay forma de reconstruir la versión usada. Arreglo: guardar los tres
  Excel en `data/originales/` (unos pocos MB).

### B3. Viviendas ocupadas y desocupadas

El denominador de vivienda es el total de viviendas DANE, ocupadas y
desocupadas. La mediana es 2,42 personas por vivienda, pero hay municipios
turísticos con muchas viviendas vacías: Ricaurte 0,59, Manta 1,14, Tibirita
1,19. Ahí el porcentaje de viviendas afectadas se diluye. El propio decreto
usa viviendas ocupadas (Censo 2018). Alternativa: usar hogares DANE 2026, que
ya están en `data/denominadores_sectoriales.json`, como aproximación a
viviendas ocupadas.

Ningún municipio tiene más viviendas afectadas (PNUD) que viviendas DANE. El
máximo es 57,9 %.

### B4. Salud relativa

El sector salud del índice relativo usa heridos (3iS) sobre camas REPS 2022.
Solo 81 municipios tienen heridos; 77 de ellos tienen camas registradas. En los
otros cuatro (Unión Panamericana, Cértegui, Salento, Bahía Solano) no hay
camas y la presión queda desconocida. En los 389 municipios restantes, salud
es desconocida en el índice relativo, aunque PNUD sí reporta centros de salud
afectados en 162 municipios.

El código ya tiene la alternativa (centros de salud afectados sobre sedes IPS
REPS 2026, en `registryMeasure`), desactivada porque el escenario de presión
hospitalaria tiene prioridad. Vale la pena decidir explícitamente cuál de las
dos se publica.

### B5. Educación relativa

Centros educativos afectados (PNUD) sobre sedes registradas (SIMAT 2022). Seis
municipios llegan al tope (100) y cuatro lo superan: Alcalá 25/17, Buenavista
13/11, Risaralda 29/28, Girardota 39/37. «Centro» (PNUD) y «sede» (SIMAT) no
son la misma unidad, y SIMAT es de 2022. El modelo ya marca el cociente mayor
que uno y lo recorta a 100; conviene mostrarlo como «posible diferencia de
unidades» y no como pérdida total.

### B6. Qué IPM usar

El IPM DANE 2018 y el IPM de RAPIDA (proyección PNUD) coinciden en 301
municipios con r = 0,95, lo que confirma que el cruce por código es correcto.
En Chocó difieren mucho: Atrato 61,5 frente a 24,5; Río Quito 66,8 frente a
29,7. Aun así, recalcular los tres índices con el IPM de RAPIDA deja los top 20
idénticos y los mismos primeros lugares. La elección del IPM no es una fuente
de fragilidad del ranking.

## Recomendaciones, en orden

1. Fusionar la rama en `main` (T1).
2. Filtrar el decreto por código DIVIPOLA (T2).
3. Implementar el cero por cierre departamental en 3iS (T6).
4. Guardar los originales de población, viviendas, hogares y camas en
   `data/originales/` (B1, B2).
5. Explicar en la interfaz qué es el universo y qué municipios quedan fuera (T3, T4).
6. Verificar El Cairo con la fuente (T5).
7. Decidir entre viviendas totales y hogares como base de vivienda (B3), y
   entre presión hospitalaria y centros de salud como base de salud (B4).
