@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Windows-Einstieg: nutzt PowerShell-Bootstrap (lädt Node bei Bedarf nach .tools\)
where powershell >nul 2>&1
if errorlevel 1 (
  echo Fehler: PowerShell fehlt. Unter Windows ist PowerShell fuer den automatischen Node-Download noetig.
  echo Installiere Node.js manuell von https://nodejs.org und starte start.bat erneut.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
exit /b %ERRORLEVEL%
