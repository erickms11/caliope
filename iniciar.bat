@echo off
title Caliope - Videoke Oficial (Servidor Local)
cd /d "%~dp0"

echo ========================================================
echo             CALIOPE - VIDEOKE OFICIAL
echo            Iniciando Servidor Local...
echo ========================================================
echo.
echo Abrindo o Caliope no seu navegador em http://localhost:3000 ...
start http://localhost:3000

python server.py
if %ERRORLEVEL% NEQ 0 (
    python3 server.py
)

pause

