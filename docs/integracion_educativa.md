# Integración educativa municipal

Esta etapa vive en `cepal-integracion-educativa`, hija de
`cepal-capitulo-2-priorizacion-municipal` en `5770524`. No sustituye `main` ni
despliega producción. Fuentes contrastadas con `educacion-matricula-critica`
en `25c13842159a57d8fbeffb8a5ac8b51d96e14a6b`.

## Qué cambia al consultar el tablero

1. Seleccionar una captura desde **2026-09-21**: Educación incluye matrícula
   en sedes críticas MEN en los tres modos del índice.
2. Elegir **Cinco departamentos · 126 municipios** para Caldas, Chocó, Quindío,
   Risaralda y Valle del Cauca. El listado territorial permanece completo;
   los cinco municipios sin MEN conservan esa variable desconocida.
3. Abrir la ficha municipal y desplegar **Educación · MEN** para contrastar
   condición física y servicio reportado.
4. En **Fuentes y método → Educación: cobertura y servicio reportado** se
   consultan agregados, faltantes, contexto de las otras bases y la descarga JSON.
   En Diagnóstico territorial, fuente MEN, se pueden descargar los indicadores CSV.

## Versiones y fórmula propia

Hasta 2026-09-20 inclusive se conserva exactamente el modelo `1.2-RS`, con
9 campos puntuados y 10 visibles. Desde 2026-09-21 se activa
`1.2-RS+MEN-20260921`, con 10 campos puntuados y 11 visibles:

`Educación = 0,5 × z(centros afectados) + 0,5 × z(matrícula en sedes críticas)`.

Educación sigue pesando 1/5 del índice. Los demás sectores, la cascada PNUD→3iS,
familias informativas, pesos de vivienda y ajuste IPM permanecen iguales. Los
faltantes mantienen su parte del intervalo: no se redistribuye el peso entre
variables disponibles. Los ceros MEN solo existen donde hay reporte municipal
con clasificación y matrícula suficientes.

En absoluto se normaliza matrícula crítica por su máximo municipal en el ámbito.
En per cápita y relativo sectorial se usa matrícula crítica por 10.000 habitantes
DANE del año de la captura y luego su máximo comparable. Esto expresa carga
territorial, **no porcentaje de estudiantes afectados**: falta un denominador
homologado de matrícula preevento. Los centros afectados conservan el cociente
contra SIMAT 2022 y su tope de 1 en el modo sectorial. Ese tope no se aplica a
la nueva variable poblacional.

El 50/50 y estas normalizaciones son decisiones de producto revisables, no pesos
prescritos por CEPAL. El índice físico y social tiene utilidad propia; la falta
de una valoración monetaria no lo invalida. Un salto entre ambos modelos no
prueba empeoramiento o recuperación. Cambiar el ámbito cambia los máximos;
filtrar departamento o buscar no cambia referencias ni puestos globales.

## Vigencia de MEN y significado de los datos

Se usa `men_sedes_escolares_afectadas_20260921.xlsx`, hoja `Sheet1`. El 21 de
septiembre se infiere del nombre del archivo y se adopta como fecha de vigencia
de esta versión. No acredita cuándo se inspeccionó cada sede, la fecha de la
matrícula ni cuándo se recibió efectivamente el archivo. La misma entrega
permanece visible en las capturas posteriores, con su fecha de archivo separada.
No se genera una tendencia diaria MEN ni se inserta en capturas anteriores.

Se cruza municipio por la columna D (DIVIPOLA), institución por F y sede por J.
La matrícula total está en AM, daño en AP y servicio en AX. No se deduce municipio
del prefijo del código de sede. Se valida sector oficial y unicidad de sede.
Crítica comprende colapso total, colapso parcial y riesgo inminente de colapso.
No acredita que toda esa condición fuera causada por el terremoto.

Matrícula en una sede crítica no equivale a persona única, alumno sin clase ni
beneficiario pendiente. La fuente tiene **987 de 1.010 sedes críticas que reportan
prestar servicio**, con 184.180 matrículas. El dato de servicio tampoco acredita
normalidad, calidad, jornada completa o reparación concluida. No hay horas/días
lectivos perdidos verificables ni valoración monetaria de pérdidas educativas.

## Cobertura comprobada

| Fuente / universo interno | Registros y unidades | Alcance y límites |
| --- | --- | --- |
| MEN nacional reportado | 5.537 sedes únicas; 1.962 instituciones; 1.275.259 matrículas | 434 municipios, 16 departamentos; 1.010 sedes críticas y 187.505 matrículas críticas. Sin códigos de sede duplicados ni matrícula total faltante. |
| MEN en cinco departamentos | 3.113 sedes; 825 instituciones; 570.091 matrículas | 121/126 municipios (96,03 % de presencia territorial); 744 sedes críticas y 149.471 matrículas críticas. No es porcentaje de todas las sedes o personas afectadas. |
| ICBF, primera infancia | 3.448 UDS únicas; 79.676 beneficiarios reportados en 3.274 UDS | 73 municipios. Faltan beneficiarios en 174 UDS de Chocó; 304 UDS sin clasificación de daño. 34 conteos estaban guardados como texto entero y se normalizan. |
| Pereira/Dosquebradas, afectadas | 172 sedes únicas; 67.324 matrículas reportadas | Las 172 aparecen en MEN. Difieren 84 clasificaciones de daño y 148 matrículas. MEN registra 62.286 matrículas para esas mismas sedes. |
| Pereira, fuente única | 102 filas, 101 códigos presentes, 63 códigos institucionales únicos | Son instituciones, no 63 sedes. La matrícula institucional repetida por fila no se suma. Requiere concordancia institución-sede. |
| Fundación PLAN | 16 intervenciones reportadas, 12 sedes únicas, 4 municipios | Las 12 sedes están en MEN. No acredita ejecución ni número efectivo de beneficiarios. |

Sin reporte MEN en el ámbito: Acandí (27006), Nuquí (27495), San José del Palmar
(27660), Balboa, Risaralda (66075), y Mistrató (66456). Se preserva la evidencia
de otras fuentes; no se retira el municipio ni se inventa un cero MEN.

Servicio MEN nacional: 5.458 sedes reportan prestar servicio, 28 no prestarlo y
51 quedan por confirmar. Se muestra cada estado separado de condición crítica.

ICBF usa UDS, no sedes escolares; no existe llave homologada para sumarlo a MEN.
Sus otras hojas administrativas, infancia/adolescencia, SRD y nutrición no se
suman a primera infancia. En particular, los 2.054 cupos de 33 fichas SRD son
capacidad, no beneficiarios atendidos. En Pereira/Dosquebradas la hoja de
proyecto tiene 35 registros y 20 códigos: tampoco se añade al listado afectado.
Las otras cuatro bases no tienen fecha efectiva acreditada y se ofrecen como
contexto fuera del índice y su historia, incluso al consultar capturas antiguas.

No se puede calcular con estas bases la cobertura exhaustiva de sedes,
instituciones, matrícula o personas afectadas: faltan inventarios preevento
homologados por unidad, fecha, sector oficial/no oficial y geografía. El ámbito
de 126 municipios sí es un denominador territorial explícito. La comparación
con ExE no se usa como denominador universal ni como votos independientes.

## Relación con el manual CEPAL leído

Manual para la Evaluación de Desastres, LC/L.3691, febrero de 2014, capítulo IV,
Educación, páginas impresas 59–65 (PDF 60–66). Distingue inventario e infraestructura,
matrícula y docentes, alteraciones del servicio, pérdidas que pueden expresarse
en horas o días lectivos y costos temporales de continuidad. Restablecer clases
no equivale a haber reconstruido infraestructura. La integración aplica esa
separación conceptual, no afirma haber completado su evaluación sectorial.

El capítulo II sustenta separar captura, observación, periodos, base previa y
conceptos; el primer reporte posterior al desastre no se transforma en línea
base. Quedan pendientes inventario preevento homologado, atribución causal por
sede, áreas y precios locales de reposición, duración de interrupciones,
calidad/jornada, docentes y costos adicionales efectivamente ejecutados. No se
fabricaron valores monetarios, costes unitarios, personas únicas ni horas perdidas.

## Reproducción y privacidad

Los originales se mantienen fuera de esta rama. Solo se publican agregados
municipales y metadatos de procedencia con SHA-256, sin nombres, contactos,
observaciones personales ni filas de menores. La descarga mantiene filtros,
versión del modelo, fecha de archivo y fecha de observación desconocida.

```sh
python scripts/preparar_educacion_men.py /ruta/men_sedes_escolares_afectadas_20260921.xlsx
python scripts/preparar_contexto_educativo.py /carpeta/privada/con/las/cinco/bases
python generar_tablero_recuperacion.py
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.js
node tests/educacion_men.browser.cjs
node tests/cepal.browser.cjs
```

Las pruebas de navegador requieren Playwright y Chromium; aceptan `CHROME_PATH`.
La regresión histórica compara el motor real de la rama padre y todos los datos
anteriores al corte en ambos ámbitos originales y los tres modos. La prueba
CEPAL conserva separadamente la regresión de la etapa del capítulo II contra
`main`, desactivando MEN para esa comparación.
