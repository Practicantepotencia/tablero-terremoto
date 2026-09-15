# Notebook didáctico: ML de Salud / urgencias

Archivo: [salud_urgencias_ml_paso_a_paso.ipynb](salud_urgencias_ml_paso_a_paso.ipynb).

[Abrir en Google Colab](https://colab.research.google.com/github/Practicantepotencia/tablero-terremoto/blob/salud-relativa-urgencias-ml/notebooks/salud_urgencias_ml_paso_a_paso.ipynb).
Colab necesita acceso al repositorio; si no lo tiene, descarga el notebook y ábrelo localmente con el repositorio disponible.

## Qué incluye

24 pasos, más referencias, con carga verificable de archivos, cobertura, preprocesamiento sin fuga de datos, regresión Poisson regularizada, boosting, comparación de cinco candidatos, selección anidada por departamentos, gráficos, ejemplos municipales, estimaciones y abstenciones, fórmula de Salud y caso completo de Atrato. Muestra sensibilidad al piso 1 y distingue datos observados, estimaciones y resultados archivados.

El notebook traduce a Python/NumPy el algoritmo JavaScript original, conservando el criterio de selección, grupos y parámetros. Incluye una comprobación opcional con PoissonRegressor de scikit-learn. No afirma que una traducción sea idéntica sin compararla: las celdas verifican coeficientes y predicciones contra los archivos originales.

## Ejecución local

Desde la raíz del repositorio:

```powershell
python -m pip install -r notebooks/requirements-salud.txt
python -m jupyter lab notebooks/salud_urgencias_ml_paso_a_paso.ipynb
```

O abre el archivo en VS Code, elige un kernel Python y pulsa **Ejecutar todo**. Las dependencias pueden instalarse desde la primera celda comentada.

En Colab: **Entorno de ejecución → Ejecutar todas**. Entrenar todos los candidatos puede tardar varios minutos. Las descargas son aproximadamente 27 MB. Se muestran avances por grupo exterior.

Las celdas se ejecutan en orden. Cambiar `AMBITO` entre `"decree"` y `"all"` y ejecutar desde el paso 18 cambia el conjunto de referencia del puntaje de Salud; no cambia la muestra nacional de entrenamiento.

## Corte e integridad

Datos fijados al commit `a350ca6591174542e76b08d108e4d4e15c629b4c`. Cada archivo se verifica con su hash Git. El notebook no toma versiones nuevas automáticamente. Las versiones de bibliotecas son rangos compatibles, no un entorno bloqueado; el cuaderno imprime las utilizadas y comprueba tolerancias numéricas.

El ML utiliza capacidad REPS 2022, población proyectada 2026 e IPM censal 2018. Los daños y el ámbito del tablero corresponden a la captura 2026-09-11. No acredita capacidad operativa actual ni existencia del servicio donde falta registro.

El puntaje de Salud se recalcula aquí. El ranking global de seis dimensiones se lee del informe ya guardado y se identifica como archivado; se verifica el incremento de Atrato, sin fingir reentrenar ni recalcular las otras dimensiones.

## Verificación y límites de esta entrega

**Python no pudo ejecutarse durante la autoría por el fallo de permisos del entorno.** Se entrega sin salidas ni contadores de ejecución ficticios. Se verificaron en JavaScript la estructura del notebook, el origen de los artefactos y el cálculo de Salud del corte congelado. La traducción Python, sus pruebas y su renderización Jupyter están pendientes de una ejecución real.

Comprobaciones locales de estructura, sintaxis y ejemplos sintéticos:

```powershell
python -m unittest discover -s tests -p "test_notebook_salud.py" -v
```

Para comprobar ejecución completa sin sobrescribir el original:

```powershell
python -m jupyter nbconvert --to notebook --execute --ExecutePreprocessor.timeout=1800 --output salud_urgencias_ml_ejecutado.ipynb notebooks/salud_urgencias_ml_paso_a_paso.ipynb
```

Ejecuta y revisa todo antes de presentar. Si una comprobación no pasa, no presentes esa ejecución como reproducción exacta. La exportación de datos está desactivada; activarla crea una carpeta nueva. El notebook no modifica index.html, main ni los datos del modelo.

Una estimación no es un registro oficial. El mínimo 1 no verifica existencia del servicio. Los límites de faltantes del tablero no incorporan incertidumbre de ML.
