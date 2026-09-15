# Aplicación experimental: Salud relativa con urgencias + ML

Rama: `salud-relativa-urgencias-ml`, creada desde `salud-relativa-consulta-externa` en el commit `acc6bf777f27c0c08b93352b9029ff1ed94f788c`.

## Qué cambia

Sólo el componente Salud del índice relativo sectorial, su tercera matriz, su radar y la comparación del índice relativo con necesidad de recuperación temprana. La estética, las pestañas, las vistas absoluta/per cápita, las otras cinco dimensiones y los daños originales no cambian. Main y la rama de partida se conservan.

El denominador pasa a **consultorios de urgencias**, no consultas atendidas, camas ni sedes IPS. Los 901 registros municipales observados del REPS conservan su valor. En ausencia de registro se añaden 203 estimaciones experimentales con soporte mínimo. Los otros 18 faltantes permanecen sin dato.

No se mezclan denominadores de consulta externa y urgencias en la misma puntuación. Las bases de consulta externa del padre se conservan como datos, pero no se usan en Salud en esta rama.

## Fórmula

```
B_m = consultorios de urgencias REPS 2022, cuando hay un registro válido
      estimación Poisson, sólo si falta el registro y pasa los controles
      sin dato, en cualquier otro caso

presión_m = centros afectados PNUD_m / B_m
Salud_m = 100 × presión_m / máxima presión comparable del ámbito seleccionado
D_m = (Impacto humano + Vivienda + Salud + Educación + Infraestructura + Comunidad) / 6
P_m = D_m × (1 + 0,25 × IPM_2018_m / 100) / 1,25
```

Salud utiliza únicamente PNUD, con peso interno 1. No se rellenan daños faltantes con 3iS ni con ML. La selección total/grave no cambia los campos de Salud; modifica impacto humano y vivienda como antes.

El máximo de urgencias sigue siendo 16 puntos afectados por consultorio en Trujillo para el corte auditado. Agregar estas predicciones no cambió ese máximo. Por ello los puntajes de quienes ya tenían denominador de urgencias permanecen iguales, aunque su posición puede bajar cuando otros municipios entran con mayor puntaje.

## Resultado en departamentos del decreto

Captura: 2026-09-11. Gravedad total. Universo: 509 municipios; comparación UNGRD: los mismos 286 pares en las tres versiones.

| Versión | Municipios con Salud calculable | R² con puntaje UNGRD | Spearman |
|---|---:|---:|---:|
| Consulta externa, rama padre | 463 | 0,3419 | 0,7709 |
| Urgencias, sin ML | 393 | 0,3779 | 0,7807 |
| Urgencias + ML | 463 | 0,377 | 0,7712 |

70 municipios reciben Salud calculable por ML: 17 tienen afectación PNUD positiva y 53 tienen cero explícito. No significa que 70 municipios aumenten su puntaje. En estos últimos se reduce la falta de información del escenario, sin inventar un daño positivo.

El R² con UNGRD no es la validación predictiva del ML. Mide asociación de dos índices que pueden compartir información y no prueba exactitud o causalidad. La ampliación de cobertura no mejora automáticamente esta asociación.

En gravedad grave, el R² con UNGRD pasa de 0,2251 sin ML a 0,2368 con ML. Los mismos 286 pares. El modelo no fue entrenado para maximizar esos R².

### Primeros cinco del escenario, gravedad total

| Municipio | Puntaje con ML | Puesto urgencias sin ML | Puesto con ML | Base ML |
|---|---:|---:|---:|---|
| Trujillo, Valle del Cauca | 23,2 | 1 | 1 | No |
| Bagadó, Chocó | 16,58 | 3 | 2 | Sí |
| Atrato, Chocó | 15,82 | 20 | 3 | Sí |
| Tadó, Chocó | 15,06 | 2 | 4 | No |
| Sipí, Chocó | 13,55 | 4 | 5 | No |

### Atrato, ejemplo completo

- Centros afectados según PNUD: 9.
- Consultorios de urgencias observados: sin registro utilizable.
- Denominador ML del escenario: 1, condicionado a existencia de capacidad positiva.
- Presión: 9 / 1 = 9.
- Salud: 100 × 9 / 16 = 56,25.
- Incremento en D: 56,25 / 6 = 9,375.
- IPM: 61,5; factor = (1 + 0,25 × 61,5/100) / 1,25 = 0,923.
- Incremento en P: 9,375 × 0,923 = 8,653125.
- P total: 7,1686097938 → 15,8217347938; puesto 20 → 3, comparando urgencias sin ML con urgencias + ML.

La rama padre de **consulta externa** daba a Atrato 22,5519431271 y puesto 1: no confundir ese cambio de denominador con el efecto de aplicar ML.

**El modelo NO confirmó que Atrato tenga un consultorio de urgencias.** Esa es una estimación dentro de un escenario condicionado a existencia del servicio.

## Por qué urgencias es prometedor, pero no ganador definitivo

En la validación geográfica exploratoria de capacidades positivas, urgencias obtuvo menor error proporcional que los otros dos objetivos. Se eligió Poisson regularizado. En municipios de menos de 50.000 habitantes, su MAE fue 0,4114 consultorios. Comparar errores absolutos entre camas y consultorios no demuestra superioridad porque las unidades y las muestras difieren.

Además, 192 de las 221 predicciones brutas de urgencias quedaron en el piso de 1. Esa restricción es coherente con el ensayo de positivos, pero no valida la existencia del servicio cuando no aparece en el registro. La fuente registra capacidad en 2022 y los predictores incluyen población proyectada 2026 e IPM 2018. No se ha validado capacidad operativa 2026.

Puntos afectados / consultorios es presión relativa sobre una capacidad, no porcentaje de consultorios destruidos. Los puntos PNUD no están identificados uno a uno como consultorios de urgencias.

## Trazabilidad y protección de datos observados

- Los observados permanecen en `denominators.rows` con `verified_historical`.
- Las estimaciones están separadas en `health_imputations`, con `estimated_ml`, fecha de estimación, modelo, soporte y procedencia.
- Se requiere activación explícita de `health_variant.ml.enabled`.
- Sólo se permite PNUD Salud y urgencias. No se imputan otros sectores.
- Un registro existente tiene precedencia, incluso si es inválido: no se tapa un conflicto ni un cero con una predicción positiva.
- Se rechazan duplicados, bases menores que 1, falta de soporte, unidades/modelos incompatibles y falta de procedencia.
- El escenario no extiende silenciosamente los predictores 2026 a otras anualidades.
- Las tarjetas y fichas marcan “Base estimada ML”. Las coberturas distinguen cálculo con ML de evidencia sin ML.

Los límites inferior/superior del tablero siguen representando variables faltantes. **No incluyen el error predictivo del ML, la posibilidad de capacidad realmente cero ni el cambio 2022–2026.** No son intervalos de confianza; no se utilizó la banda descriptiva del ensayo para aparentar cobertura estadística.

El CSV original de estimaciones conserva su carácter exploratorio. La activación del escenario se registra separadamente en el JSON de denominadores y en esta documentación.

## Archivos

- `index.html`: tablero listo para abrir en esta rama.
- `data/denominadores_sectoriales.json`: observados y estimaciones separados.
- `data/salud_capacidad_reps_2022.json`: detalle REPS de urgencias, con agregados reproducibles.
- `experimentos/ml_salud/impacto_aplicacion_urgencias.json`: resultados comparativos de total/grave y decreto/todos.
- `experimentos/ml_salud/cambios_ranking_urgencias.csv`: cambios municipio a municipio.
- `docs/ML_SALUD.md` y `validacion_ml.html`: validación fuera de muestra original. No representan un entrenamiento nuevo.
- `auditoria_salud_relativa.html`: se conserva la auditoría original de las tres bases observadas; no se presenta como auditoría del escenario imputado.

Reproducción, sin red ni nuevo entrenamiento:

```powershell
node scripts/aplicar_ml_urgencias.cjs
python generar_tablero_recuperacion.py
node --test tests/salud_urgencias_ml.test.js tests/salud_relativa.test.js tests/salud_relativa_pnud.test.js
```

Esta rama no se añadió a los flujos automáticos de publicación. Las bases/modelo quedan congelados hasta una revisión explícita. No se fusionó a main.

La verificación de esta entrega usa JavaScript V8 y pruebas en memoria; el entorno local no permitió ejecutar Python ni abrir navegador por el fallo de permisos ya observado. No se afirma validación visual en navegador.
