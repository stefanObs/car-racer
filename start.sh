#!/usr/bin/env bash
# Crash Circuit — start (Linux / macOS)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

die() {
  echo "Fehler: $*" >&2
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  die "Node.js (>= 20) fehlt. Bitte von https://nodejs.org installieren und neu starten."
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js >= 20 erforderlich (gefunden: $(node -v))."
fi

if ! command -v npm >/dev/null 2>&1; then
  die "npm fehlt (kommt normalerweise mit Node.js)."
fi

if [ ! -d node_modules ] || [ ! -d node_modules/vite ]; then
  echo "Installiere Abhängigkeiten…"
  npm install
fi

echo "Starte Crash Circuit (Dev-Server)…"
echo "Im Browser öffnen, sobald die URL erscheint (meist http://localhost:5173)."
exec npm run dev
