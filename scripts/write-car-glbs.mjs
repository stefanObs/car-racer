#!/usr/bin/env node
/**
 * Bake starter low-poly car GLBs into public/models/cars/.
 * Replace these files anytime with Blender/Blockbench exports (same filenames).
 *
 * Usage: node scripts/write-car-glbs.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/models/cars");
mkdirSync(outDir, { recursive: true });

/** @typedef {{ name: string, color: number, boxes: Array<[number,number,number, number,number,number]> }} Part */
/** box = [cx, cy, cz, sx, sy, sz] */

const CARS = {
  blitz: {
    parts: /** @type {Part[]} */ ([
      { name: "BodyPaint", color: 0xe03131, boxes: [[0, 0.45, 0.1, 1.7, 0.38, 2.5], [0, 0.4, 1.45, 1.45, 0.28, 0.7], [0, 0.48, -1.15, 1.75, 0.4, 0.7]] },
      { name: "Glass", color: 0x10141c, boxes: [[0, 0.9, -0.05, 1.35, 0.45, 1.0]] },
      { name: "Dark", color: 0x1b1b1f, boxes: [[0, 0.72, 0.7, 0.5, 0.1, 0.85], [0, 1.25, -1.25, 1.8, 0.08, 0.4], [0, 0.25, 1.85, 1.4, 0.08, 0.3]] },
      { name: "Tire", color: 0x1a1a1a, boxes: [[-0.85, 0.32, 0.95, 0.35, 0.64, 0.35], [0.85, 0.32, 0.95, 0.35, 0.64, 0.35], [-0.85, 0.34, -1.0, 0.38, 0.68, 0.38], [0.85, 0.34, -1.0, 0.38, 0.68, 0.38]] },
      { name: "Chrome", color: 0xc8ccd4, boxes: [[-0.55, 0.48, 1.95, 0.35, 0.12, 0.1], [0.55, 0.48, 1.95, 0.35, 0.12, 0.1]] },
    ]),
  },
  bison: {
    parts: [
      { name: "BodyPaint", color: 0x2f9e44, boxes: [[0, 0.7, 0.5, 1.85, 0.95, 1.5], [0, 0.55, 1.5, 1.7, 0.35, 0.9], [0, 0.85, -1.1, 1.7, 0.15, 1.2], [0, 1.05, -1.7, 1.7, 0.45, 0.12]] },
      { name: "Glass", color: 0x10141c, boxes: [[0, 1.35, 1.2, 1.55, 0.55, 0.1]] },
      { name: "Dark", color: 0x1b1b1f, boxes: [[0, 0.65, 2.0, 1.8, 0.5, 0.15], [0, 1.05, 1.4, 0.6, 0.18, 0.55], [-0.95, 1.15, -1.1, 0.1, 0.5, 1.15], [0.95, 1.15, -1.1, 0.1, 0.5, 1.15]] },
      { name: "Tire", color: 0x1a1a1a, boxes: [[-0.95, 0.5, 1.05, 0.5, 1.0, 0.5], [0.95, 0.5, 1.05, 0.5, 1.0, 0.5], [-0.95, 0.52, -1.15, 0.52, 1.04, 0.52], [0.95, 0.52, -1.15, 0.52, 1.04, 0.52]] },
    ],
  },
  kaeferkraft: {
    parts: [
      { name: "BodyPaint", color: 0xf08c00, boxes: [[0, 0.55, 1.1, 1.15, 0.4, 0.65], [-0.65, 0.6, 0.1, 0.12, 0.45, 1.3], [0.65, 0.6, 0.1, 0.12, 0.45, 1.3], [0, 0.55, -0.95, 1.15, 0.35, 0.35]] },
      { name: "Dark", color: 0x1b1b1f, boxes: [[0, 0.35, 0, 1.2, 0.12, 1.9], [-0.5, 1.15, -0.15, 0.1, 1.3, 0.1], [0.5, 1.15, -0.15, 0.1, 1.3, 0.1], [0, 1.75, -0.15, 1.1, 0.1, 0.1], [-0.28, 0.7, 0.1, 0.35, 0.4, 0.4], [0.28, 0.7, 0.1, 0.35, 0.4, 0.4], [0, 0.75, -1.2, 0.7, 0.45, 0.5]] },
      { name: "Chrome", color: 0xffe066, boxes: [[-0.75, 0.55, 0.9, 0.15, 0.5, 0.15], [0.75, 0.55, 0.9, 0.15, 0.5, 0.15], [-0.75, 0.55, -0.85, 0.15, 0.5, 0.15], [0.75, 0.55, -0.85, 0.15, 0.5, 0.15]] },
      { name: "Tire", color: 0x1a1a1a, boxes: [[-0.85, 0.5, 0.95, 0.5, 1.0, 0.5], [0.85, 0.5, 0.95, 0.5, 1.0, 0.5], [-0.9, 0.55, -0.95, 0.55, 1.1, 0.55], [0.9, 0.55, -0.95, 0.55, 1.1, 0.55]] },
    ],
  },
  donnerbuechse: {
    parts: [
      { name: "BodyPaint", color: 0x339af0, boxes: [[0, 0.45, 0, 1.5, 0.35, 2.8], [0, 0.65, 0.85, 1.3, 0.22, 1.3], [0, 0.9, -0.8, 1.3, 0.55, 0.95], [0, 0.65, -1.45, 1.3, 0.3, 0.5]] },
      { name: "Glass", color: 0x10141c, boxes: [[0, 1.05, -0.25, 1.1, 0.4, 0.1]] },
      { name: "Chrome", color: 0xc8ccd4, boxes: [[0, 1.05, 0.45, 0.8, 0.65, 0.9], [0, 1.55, 0.45, 0.22, 0.5, 0.22], [-0.2, 1.55, 0.45, 0.18, 0.45, 0.18], [0.2, 1.55, 0.45, 0.18, 0.45, 0.18], [-0.75, 0.7, 0.2, 0.15, 0.15, 0.8], [0.75, 0.7, 0.2, 0.15, 0.15, 0.8]] },
      { name: "Tire", color: 0x1a1a1a, boxes: [[-0.8, 0.3, 1.1, 0.3, 0.6, 0.3], [0.8, 0.3, 1.1, 0.3, 0.6, 0.3], [-0.85, 0.5, -1.05, 0.5, 1.0, 0.5], [0.85, 0.5, -1.05, 0.5, 1.0, 0.5]] },
    ],
  },
  bunker: {
    parts: [
      { name: "BodyPaint", color: 0x868e96, boxes: [[0, 1.0, 0, 2.1, 1.2, 3.1], [0, 0.9, 1.75, 1.95, 0.9, 0.5]] },
      { name: "Chrome", color: 0xffe066, boxes: [[-1.08, 1.1, 0, 0.1, 0.25, 2.7], [1.08, 1.1, 0, 0.1, 0.25, 2.7], [0, 1.1, 1.95, 1.8, 0.25, 0.1]] },
      { name: "Glass", color: 0x10141c, boxes: [[-0.5, 1.5, 1.5, 0.35, 0.12, 0.08], [0.5, 1.5, 1.5, 0.35, 0.12, 0.08], [-0.65, 1.5, 0.4, 0.35, 0.12, 0.08], [0.65, 1.5, 0.4, 0.35, 0.12, 0.08]] },
      { name: "Dark", color: 0x1b1b1f, boxes: [[0, 0.4, 2.0, 2.05, 0.35, 0.35]] },
      { name: "Tire", color: 0x1a1a1a, boxes: [[-1.0, 0.48, 1.1, 0.48, 0.96, 0.48], [1.0, 0.48, 1.1, 0.48, 0.96, 0.48], [-1.0, 0.5, -1.15, 0.5, 1.0, 0.5], [1.0, 0.5, -1.15, 0.5, 1.0, 0.5]] },
    ],
  },
};

function appendBox(positions, normals, indices, box, base) {
  const [cx, cy, cz, sx, sy, sz] = box;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const corners = [
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  ];
  const faces = [
    [0, 1, 2, 3, 0, 0, -1],
    [5, 4, 7, 6, 0, 0, 1],
    [4, 0, 3, 7, -1, 0, 0],
    [1, 5, 6, 2, 1, 0, 0],
    [3, 2, 6, 7, 0, 1, 0],
    [4, 5, 1, 0, 0, -1, 0],
  ];
  for (const [a, b, c, d, nx, ny, nz] of faces) {
    const i0 = positions.length / 3;
    for (const idx of [a, b, c, d]) {
      const p = corners[idx];
      positions.push(p[0], p[1], p[2]);
      normals.push(nx, ny, nz);
    }
    indices.push(base + i0, base + i0 + 1, base + i0 + 2, base + i0, base + i0 + 2, base + i0 + 3);
  }
  return positions.length / 3;
}

function buildGlb(carId, def) {
  const positions = [];
  const normals = [];
  const indices = [];
  const meshes = [];
  const materials = [];
  const nodes = [];
  let nodeIndex = 0;

  for (const part of def.parts) {
    const startVert = positions.length / 3;
    const startIdx = indices.length;
    let vertCount = startVert;
    for (const box of part.boxes) {
      vertCount = appendBox(positions, normals, indices, box, 0);
    }
    // Fix indices: appendBox used absolute; rebuild per-part cleanly
    void vertCount;
    void startIdx;
  }

  // Rebuild properly per part with local buffers then merge
  const allPos = [];
  const allNor = [];
  const allIdx = [];
  const primitives = [];
  for (const part of def.parts) {
    const pPos = [];
    const pNor = [];
    const pIdx = [];
    let base = 0;
    for (const box of part.boxes) {
      base = appendBox(pPos, pNor, pIdx, box, 0);
      // appendBox returns total vert count but indices are local from 0 each box wrongly
    }
    // redo boxes with correct base
    pPos.length = 0;
    pNor.length = 0;
    pIdx.length = 0;
    for (const box of part.boxes) {
      const before = pPos.length / 3;
      appendBoxLocal(pPos, pNor, pIdx, box, before);
    }
    const matIndex = materials.length;
    materials.push({
      name: part.name,
      pbrMetallicRoughness: {
        baseColorFactor: hexToRgba(part.color),
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
    });
    const posOffset = allPos.length * 4;
    const norOffset = 0; // filled later
    void norOffset;
    const idxStart = allIdx.length;
    const vertStart = allPos.length / 3;
    for (let i = 0; i < pPos.length; i++) allPos.push(pPos[i]);
    for (let i = 0; i < pNor.length; i++) allNor.push(pNor[i]);
    for (const i of pIdx) allIdx.push(i + vertStart);
    primitives.push({
      matIndex,
      vertStart,
      vertCount: pPos.length / 3,
      idxStart,
      idxCount: pIdx.length,
      name: part.name,
    });
    void posOffset;
    void matIndex;
    void nodeIndex;
  }

  // Build binary buffer
  const posBytes = new Float32Array(allPos);
  const norBytes = new Float32Array(allNor);
  const idxBytes = new Uint32Array(allIdx);
  const posPad = pad4(posBytes.byteLength);
  const norPad = pad4(norBytes.byteLength);
  const idxPad = pad4(idxBytes.byteLength);
  const binSize = posPad + norPad + idxPad;
  const bin = new ArrayBuffer(binSize);
  const view = new Uint8Array(bin);
  view.set(new Uint8Array(posBytes.buffer), 0);
  view.set(new Uint8Array(norBytes.buffer), posPad);
  view.set(new Uint8Array(idxBytes.buffer), posPad + norPad);

  const accessors = [];
  const bufferViews = [
    { buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength, target: 34962 },
    { buffer: 0, byteOffset: posPad, byteLength: norBytes.byteLength, target: 34962 },
    { buffer: 0, byteOffset: posPad + norPad, byteLength: idxBytes.byteLength, target: 34963 },
  ];

  // One accessor set per primitive is heavy; use shared full buffer + mesh with multi prim
  const posMin = [Infinity, Infinity, Infinity];
  const posMax = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < allPos.length; i += 3) {
    posMin[0] = Math.min(posMin[0], allPos[i]);
    posMin[1] = Math.min(posMin[1], allPos[i + 1]);
    posMin[2] = Math.min(posMin[2], allPos[i + 2]);
    posMax[0] = Math.max(posMax[0], allPos[i]);
    posMax[1] = Math.max(posMax[1], allPos[i + 1]);
    posMax[2] = Math.max(posMax[2], allPos[i + 2]);
  }

  accessors.push({
    bufferView: 0,
    componentType: 5126,
    count: allPos.length / 3,
    type: "VEC3",
    max: posMax,
    min: posMin,
  });
  accessors.push({
    bufferView: 1,
    componentType: 5126,
    count: allNor.length / 3,
    type: "VEC3",
  });

  const meshPrimitives = [];
  for (const prim of primitives) {
    const idxViewIndex = bufferViews.length;
    // Per-primitive index slice — simpler: one mesh one material by merging parts was complex.
    // Use separate index bufferViews
    void idxViewIndex;
  }

  // Simpler approach: one mesh, one material BodyPaint only for bake smoke test
  // Actually create separate meshes per part with own accessors
  return buildGlbSimple(carId, def);
}

function appendBoxLocal(positions, normals, indices, box, base) {
  const [cx, cy, cz, sx, sy, sz] = box;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const corners = [
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  ];
  const faces = [
    [0, 1, 2, 3, 0, 0, -1],
    [5, 4, 7, 6, 0, 0, 1],
    [4, 0, 3, 7, -1, 0, 0],
    [1, 5, 6, 2, 1, 0, 0],
    [3, 2, 6, 7, 0, 1, 0],
    [4, 5, 1, 0, 0, -1, 0],
  ];
  let v = base;
  for (const [a, b, c, d, nx, ny, nz] of faces) {
    const i0 = v;
    for (const idx of [a, b, c, d]) {
      const p = corners[idx];
      positions.push(p[0], p[1], p[2]);
      normals.push(nx, ny, nz);
      v++;
    }
    indices.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  return v;
}

function hexToRgba(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return [r, g, b, 1];
}

function pad4(n) {
  return (n + 3) & ~3;
}

function buildGlbSimple(carId, def) {
  const materials = [];
  const meshes = [];
  const nodes = [];
  const scenes = [{ nodes: [] }];
  const accessors = [];
  const bufferViews = [];
  const blobs = [];
  let byteOffset = 0;

  for (const part of def.parts) {
    const positions = [];
    const normals = [];
    const indices = [];
    let base = 0;
    for (const box of part.boxes) {
      base = appendBoxLocal(positions, normals, indices, box, base);
    }
    const posArr = new Float32Array(positions);
    const norArr = new Float32Array(normals);
    const idxArr = new Uint32Array(indices);

    const posMin = [Infinity, Infinity, Infinity];
    const posMax = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      posMin[0] = Math.min(posMin[0], positions[i]);
      posMin[1] = Math.min(posMin[1], positions[i + 1]);
      posMin[2] = Math.min(posMin[2], positions[i + 2]);
      posMax[0] = Math.max(posMax[0], positions[i]);
      posMax[1] = Math.max(posMax[1], positions[i + 1]);
      posMax[2] = Math.max(posMax[2], positions[i + 2]);
    }

    const posView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: posArr.byteLength, target: 34962 });
    blobs.push(new Uint8Array(posArr.buffer));
    byteOffset = pad4(byteOffset + posArr.byteLength);

    const norView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: norArr.byteLength, target: 34962 });
    blobs.push(new Uint8Array(norArr.buffer));
    byteOffset = pad4(byteOffset + norArr.byteLength);

    const idxView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: idxArr.byteLength, target: 34963 });
    blobs.push(new Uint8Array(idxArr.buffer));
    byteOffset = pad4(byteOffset + idxArr.byteLength);

    const posAcc = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: positions.length / 3,
      type: "VEC3",
      max: posMax,
      min: posMin,
    });
    const norAcc = accessors.length;
    accessors.push({ bufferView: norView, componentType: 5126, count: normals.length / 3, type: "VEC3" });
    const idxAcc = accessors.length;
    accessors.push({ bufferView: idxView, componentType: 5125, count: indices.length, type: "SCALAR" });

    const mat = materials.length;
    materials.push({
      name: part.name,
      pbrMetallicRoughness: {
        baseColorFactor: hexToRgba(part.color),
        metallicFactor: 0,
        roughnessFactor: 0.9,
      },
    });

    const mesh = meshes.length;
    meshes.push({
      name: part.name,
      primitives: [
        {
          attributes: { POSITION: posAcc, NORMAL: norAcc },
          indices: idxAcc,
          material: mat,
        },
      ],
    });
    const node = nodes.length;
    nodes.push({ name: part.name, mesh });
    scenes[0].nodes.push(node);
  }

  // Pack bin with padding
  const binParts = [];
  let cursor = 0;
  for (let i = 0; i < bufferViews.length; i++) {
    const bv = bufferViews[i];
    bv.byteOffset = cursor;
    binParts.push(blobs[i]);
    const pad = pad4(blobs[i].byteLength) - blobs[i].byteLength;
    cursor += blobs[i].byteLength;
    if (pad) {
      binParts.push(new Uint8Array(pad));
      cursor += pad;
    }
  }
  const binBuffer = new Uint8Array(cursor);
  let o = 0;
  for (const part of binParts) {
    binBuffer.set(part, o);
    o += part.byteLength;
  }

  const json = {
    asset: { version: "2.0", generator: "crash-circuit-write-car-glbs" },
    scenes,
    scene: 0,
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }],
  };
  const jsonText = JSON.stringify(json);
  const jsonPad = pad4(jsonText.length) - jsonText.length;
  const jsonBytes = new Uint8Array(jsonText.length + jsonPad);
  for (let i = 0; i < jsonText.length; i++) jsonBytes[i] = jsonText.charCodeAt(i);
  for (let i = 0; i < jsonPad; i++) jsonBytes[jsonText.length + i] = 0x20;

  const total = 12 + 8 + jsonBytes.byteLength + 8 + binBuffer.byteLength;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); // glTF
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, 0x4e4f534a, true); // JSON
  u8.set(jsonBytes, 20);
  const binChunkStart = 20 + jsonBytes.byteLength;
  dv.setUint32(binChunkStart, binBuffer.byteLength, true);
  dv.setUint32(binChunkStart + 4, 0x004e4942, true); // BIN
  u8.set(binBuffer, binChunkStart + 8);

  const path = join(outDir, `${carId}.glb`);
  writeFileSync(path, Buffer.from(out));
  console.log("wrote", path, `(${total} bytes)`);
}

for (const [id, def] of Object.entries(CARS)) {
  buildGlbSimple(id, def);
}

writeFileSync(
  join(outDir, "README.md"),
  `# Car GLB models

Drop Blender / Blockbench / MagicaVoxel exports here:

| File | Car |
|------|-----|
| \`blitz.glb\` | Sportwagen |
| \`bison.glb\` | Pick-up |
| \`kaeferkraft.glb\` | Buggy |
| \`donnerbuechse.glb\` | Hot Rod |
| \`bunker.glb\` | Panzerwagen |

## Blender export tips

1. Model in **meters**, nose pointing **+Y** in Blender (or set \`yaw\` in \`src/data/carModels.ts\`).
2. Name materials so the game can tint paint / keep glass dark:
   - \`BodyPaint\` / \`Body\` / \`Cab\` → player paint color
   - \`Glass\` / \`Window\`
   - \`Tire\` / \`Wheel\`
   - \`Chrome\` / \`Metal\`
3. File → Export → **glTF 2.0** → format **GLB**.
4. Keep polycount modest (a few thousand tris is plenty for Asphalt-Comic).
5. Collision is a **circle** from \`collisionRadius\` in \`carModels.ts\` — the visual may overhang.

Regenerate these starter placeholders:

\`\`\`bash
node scripts/write-car-glbs.mjs
\`\`\`
`,
);
console.log("README written");
