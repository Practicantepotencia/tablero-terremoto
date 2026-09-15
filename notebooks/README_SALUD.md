# Notebook corregido: ML de urgencias donde falta el registro

[Notebook](salud_urgencias_ml_paso_a_paso.ipynb) · [Abrir en Colab](https://colab.research.google.com/github/Practicantepotencia/tablero-terremoto/blob/salud-relativa-urgencias-ml/notebooks/salud_urgencias_ml_paso_a_paso.ipynb)

## Resultado de esta revisión

En los 69 observados menores de 10.000 habitantes sin registro de camas, ninguno de los dos Poisson mejora el error proporcional de «siempre 1»; la mediana de comparables empata. La selección interna dirigida escoge la constante en los cinco grupos exteriores. Esto no verifica existencia de capacidad en los faltantes ni autoriza imputar 1.

El grupo principal representa 146 de 203 estimaciones aplicadas; 173 de 203 carecen de registro de camas. Se muestran primero estos grupos; el R² nacional y el grupo diagnóstico de 1–5 consultorios aparecen después como contexto.

La revisión es exploratoria, posterior al examen de la misma muestra. No es un nuevo test externo. La pequeña desventaja del modelo aplicado en el grupo principal se concentra en dos municipios de Nariño.

## Qué incluye

- Cuatro métodos, entrenados y comparados sobre los mismos municipios.
- Selección interna por el grupo principal, con departamentos exteriores reservados.
- Resultados por población, disponibilidad de camas, grupo exterior y departamento.
- Referencias constante y mediana, error proporcional, MAE, R² y proporción dentro de ±1.
- Bandas descriptivas de diferencias emparejadas al remuestrear departamentos.
- Ejemplos favorables y desfavorables; 174 estimaciones aplicadas en el piso 1.
- Matriz conjunta de sensibilidad Atrato/Trujillo: máximos, Salud y puestos recalculados.
- Comparación de la reproducción Python con las salidas JavaScript guardadas.

El notebook tiene 54 celdas, 26 ejecutables. No vuelve a ajustar boosting: la prueba prometida compara constante, mediana de comparables y los dos Poisson. El ensayo original completo permanece en el historial Git y en sus archivos originales.

## Archivos de resultados

- [Comparación y predicciones](../experimentos/ml_salud/revision_faltantes/comparacion.json)
- [CSV comparado](../experimentos/ml_salud/revision_faltantes/validacion_comparada.csv)
- [Sensibilidad y cambios por municipio](../experimentos/ml_salud/revision_faltantes/sensibilidad.json)
- [Interpretación de la revisión](../docs/revision_ml_salud_faltantes.md)
- [Código del cálculo ejecutado](../scripts/revisar_ml_salud.cjs)

Datos originales congelados en `a350ca6591174542e76b08d108e4d4e15c629b4c`. Resultados de esta revisión congelados en `01cfb4916e52357f61db4eba3c961cf8fa7eeaf2`. Cada descarga se verifica con su hash Git; no se toma una versión nueva silenciosamente.

## Ejecutar

En Colab: **Entorno de ejecución → Ejecutar todas**. Se necesitan permisos de lectura del repositorio. En local, desde la raíz:

```powershell
python -m pip install -r notebooks/requirements-salud.txt
python -m jupyter lab notebooks/salud_urgencias_ml_paso_a_paso.ipynb
```

También se abre en VS Code con un kernel Python. Las dependencias se pueden instalar desde la primera celda comentada. Las descargas suman unos 30 MB.

El ámbito del puntaje se cambia en el paso 18 entre `"decree"` y `"all"`. Reejecuta desde allí para actualizar la sensibilidad; esto no altera la muestra nacional de entrenamiento.

## Verificación

**Sí se ejecutó la nueva comparación y la sensibilidad en JavaScript V8.** Se verificaron 901 predicciones de cada candidato, la selección interna, 18 escenarios con el motor original y la reproducción determinista. Los cuatro cuerpos de prueba de Node se ejecutaron en V8 con adaptadores en memoria.

**No se ejecutaron aquí las nuevas celdas Python ni se renderizaron sus gráficos** por el bloqueo del entorno. Se entregan sin salidas ficticias. La ejecución satisfactoria del notebook anterior comunicada por el usuario no se atribuye a esta revisión.

Pruebas locales:

```powershell
python -m unittest discover -s tests -p "test_notebook_salud.py" -v
node --test tests/revision_ml_salud.test.cjs
```

Reproducir los archivos de la revisión con Node:

```powershell
node scripts/revisar_ml_salud.cjs
```

Ese script sobrescribe únicamente los tres resultados de `experimentos/ml_salud/revision_faltantes/`, con comprobaciones de integridad de entradas y motor. No cambia el tablero ni sus denominadores.

Ejecutar y guardar una copia del notebook:

```powershell
python -m jupyter nbconvert --to notebook --execute --ExecutePreprocessor.timeout=1800 --output salud_urgencias_revision_ejecutado.ipynb notebooks/salud_urgencias_ml_paso_a_paso.ipynb
```

Revisa la ejecución completa antes de presentar. La exportación está desactivada y, si se activa, crea una carpeta nueva.
