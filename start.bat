@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Fehler: Node.js ^(^>= 20^) fehlt. Bitte von https://nodejs.org installieren und neu starten.
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0])>=20?0:1)"
if errorlevel 1 (
  echo Fehler: Node.js ^>= 20 erforderlich.
  node -v
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo Fehler: npm fehlt ^(kommt normalerweise mit Node.js^).
  exit /b 1
)

if not exist "node_modules\" (
  echo Installiere Abhaengigkeiten...
  call npm install
  if errorlevel 1 exit /b 1
)
if not exist "node_modules\vite\" (
  echo Installiere Abhaengigkeiten...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starte Crash Circuit ^(Dev-Server^)...
echo Im Browser oeffnen, sobald die URL erscheint ^(meist http://localhost:5173^).
call npm run dev
exit /b %ERRORLEVEL%
