# Una sola observación por variable: PNUD → 3iS

Aplicado a las tres versiones del índice en las ramas de presión asistencial sin heridos en Impacto humano. No cambia las fuentes originales, no descarga otro corte ni altera main.

## Correspondencias declaradas

| Concepto | Preferida PNUD | Respaldo 3iS | Peso interno |
|---|---|---|---|
| Viviendas destruidas | pnud_vd | 3is_vivdestruidas | 1/2 de Vivienda |
| Viviendas averiadas | pnud_va | 3is_vivaveriadas | 1/2 de Vivienda |
| Centros/puntos de salud afectados | pnud_csalud | 3is_salud | 1 de Salud, solo absoluto/per cápita |
| Centros/puntos educativos afectados | pnud_cedu | 3is_educativos | 1 de Educación |

En Salud relativa se conserva exclusivamente 3is_heridos / capacidad REPS (consultorios de urgencias o camas generales según la rama). No se sustituye por daños de edificios. Impacto humano sigue con familias, fallecidos y desaparecidos a 1/3; Infraestructura no cambia.

## Orden de operaciones

1. Delimitar municipio, ámbito y captura. No se rescatan datos de capturas anteriores.
2. Verificar unidad Número, identidad de indicador/fuente y definición coherente dentro de cada fuente.
3. Elegir PNUD si tiene un número finito no negativo y sin conflicto. Cero es válido, aunque 3iS publique un valor mayor.
4. Si PNUD está ausente o no es utilizable por validación/conflicto, elegir 3iS válido. Duplicados idénticos cuentan una sola vez. Si ninguno sirve, desconocido.
5. Aplicar el denominador de la vista al dato elegido. Un denominador ausente o ratio rechazado no activa cambio de fuente oportunista.
6. Normalizar con el máximo de los valores/tasas ya seleccionados de ese mismo concepto, ámbito y captura. El ancla es común a la variable, no una escala independiente por fuente.
7. Promediar variables únicas con pesos fijos. Mantener los cinco sectores a 1/5 y el ajuste IPM existente.

x = PNUD válido; de lo contrario 3iS válido; de lo contrario sin dato.
z = 100 × x / máximo x (o las tasas respectivas en per cápita/relativo).
Vivienda = (z_destruidas + z_averiadas) / 2.
Salud absoluta/per cápita = z_centros_salud.
Educación = z_centros_educativos.

Hay 10 campos en cada modelo, no 14/13 canales de fuente. La cobertura se cuenta por variable única; dos fuentes para la misma variable ya no equivalen a dos campos disponibles. Los faltantes mantienen su peso como incertidumbre, no se redistribuye entre lo disponible.

## Trazabilidad y límites

La fila original conserva identificador, fuente, captura y valor. La ficha, radar y tarjeta muestran la fuente elegida. El diagnóstico territorial sigue permitiendo consultar ambos registros originales.

Las correspondencias se basan en el catálogo existente de conteos de viviendas/centros afectados. No demuestran independencia, igualdad de corte efectivo o conciliación nominal de puntos y centros entre fuentes. Se evita la doble ponderación; persiste una serie de origen mixto cuando entra el respaldo. La preferencia PNUD es la política solicitada, no prueba automática de mejor calidad o actualidad. No se añaden costos, RAPIDA, Naboo o ExE a esta cascada.

Pruebas: ceros, ausencias, conflictos, unidades incompatibles, capturas, prioridad de fuente, denominadores, ancla común y fórmulas. Auditoría contra commit previo y mismos datos: docs/verificacion_cascada.json.
