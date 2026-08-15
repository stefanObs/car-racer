@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Windows-Einstieg: PowerShell laedt Node bei Bedarf nach .tools\ (kein vorinstalliertes npm noetig).
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" (
  echo Fehler: PowerShell nicht gefunden (%PS%).
  echo Unter Windows wird PowerShell fuer den automatischen Node-Download benoetigt.
  echo Alternativ Node.js ^>= 20 von https://nodejs.org installieren und start.bat erneut starten.
  exit /b 1
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
exit /b %ERRORLEVEL%
