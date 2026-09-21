@echo off
setlocal
title ACHA - servidor
set "PROJECT=%~dp0"
set "NODE="

for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE set "NODE=%%N"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE (
  echo.
  echo ERRO: nao foi encontrado o Node.js.
  echo.
  pause
  exit /b 1
)

cd /d "%PROJECT%"
echo ==========================================
echo ACHA - iniciando servidor...
echo Pasta: %PROJECT%
echo Node: %NODE%
echo ==========================================

echo Verificando a porta 3000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo Encerrando processo anterior na porta 3000: PID %%P
  taskkill /PID %%P /F >nul 2>&1
)

start "ACHA - Servidor local" /B "%NODE%" server.js
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000/"

endlocal
