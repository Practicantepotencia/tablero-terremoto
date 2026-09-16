> Actualización de esta rama: se usa la [cascada PNUD → 3iS](cascada_pnud_3is.md) por variable, con **10 campos únicos** en cada índice. Salud relativa conserva heridos/capacidad. Los conteos de 14/13 campos de la descripción histórica inferior corresponden al estado anterior a esta actualización.

# Escenarios experimentales de presión sobre la atención

Base común: relativo-reps-simat-sin-comunitarios, commit 3f4550ee1dde564cba007e677c9f657278e99a72.
Main y el sitio de producción no se modifican. Son escenarios, no una metodología validada para decidir asignaciones por sí sola.

## Variante sin heridos en Impacto humano

Ramas hijas salud-presion-urgencias-sin-heridos-ih y salud-presion-hospitalizacion-sin-heridos-ih, cada una derivada de su escenario sanitario homónimo. El commit padre exacto está en data/presion_salud.json, human_impact_variant.parent_commit.

Se retira solo heridos de Impacto humano en los tres índices (absoluto, per cápita y relativo). Se conservan familias afectadas, fallecidos y desaparecidos, con peso interno 1/3 cada uno. No es la variante de gravedad estricta: no se retiran familias ni viviendas averiadas.

H = (z_familias + z_fallecidos + z_desaparecidos) / 3. Cada z usa la normalización y denominador propios de la vista. Los faltantes conservan su tercio como desconocido, no se redistribuye entre los disponibles. El peso del sector sigue siendo 1/5.

Heridos sigue alimentando Salud exclusivamente en el modelo relativo de presión; los componentes de Salud absoluto/per cápita conservan sus indicadores de infraestructura. Los reportes originales de heridos se mantienen en el inventario y el diagnóstico territorial. No se eliminan datos.

## Dos preguntas calculables con los datos municipales

- salud-presion-urgencias: heridos reportados por 3iS / consultorios de urgencias registrados en REPS, corte 5 de noviembre de 2022.
- salud-presion-hospitalizacion: los mismos heridos / camas generales adultas + pediátricas registradas en ese corte.

Ambas miden carga potencial acumulada del evento frente a infraestructura asistencial registrada históricamente. NO miden ocupación real, personas esperando atención, pacientes simultáneos, camas libres ni porcentaje de sedes dañadas. No se supone que todo herido requiera hospitalización. El lugar donde se reporta una lesión no prueba el lugar donde se atiende a la persona.

## Fórmulas

Para municipio m y captura t: q(m,t) = heridos_3iS(m,t) / capacidad_REPS2022(m).
Ancla a(t,U) = máximo de q válido en el universo U de la captura.
Salud = 100 × q/a; cero explícito de heridos con capacidad positiva produce cero. Si todos los q son cero, todos los puntajes conocidos son cero.
Falta de numerador, denominador ausente, nulo, cero, ambiguo o no verificable produce dato desconocido, nunca una capacidad estimada de 1.
Un denominador registrado como cero se conserva para auditoría, pero dividir por cero no produce un puntaje.
Cambiar todos/decreto recalcula ancla y ranking; buscar municipio y filtrar departamento no cambia el universo de referencia.

La tercera interfaz y tercer radar usan exactamente el mismo objeto calculado.
Su Salud pasa de dos canales de daños a un campo de carga, peso interno 1. Peso de Salud en el promedio global: 1/5, igual que antes.
D = suma de los cinco sectores / 5.
P = D × (1 + 0,25 × IPM2018/100) / 1,25.
Los campos faltantes siguen generando límites documentado/posible, no intervalos de confianza.

## Qué cambia y qué no

El escenario padre sustituye Salud por carga potencial en el relativo; esta variante hija retira heridos de Impacto humano y recalcula sus consecuencias en índices, rankings y radares.
En las ramas hijas, Impacto humano cambia en los tres modelos. Educación SIMAT, vivienda, infraestructura, Salud, IPM, fuentes originales, fechas del inventario y filtros conservan su cálculo respecto de cada padre. Cambian los índices globales, rankings y comparaciones derivados de Impacto humano. No se añaden pestañas ni nuevas opciones.
La cobertura cuenta 14 campos en absoluto/per cápita y 13 en el relativo de presión, donde Salud contiene un solo campo.
La explicación del escenario se añade en un único lugar, sobre la tercera interfaz. La ficha y radar mantienen la fórmula habitual con la nueva unidad.

## Limitaciones decisivas

1. **Heridos participa solo en Salud en el relativo de presión.** Se elimina su incorporación explícita a Impacto humano. Esto no demuestra independencia estadística entre dimensiones ni convierte el cociente en ocupación observada.
2. **2022 no es 2026.** El inventario histórico no acredita capacidad operativa al momento del sismo. No se llama capacidad actual.
3. No conocemos derivaciones, gravedad, duración de hospitalización, rotación, personal, equipamiento disponible ni demanda habitual. Los heridos acumulados son una aproximación a demanda adicional, no el flujo diario ni su causa única.
4. El máximo sigue condicionando la escala. Se conserva para aislar el cambio de variable y permitir comparación con el modelo actual, no porque esté validado clínicamente.
5. Los faltantes no son aleatorios. No deben leerse puntajes documentados bajos como baja necesidad cuando falta Salud.
6. Correlación con RAPIDA no valida presión asistencial; no se eligió el denominador por maximizar R².
7. REPS 2022 registra capacidades por sede. Se suman registros distintos del mismo recurso por DIVIPOLA; no se cuentan prestadores como si fueran consultorios o camas.

## Reproducibilidad

data/presion_salud.json contiene filas municipales, procedencia, IDs de registros que se suman y commit fuente.
scripts/reconstruir_capacidad_presion.py vuelve a descargar el extracto congelado y compara cada suma.
No se utilizan municipal_rows de estimaciones ML: se parte únicamente de records observados.
web/presion_salud.js valida identidad, fecha, unidad y unicidad antes de dividir.
scripts/auditar_presion_salud.cjs verifica ambos universos, fórmulas, coberturas y aislamiento frente al modelo base.
docs/verificacion_presion_salud.json contiene los resultados reales de cada rama.

## Fuentes

- Ministerio de Salud, REPS histórico: https://www.datos.gov.co/Salud-y-Protecci-n-Social/Relaci-n-de-IPS-p-blicas-y-privadas-seg-n-el-nivel/s2ru-bqt6/about_data
- Inventario de heridos de la rama base: indicadores_largo_no_calculo.csv y su historial, indicador 3is_heridos, fuente 3iS-Sheets.
- Tablero 3iS: https://docs.google.com/spreadsheets/d/1fQ-LTlIEljzOKvW23epwevJeWLWORi88xL7XxkpTMzY
- Presión operativa directa y obstáculos: docs/presion_operativa_fuentes.md.

## Comprobación de la variante

scripts/auditar_sin_heridos_ih.cjs compara contra el código del commit padre sobre los mismos datos: verifica igualdad exacta de los otros cuatro sectores en los tres modos, conservación de Salud y sus anclas, pesos 1/3, fórmulas, cobertura y ausencia de heridos en Impacto humano. Los resultados y movimientos de ranking se guardan en docs/verificacion_sin_heridos_ih.json. Main y ambas ramas padre permanecen intactas.
