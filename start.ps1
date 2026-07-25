# Crash Circuit — start (Windows PowerShell)
# Bootstraps a portable Node.js into .tools\ if none is available.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$NodeVersion = "22.17.1"
$ToolsDir = Join-Path $PSScriptRoot ".tools"
$NodeHome = Join-Path $ToolsDir "node-v$NodeVersion-win-x64"

function Die([string]$Message) {
  Write-Host "Fehler: $Message" -ForegroundColor Red
  exit 1
}

function Test-NodeMajorOk([string]$NodeExe) {
  try {
    $major = & $NodeExe -p "process.versions.node.split('.')[0]"
    return ([int]$major -ge 20)
  } catch {
    return $false
  }
}

function Ensure-NodeOnPath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and (Test-NodeMajorOk $cmd.Source)) {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm) { return $true }
  }
  $portable = Join-Path $NodeHome "node.exe"
  if ((Test-Path $portable) -and (Test-NodeMajorOk $portable)) {
    $env:Path = "$NodeHome;$env:Path"
    return $true
  }
  return $false
}

function Bootstrap-Node {
  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($arch -ne "AMD64" -and $arch -ne "ARM64") {
    # 32-bit process on 64-bit OS
    if ($env:PROCESSOR_ARCHITEW6432 -eq "AMD64") { $arch = "AMD64" }
  }

  $platform = if ($arch -eq "ARM64") { "win-arm64" } else { "win-x64" }
  $folderName = "node-v$NodeVersion-$platform"
  $script:NodeHome = Join-Path $ToolsDir $folderName
  $archive = "$folderName.zip"
  $url = "https://nodejs.org/dist/v$NodeVersion/$archive"

  Write-Host "Node.js >= 20 nicht gefunden — lade portable Node v$NodeVersion ($platform)…"
  New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
  $zipPath = Join-Path $ToolsDir $archive

  try {
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
  } catch {
    Die "Download von Node.js fehlgeschlagen. Internetverbindung nötig für den Erststart. $_"
  }

  if (Test-Path $NodeHome) {
    Remove-Item -Recurse -Force $NodeHome
  }

  Expand-Archive -Path $zipPath -DestinationPath $ToolsDir -Force
  Remove-Item -Force $zipPath -ErrorAction SilentlyContinue

  $portable = Join-Path $NodeHome "node.exe"
  if (-not (Test-Path $portable)) {
    Die "Node-Bootstrap fehlgeschlagen ($portable nicht gefunden)."
  }

  $env:Path = "$NodeHome;$env:Path"
  Write-Host "Portable Node bereit: $(node -v)"
}

if (-not (Ensure-NodeOnPath)) {
  Bootstrap-Node
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Die "npm fehlt auch nach dem Node-Bootstrap."
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
