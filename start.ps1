# Crash Circuit — start (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Die([string]$Message) {
  Write-Error $Message
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Die "Node.js (>= 20) fehlt. Bitte von https://nodejs.org installieren und neu starten."
}

$nodeMajor = [int]((node -v).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) {
  Die "Node.js >= 20 erforderlich (gefunden: $(node -v))."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Die "npm fehlt (kommt normalerweise mit Node.js)."
}

if (-not (Test-Path "node_modules") -or -not (Test-Path "node_modules\vite")) {
  Write-Host "Installiere Abhängigkeiten…"
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Starte Crash Circuit (Dev-Server)…"
Write-Host "Im Browser öffnen, sobald die URL erscheint (meist http://localhost:5173)."
npm run dev
exit $LASTEXITCODE
