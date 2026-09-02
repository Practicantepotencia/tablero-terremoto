@echo off
REM Actualiza el tablero de impacto del terremoto y deja un registro en actualizar_log.txt.
REM Este .bat asume que vive en la MISMA carpeta que actualizar_indice_terremoto.py.
REM Uso manual: doble clic. Uso programado: ver INSTRUCCIONES.md (Programador de tareas de Windows).

cd /d "%~dp0"

echo. >> actualizar_log.txt
echo ==== %date% %time% ==== >> actualizar_log.txt

where python >nul 2>nul
if %errorlevel%==0 (
    python actualizar_indice_terremoto.py >> actualizar_log.txt 2>&1
) else (
    py actualizar_indice_terremoto.py >> actualizar_log.txt 2>&1
)

echo Listo. Revisa dashboard_impacto_terremoto.html
