@echo off
setlocal
set "PROJECT=C:\Users\1835439\Documents\fases\pocv"
set "NODE=node"

where node >nul 2>nul
if errorlevel 1 set "NODE=C:\Users\1835439\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE%" (
  echo Nao foi encontrado um runtime Node.js para iniciar o POCV.
  pause
  exit /b 1
)

cd /d "%PROJECT%"
start "POCV - Servidor local" /B "%NODE%" server.js
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000"

endlocal
