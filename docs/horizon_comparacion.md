# Horizon y el tablero de recuperación

## Recomendación

Conviene integrar módulos de Horizon de forma gradual. Su mayor aporte es conectar el diagnóstico municipal con alojamientos, abastecimiento y seguimiento de intervenciones. El tablero de recuperación aporta una base más preparada para actualizar datos, comparar fuentes y conservar capturas. La integración debería unir esas capacidades mediante registros comunes y mantener explícito qué mide cada indicador.

Esta rama incorpora `Horizon_Reconstruccion.html` como copia idéntica del archivo recibido. `index.html` conserva el tablero de `reestructuracion-recuperacion`. La evaluación propone una integración; no implementa todavía un sistema único. Las nuevas fuentes de `fuentes-nuevas` no forman parte de esta rama base.

## Qué contiene cada tablero

| Aspecto | Horizon | Recuperación |
| --- | --- | --- |
| Navegación | 28 entradas, agrupadas por funciones | 3 pestañas operativas |
| Universo | 412 códigos municipales en el maestro | 646 identidades municipales en la captura del 9 de septiembre; 301 con recuperación RAPIDA |
| Orden territorial | Cinco criterios independientes: población, pérdida anual esperada, riesgo integral, vivienda vulnerable y MMI máxima | Valor de recuperación RAPIDA; diagnóstico separado por fuente e indicador |
| Trabajo operativo | Alojamientos, EDAN, proyecciones, fondos y formularios | Diagnóstico, cobertura, fuentes e historial de capturas |
| Actualización | Tablas y resultados incrustados en el HTML | Importadores Python y flujo de GitHub Actions |
| Registro de campo | Demostración en memoria del navegador | No ofrece un sistema de captura en terreno |

Hay 296 códigos de Horizon que coinciden exactamente con los códigos municipales del inventario actual. Los otros 116 necesitan revisar cobertura y correspondencias; esa diferencia no demuestra que los territorios estén ausentes de todas las fuentes. Parte del inventario usa nombres sin DIVIPOLA. Se debe completar una referencia geográfica común antes de combinar fichas.

## Ventajas de Horizon

El comparador muestra cómo cambia el orden municipal al cambiar la pregunta. Esto es útil para discutir prioridades sin esconder decisiones en un promedio. La matriz de coincidencias permite identificar cuánto se parecen dos listas y la ficha municipal reúne exposición, vivienda, servicios e intensidad.

El mapa aporta contexto espacial que el tablero de recuperación no ofrece actualmente. Facilita examinar municipios vecinos y consultar capas territoriales junto con la ficha. La organización por diagnóstico, terreno y ejecución acerca la información al trabajo de coordinación.

Los módulos de alojamientos y EDAN son especialmente aprovechables. Horizon contiene 88 registros de necesidades para cuatro alojamientos y un consolidado atribuido al EDAN de Caldas con 27 municipios. Distingue cantidades declaradas, estimadas y pendientes; presenta normalización de nombres, ausencia de frecuencias y discrepancias. Es una estructura útil para gestionar necesidades específicas, siempre que se incorporen y verifiquen los archivos originales citados.

La clasificación entre dato real, cálculo, contenido mixto y demostración es una buena práctica de comunicación. Los fondos se identifican como ejemplos y el módulo de abastecimiento explica su mecanismo de proyección. Esa clasificación puede incorporarse a nuestra ficha por observación y acompañar las exportaciones.

## Desventajas y hallazgos

**La operación está simulada.** Los seis fondos, sus montos y sus estados son demostrativos. Los microreportes se guardan en un arreglo del navegador: en la prueba, un reporte pasó de uno a cero después de recargar. La función `tomarGps` genera una coordenada aleatoria alrededor de un municipio; no consulta la ubicación del dispositivo. El botón de foto cambia el texto y el estilo, sin capturar una imagen. Aunque la vista advierte que es una demostración, mensajes como “coordenada tomada del dispositivo” pueden inducir a error en una prueba con usuarios.

**La trazabilidad declarada requiere respaldo documental.** El HTML identifica un Excel de necesidades y otro de EDAN, pero esos libros no se adjuntaron con el archivo. El sello “Dato real” describe la clasificación del autor; no permite verificar por sí solo la extracción ni reproducirla. La bitácora de ingesta es contenido incrustado, no un importador ejecutable. El EDAN registra un corte “10:20”, insuficiente para establecer una fecha completa de observación.

**La intensidad no resuelve por sí sola la prioridad.** Horizon presenta MMI máxima como criterio del evento. ShakeMap estima la distribución del movimiento del suelo, combinando observaciones y modelos; su intensidad instrumental no es un censo de daños. La máxima dentro de un municipio tampoco indica cuánta población o infraestructura experimentó ese máximo. El bajo solapamiento entre riesgo de largo plazo y MMI de un evento no demuestra que el modelo de riesgo haya fallado: las dos variables responden preguntas diferentes. [USGS, representación de intensidad](https://ghsc.code-pages.usgs.gov/esi/shakemap/docs2020/manual4_0/ug_intensity.html).

**Los umbrales pueden excluir daño documentado.** Dentro del propio paquete EDAN, 11 municipios de Caldas quedan fuera del criterio MMI ≥ 6, incluido uno sin MMI; reúnen 1.622 viviendas afectadas según esos registros incrustados. Este contraste favorece usar la intensidad como contexto y las observaciones de daño como evidencia adicional, con sus respectivas fechas y calidad.

**Los empates y los faltantes afectan las listas.** `ordenar` usa cero cuando el campo es nulo o ausente. `rankDe` devuelve la posición secuencial, por lo que valores iguales reciben puestos diferentes. Los top 20 y su solapamiento pueden depender del orden previo cuando hay empates en el límite. El tablero de recuperación excluye faltantes del cálculo y comparte posición entre valores iguales.

**Las proyecciones necesitan supuestos explícitos.** Abastecimiento aplica a 498 personas proporciones derivadas de un alojamiento base de 70 ocupantes activos. Una dotación particular no equivale automáticamente a un estándar general. Los artículos discretos pueden producir cantidades fraccionarias; personal, turnos, consumo diario y dotación única requieren reglas propias. La razón entre daño de 2026 y viviendas censadas en 2018 debe presentarse como razón sobre una base histórica, no como porcentaje exacto del parque actual.

**Hay límites de mantenimiento y uso móvil.** El HTML reúne unas 6.200 líneas con datos, estilos, funciones y extensiones de vistas. No incluye el proceso que generó todas sus tablas ni una actualización automática. Las 28 entradas hacen difícil distinguir la tarea principal. En una pantalla de 390 píxeles se observó un ancho de contenido de 829 píxeles; el menú ocupó 286 y dejó apenas 104 para el panel. Fuentes tipográficas, iconos y mapas dependen de servicios externos.

## Qué conservar del tablero de recuperación

Conviene mantener los importadores, el formato largo, el control de duplicados, la distinción entre cero y ausencia, y las comparaciones por fuente, indicador, unidad y territorio. Su historial de capturas permite revisar cambios sobre un conjunto constante de municipios. El índice principal conserva el valor publicado por RAPIDA sin añadir IPM ni premios por disponibilidad.

Sus límites también importan: el ranking depende de la cobertura de RAPIDA; varias fuentes no conservan su fecha efectiva; una captura no acredita que el daño ocurriera ese día. No incorpora gestión real de alojamientos, entrega de ayudas ni seguimiento financiero. Estos vacíos explican el valor de adaptar Horizon.

## Integración propuesta

1. **Compartir la identidad y la evidencia.** Usar DIVIPOLA, identificador de sede o alojamiento, fuente, evento, fecha de observación, fecha de descarga, unidad, valor y enlace al original. Conservar la distinción entre municipio y departamento. Guardar las tablas fuente y la transformación reproducible.
2. **Adoptar un diagnóstico común.** Añadir el mapa y el comparador de criterios a una ficha territorial con los filtros actuales. Mostrar recuperación RAPIDA, daño observado, vulnerabilidad previa e intensidad en apartados reconocibles. Resolver empates sobre la misma población comparable y explicar cualquier cambio del universo.
3. **Pilotar necesidades y respuesta.** Incorporar primero un EDAN y una planilla de alojamientos verificadas. Registrar solicitud, validación, compromiso y entrega por separado; calcular la necesidad pendiente solo después de comprobar unidad, periodo, destinatario y ausencia de duplicados. Una cifra de daño no equivale automáticamente a una solicitud sin atender.
4. **Habilitar la operación.** Para usar formularios y fondos de verdad hacen falta almacenamiento persistente, usuarios, permisos, evidencia, historial de cambios y sincronización. La captura de GPS y foto debe implementarse y probarse. Los ejemplos de fondos deben permanecer fuera de los reportes operativos.

Propongo cuatro áreas visibles: Prioridades y mapa; Diagnóstico territorial; Necesidades y respuesta; Fuentes y calidad. Fondos y ejecución puede permanecer dentro de Necesidades y respuesta hasta que exista información real suficiente. Es una propuesta de diseño, pendiente de implementación.

## Cálculos que conviene revisar

El ranking municipal de Horizon ordena cada criterio de mayor a menor y asigna la posición de la fila. No combina los cinco criterios en un índice municipal único. La coincidencia de top 20 cuenta los códigos comunes entre ambas listas.

El índice de fondos sí es un compuesto. Redondea la suma de 30% del subpuntaje de ejecución, 25% de velocidad, 25% de foco y 20% de trazabilidad. Ejecución es el porcentaje ejecutado sobre comprometido, escalado para que 40% equivalga a 100 puntos y limitado entre 0 y 100. Velocidad parte de 100 y descuenta 3,2 puntos por cada día posterior al quinto desde el sismo hasta el primer desembolso; sin desembolso vale cero. Foco es el porcentaje del compromiso asignado a municipios definidos como núcleo. Trazabilidad toma directamente el campo `traza`. Son reglas de la demostración, sin validación de esos pesos como criterio oficial de asignación.

El percentil del tablero actual es 100 multiplicado por el número de valores menores más la mitad de los iguales, dividido por el número de territorios con dato comparable. El orden principal usa recuperación RAPIDA; el percentil indica posición relativa y no sustituye ese valor.

En abastecimiento, un consumo diario se multiplica por personas y días. Una dotación se multiplica por personas una vez. El personal se muestra por día sin multiplicarlo por el horizonte. Antes de operarlo deben definirse redondeo, turnos, existencias y estándares aplicables a cada alojamiento.

## Evidencia de la revisión

Base: `reestructuracion-recuperacion`, commit `a3a0b8d051b887e8bc3f90b5b67b4806aeb416d9`. Archivo recibido: `Horizon_Reconstruccion (1).html`, 1.033.905 bytes. SHA-256 de la copia: `509b44d2e342abc31b3801b9c8368a9071aa97653a2bc0cbf1d2656a308c6d36`.

Se recorrieron las 28 entradas de Horizon sin excepciones JavaScript en la prueba de escritorio. Se comprobaron pérdida de microreportes al recargar y desbordamiento móvil. Esta prueba verifica comportamiento del archivo, no autentica todas las cifras que contiene.

Localizadores en `Horizon_Reconstruccion.html`: `CRITERIOS` desde línea 825; `FONDOS` 893; `ALOJ` 1052; `EDAN` 1057; `fondoInd` 3161; `ordenar` 3494; `rankDe` 3503; `HZ.tomarGps` 4425; `alProyectar` 4585; `ORIGEN` 6101. En el tablero actual: `generar_tablero_recuperacion.py`, `web/modelo.js` y `.github/workflows/actualizar.yml`.

Los libros de alojamientos y EDAN originales, las versiones de las capas geográficas y los scripts de extracción de Horizon son los insumos pendientes para convertir la propuesta en una integración reproducible.
