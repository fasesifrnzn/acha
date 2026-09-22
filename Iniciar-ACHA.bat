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

echo Verificando dependencias do ACHA...
if not exist "%PROJECT%node_modules\mysql2\package.json" (
  echo mysql2 nao encontrado. Instalando dependencias...
  set "NPM="
  for /f "delims=" %%N in ('where npm 2^>nul') do if not defined NPM set "NPM=%%N"
  if not defined NPM if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM=%ProgramFiles%\nodejs\npm.cmd"
  if not defined NPM if exist "%LocalAppData%\Programs\nodejs\npm.cmd" set "NPM=%LocalAppData%\Programs\nodejs\npm.cmd"
  if not defined NPM (
    echo ERRO: nao foi encontrado o npm para instalar as dependencias.
    pause
    exit /b 1
  )
  call "%NPM%" install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo ERRO: falha ao instalar as dependencias do ACHA.
    pause
    exit /b 1
  )
)

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
