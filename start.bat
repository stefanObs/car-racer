# 2>nul & goto :bat
Write-Host 'From PowerShell run .\start.ps1  (or: cmd /c start.bat)'
exit 1
:bat
@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Windows: pwsh if present, else System32 Windows PowerShell 5.1. No preinstalled npm.
where pwsh >nul 2>&1
if %ERRORLEVEL%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
  exit /b %ERRORLEVEL%
)

set "WINPS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%WINPS%" (
  echo Fehler: PowerShell nicht gefunden.
  echo Unter Windows wird PowerShell fuer den automatischen Node-Download benoetigt.
  echo Alternativ Node.js 20+ von nodejs.org installieren.
  exit /b 1
)

"%WINPS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
exit /b %ERRORLEVEL%
