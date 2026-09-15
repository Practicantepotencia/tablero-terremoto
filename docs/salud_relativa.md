# Salud relativa: Consulta externa

Propuesta experimental publicada en `salud-relativa-consulta-externa`, sobre `impacto-grave-total` (beefea8362b5ef05b850085c36a788fda83d31fe).
Solo modifica Salud en la tercera matriz, tercer radar y agregados relativos dependientes. Absoluto, per cápita, pesos, IPM, severidad total/grave, otras dimensiones, capturas y diseño se conservan.

## Denominador de esta rama

**Consultorios de consulta externa**. Se suman exclusivamente los registros REPS del grupo **CONSULTORIOS**, descripción **Consulta Externa**. No se suman sedes, prestadores, camillas, salas, ambulancias ni otras categorías a esta capacidad.

Base observada: **2022-11-05**, no 2026. 1106 territorios DIVIPOLA con una base positiva; 14532 registros de capacidad aceptados. Es capacidad registrada, pública y privada, no demostración de capacidad operativa al momento del sismo. Las áreas no municipalizadas de la base DANE se distinguen por su código, sin atribuirlas a la cabecera.

## Procedencia y verificación

- [Publicación oficial del Ministerio de Salud, conjunto s2ru-bqt6](https://www.datos.gov.co/Salud-y-Protecci-n-Social/Relaci-n-de-IPS-p-blicas-y-privadas-seg-n-el-nivel/s2ru-bqt6/about_data).
- [API oficial consultada para corroborar esquema y corte](https://www.datos.gov.co/resource/s2ru-bqt6.json).
- [Extracto completo utilizado, fijado a un commit inmutable](https://github.com/edgardhdz07/prueba-tecnica-datos-salud/blob/95f33af6ab50e09bef92bb7872eb7246b3c23529/data/Relaci%C3%B3n_de_IPS_p%C3%BAblicas_y_privadas_seg%C3%BAn_el_nivel_de_atenci%C3%B3n_y_capacidad_instalada_20260226.csv).
- Commit del espejo: `95f33af6ab50e09bef92bb7872eb7246b3c23529`, disponible el **2026-02-28**, antes del evento. Esa fecha acredita disponibilidad, no una nueva medición.
- SHA-256 del CSV original UTF-8: `d50fbbce6a0ffff914b9e717a2d3109d57264ab67dbf444cfd86d410af69ea3f`.
- El nombre del CSV termina en 20260226: es una fecha de extracción; todos los registros utilizados declaran el corte de noviembre de 2022.
- Se pudo corroborar el origen, esquema y fecha en la API; el archivo completo se obtuvo del espejo, no mediante una descarga completa independiente del portal oficial. No se afirma haber validado cada establecimiento ni su funcionamiento en 2026.
- `data/salud_capacidad_reps_2022.json` contiene solo capacidad, códigos de sede y trazabilidad. Se excluyen nombres de responsables, correos, teléfonos, direcciones y otros contactos del CSV.
- `record` y `records` son ordinales de registro CSV, contando la cabecera como 1; no números de línea física, porque hay campos multilínea.

## Fórmula sin cambiar el modelo general

Para municipio m y cada fuente j (3iS o PNUD):

```text
q[m,j] = puntos o centros afectados[m,j] / capacidad histórica[m]
z[m,j] = 100 × q[m,j] / máximo(q[*,j]) en la referencia seleccionada
Salud inferior = 0,5 × z[m,3iS] + 0,5 × z[m,PNUD]
```

Cada máximo mantiene fuente, indicador, unidad y captura separados. El filtro decreto/todos recalcula la referencia; búsqueda y departamento no recalibran. Si toda la referencia válida es cero, el puntaje de los ceros explícitos es cero. Los dos canales mantienen su peso original; no se suman los conteos ni se consideran evidencia independiente.

La unidad mostrada es **puntos/consultorio externo**, nunca porcentaje. Un cociente superior a 1 es admisible porque numerador y denominador son unidades distintas. El puntaje normalizado 0–100 compara cocientes; **100 no significa pérdida del 100% de la atención**.

Sin denominador positivo, único, con código y fecha verificables: **sin dato relativo**. Tampoco se imputan denominadores por población, promedio, presupuesto o predicción. El cero en el límite inferior de un dato desconocido sigue siendo un límite, no un dato observado. Salud mantiene el peso sectorial 1/6, incluso cuando falta; los otros sectores y el ajuste IPM no cambian.

## Ejemplos reproducibles

Departamentos del decreto; captura **2026-09-11**; impacto total.

| Municipio | Afectados 3iS / PNUD | Denominador | Cociente 3iS / PNUD | Salud /100 |
|---|---:|---:|---:|---:|
| Atrato | 9 / 9 | 2 | 4.5000 / 4.5000 | 100.0000 |
| San José Del Palmar | 1 / 1 | 1 | 1.0000 / 1.0000 | 22.2222 |
| Pereira | 34 / 34 | 1035 | 0.0329 / 0.0329 | 0.7300 |
| Santiago de Cali | 10 / 10 | 4866 | 0.0021 / 0.0021 | 0.0457 |
| Armenia | 9 / 5 | 581 | 0.0155 / 0.0086 | 0.2677 |

Estos resultados no resuelven la correspondencia nominal de los 9 puntos afectados de Atrato. La ausencia de base de urgencias, por ejemplo, no demuestra ausencia de servicios.

## Comparación de cobertura

| Propuesta | Rama | Al menos una fuente calculable | Ambas fuentes calculables |
|---|---|---:|---:|
| Consulta externa | `salud-relativa-consulta-externa` | 463/509 | 87/509 |
| Urgencias | `salud-relativa-urgencias` | 393/509 | 77/509 |
| Hospitalización general | `salud-relativa-hospitalizacion` | 391/509 | 82/509 |

Las tres propuestas comparten el mismo registro y sus limitaciones. No son tres fuentes independientes. Comparar los rankings requiere atender también a cobertura y faltantes: un municipio no debe interpretarse como menos necesitado solo por carecer de denominador.

## Utilidad y límites

Se aproxima a presión sobre atención ambulatoria y tiene la cobertura más amplia. Un consultorio especializado privado no necesariamente sustituye atención primaria; tampoco se conocen jornadas, personal ni distribución rural.



La antigüedad de cuatro años, el carácter registral, los tamaños y funciones diferentes de los puntos afectados, y la atención que cruza fronteras municipales impiden llamarlo porcentaje de capacidad perdida. El máximo observado hace que valores extremos condicionen la escala del sector, como en el modelo preexistente; no se cambió esa normalización por estar fuera del alcance. Son escenarios para comparar, no una validación definitiva de prioridad sanitaria.

## Reproducción

Descargar el CSV original del enlace inmutable anterior, sin abrirlo y volver a guardarlo con Excel, y ejecutar en esta rama:

```sh
node scripts/preparar_salud_relativa.cjs RUTA_AL_CSV_ORIGINAL
python generar_tablero_recuperacion.py --eda-redirect index.html
node --test tests/priorizacion.test.js tests/salud_relativa.test.js
node tests/salud_relativa_aislamiento.cjs
```

El preparador verifica el SHA-256 antes de escribir, extrae el municipio del código de **sede**, valida nombres contra DANE con equivalencias explícitas, suma capacidad por categoría, deduplica copias idénticas y excluye el municipio si hay conflictos. La invocación mostrada del generador conserva el historial y evita escribir el HTML de redirección del EDA. No utilizar --update-history ni actualizar otras fuentes como parte de esta propuesta.

Pruebas realizadas antes de publicar: 25 regresiones originales (15 de priorización y 10 de relativización); 24 pruebas de salud/agregación entre las tres variantes; 180 comprobaciones de aislamiento (cinco capturas, dos ámbitos, dos severidades, tres variantes); renderizado por harness DOM para comprobar que absoluto y per cápita no cambian y que la nota se muestra una sola vez. Se comprobó sintaxis de los ocho scripts embebidos y conservación de todo el historial. Se ejecutaron en V8; el terminal/Node/Python y el navegador real local no estuvieron disponibles. Resultados en `docs/verificacion_salud_relativa.json`.

No se modificó `main`, ninguna otra rama existente ni la publicación de GitHub Pages.
