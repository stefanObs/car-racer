# Crash Circuit — start (Windows PowerShell)
# Bootstraps a portable Node.js into .tools\ if none is available.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$NodeVersion = "22.17.1"
$ToolsDir = Join-Path $PSScriptRoot ".tools"

function Die([string]$Message) {
  Write-Host "Fehler: $Message" -ForegroundColor Red
  exit 1
}

function Get-NodePlatform {
  $arch = $env:PROCESSOR_ARCHITECTURE
  if ($arch -ne "AMD64" -and $arch -ne "ARM64") {
    if ($env:PROCESSOR_ARCHITEW6432 -eq "AMD64") { $arch = "AMD64" }
    elseif ($env:PROCESSOR_ARCHITEW6432 -eq "ARM64") { $arch = "ARM64" }
  }
  if ($arch -eq "ARM64") { return "win-arm64" }
  return "win-x64"
}

$Platform = Get-NodePlatform
# Official Node zip extracts to node-vVERSION-win-ARCH\
$NodeHome = Join-Path $ToolsDir "node-v$NodeVersion-$Platform"

function Test-NodeMajorOk([string]$NodeExe) {
  try {
    $major = & $NodeExe -p "process.versions.node.split('.')[0]"
    return ([int]$major -ge 20)
  } catch {
    return $false
  }
}

# Portable Node zip ships npm.cmd next to node.exe. Bare `npm` in PowerShell often
# resolves the extensionless Unix shim and fails when no system npm is on PATH.
function Get-NpmCmd {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) { return $null }
  $npmCmd = Join-Path (Split-Path -Parent $nodeCmd.Source) "npm.cmd"
  if (Test-Path -LiteralPath $npmCmd) { return $npmCmd }
  return $null
}

function Ensure-NodeOnPath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and (Test-NodeMajorOk $cmd.Source)) {
    if (Get-NpmCmd) { return $true }
  }
  $portable = Join-Path $NodeHome "node.exe"
  if ((Test-Path $portable) -and (Test-NodeMajorOk $portable)) {
    $env:Path = "$NodeHome;$env:Path"
    return [bool](Get-NpmCmd)
  }
  return $false
}

function Bootstrap-Node {
  $folderName = "node-v$NodeVersion-$Platform"
  $script:NodeHome = Join-Path $ToolsDir $folderName
  $archive = "$folderName.zip"
  $url = "https://nodejs.org/dist/v$NodeVersion/$archive"

  Write-Host "Node.js >= 20 nicht gefunden — lade portable Node v$NodeVersion ($Platform)…"
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
  Write-Host "Portable Node bereit: $(node -v) ($NodeHome)"
}

if (-not (Ensure-NodeOnPath)) {
  Bootstrap-Node
}

$NpmCmd = Get-NpmCmd
if (-not $NpmCmd) {
  Die "npm.cmd fehlt auch nach dem Node-Bootstrap (wird neben node.exe erwartet)."
}

if (-not (Test-Path "node_modules") -or -not (Test-Path "node_modules\vite")) {
  Write-Host "Installiere Abhängigkeiten…"
  & $NpmCmd install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Vite uses strictPort — free leftover listener by port (never pkill -f vite).
node scripts/free-dev-port.mjs 5173
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Starte Crash Circuit (Dev-Server)…"
Write-Host "Lokal:  http://127.0.0.1:5173/"
Write-Host "Im LAN: http://<VM-IP>:5173/"
try {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" } |
    ForEach-Object { Write-Host ("Versuch: http://{0}:5173/" -f $_.IPAddress) }
} catch {}
& $NpmCmd run dev
exit $LASTEXITCODE
