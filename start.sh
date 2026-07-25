#!/usr/bin/env bash
# Crash Circuit — start (Linux / macOS)
# Bootstraps a portable Node.js into .tools/ if none is available.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

NODE_VERSION="22.17.1"
TOOLS_DIR="$ROOT/.tools"

die() {
  echo "Fehler: $*" >&2
  exit 1
}

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    linux*) os="linux" ;;
    darwin*) os="darwin" ;;
    *) die "Unsupported OS '$(uname -s)'. Bitte Linux oder macOS nutzen." ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) die "Unsupported CPU '$(uname -m)'." ;;
  esac

  echo "${os}-${arch}"
}

PLATFORM="$(detect_platform)"
# Official Node dist extracts to node-vVERSION-OS-ARCH/
NODE_HOME="$TOOLS_DIR/node-v${NODE_VERSION}-${PLATFORM}"

download_file() {
  local url="$1"
  local dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$dest"
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "$url" "$dest" <<'PY'
import sys, urllib.request
urllib.request.urlretrieve(sys.argv[1], sys.argv[2])
PY
  else
    die "Kein Download-Werkzeug gefunden (curl, wget oder python3). Für den Erststart wird eines davon benötigt, um Node.js zu laden."
  fi
}

node_major_ok() {
  local bin="$1"
  local major
  major="$("$bin" -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
  [ -n "$major" ] && [ "$major" -ge 20 ]
}

ensure_path_has_node() {
  if command -v node >/dev/null 2>&1 && node_major_ok "$(command -v node)"; then
    if command -v npm >/dev/null 2>&1; then
      return 0
    fi
  fi
  if [ -x "$NODE_HOME/bin/node" ] && node_major_ok "$NODE_HOME/bin/node"; then
    export PATH="$NODE_HOME/bin:$PATH"
    return 0
  fi
  return 1
}

bootstrap_node() {
  local archive url tmpdir tarball

  if ! command -v tar >/dev/null 2>&1; then
    die "tar fehlt — wird zum Entpacken von Node.js benötigt."
  fi

  archive="node-v${NODE_VERSION}-${PLATFORM}.tar.gz"
  url="https://nodejs.org/dist/v${NODE_VERSION}/${archive}"

  echo "Node.js >= 20 nicht gefunden — lade portable Node v${NODE_VERSION} (${PLATFORM})…"
  mkdir -p "$TOOLS_DIR"
  tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/crash-circuit-node.XXXXXX")"
  tarball="$tmpdir/$archive"
  download_file "$url" "$tarball"
  rm -rf "$NODE_HOME"
  tar -xzf "$tarball" -C "$TOOLS_DIR"
  rm -rf "$tmpdir"

  if [ ! -x "$NODE_HOME/bin/node" ]; then
    die "Node-Bootstrap fehlgeschlagen (binär nicht gefunden unter $NODE_HOME)."
  fi
  export PATH="$NODE_HOME/bin:$PATH"
  echo "Portable Node bereit: $(node -v) ($NODE_HOME)"
}

if ! ensure_path_has_node; then
  bootstrap_node
fi

if ! command -v npm >/dev/null 2>&1; then
  die "npm fehlt auch nach dem Node-Bootstrap."
fi

if [ ! -d node_modules ] || [ ! -d node_modules/vite ]; then
  echo "Installiere Abhängigkeiten…"
  npm install
fi

echo "Starte Crash Circuit (Dev-Server)…"
echo "Lokal:    http://127.0.0.1:5173/"
echo "Im LAN:   http://<VM-IP>:5173/  (Host: true / 0.0.0.0)"
if command -v hostname >/dev/null 2>&1; then
  for ip in $(hostname -I 2>/dev/null || true); do
    echo "Versuch:  http://${ip}:5173/"
  done
fi
exec npm run dev
