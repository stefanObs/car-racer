#!/usr/bin/env bash
# Generate Tripo meshes for per-car Teile concepts.
# Usage: ./scripts/tripo-make-car-parts.sh [carId]
set -euo pipefail
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CARS=(bison kaeferkraft donnerbuechse bunker)
PARTS=(big_engine spike_bumper nitro_kit rear_spoiler reinforced_frame)
if [[ "${1:-}" != "" ]]; then
  CARS=("$1")
fi

for car in "${CARS[@]}"; do
  for part in "${PARTS[@]}"; do
    concept="assets/tripo-concepts/${car}-part-${part}.png"
    out="assets/tripo-out/parts/${car}/${part}"
    if [[ ! -f "$concept" ]]; then
      echo "SKIP missing concept $concept"
      continue
    fi
    if find "$out" -name 'model.glb' 2>/dev/null | grep -q .; then
      echo "SKIP exists $out"
      continue
    fi
    mkdir -p "$out"
    echo "=== tripo make $car $part ==="
    if ! tripo make "$concept" \
      --model tripo-p1 \
      --for game-pc \
      --then texture \
      --name "${car}-part-${part}" \
      -o "$out" \
      --json \
      --timeout 1800 \
      --yes \
      --no-open; then
      echo "FAIL $car $part"
    fi
  done
done
echo "DONE"
