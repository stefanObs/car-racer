import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Blob } from "node:buffer";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * SkullHorns must cover the painted stub seats on the skull and plant into bone
 * with a collar — not float above the crown with a hard tube cut.
 */
describe("Käferkraft SkullHorn attachment", () => {
  it("plants horn roots on the skull stub seats", async () => {
    globalThis.Blob = Blob;
    // @ts-expect-error FileReader polyfill for Node GLTFLoader
    globalThis.self = globalThis;
    class FileReaderPolyfill {
      result: ArrayBuffer | null = null;
      onloadend: ((ev: { target: FileReaderPolyfill }) => void) | null = null;
      onerror: ((err: unknown) => void) | null = null;
      readAsArrayBuffer(blob: Blob) {
        Promise.resolve(blob.arrayBuffer())
          .then((ab) => {
            this.result = ab;
            this.onloadend?.({ target: this });
          })
          .catch((err) => this.onerror?.(err));
      }
    }
    // @ts-expect-error Node test polyfill
    globalThis.FileReader = FileReaderPolyfill;

    const buf = readFileSync(resolve("public/models/cars/kaeferkraft.glb"));
    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: import("three").Object3D }>((res, rej) => {
      loader.parse(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        "",
        res,
        rej,
      );
    });

    let skullPos: import("three").BufferAttribute | null = null;
    let hornPos: import("three").BufferAttribute | null = null;
    const rootPosList: import("three").BufferAttribute[] = [];
    gltf.scene.traverse((obj) => {
      const mesh = obj as import("three").Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const names = mats.map((m) => ((m?.name ?? "") + "").toLowerCase());
      const pos = mesh.geometry.getAttribute("position") as import("three").BufferAttribute | undefined;
      if (!pos) return;
      if (names.includes("skull") && pos.count > 150) {
        if (!skullPos || pos.count > skullPos.count) skullPos = pos;
      }
      if (names.some((n) => n.includes("skullhorn"))) hornPos = pos;
      if (mesh.name.toLowerCase().includes("skullhornknuckle") || names.some((n) => n.includes("skullhorn"))) {
        rootPosList.push(pos);
      }
    });
    expect(skullPos).toBeTruthy();
    expect(hornPos).toBeTruthy();
    expect(rootPosList.length).toBeGreaterThan(0);

    const sp = skullPos!;
    const seats = [
      { x: -1.33, y: 0.045, z: 0.1 },
      { x: -1.33, y: 0.045, z: -0.08 },
    ];

    const nearestRoot = (sx: number, sy: number, sz: number) => {
      let bd = Infinity;
      for (const hp of rootPosList) {
        for (let i = 0; i < hp.count; i++) {
          const d = Math.hypot(hp.getX(i) - sx, hp.getY(i) - sy, hp.getZ(i) - sz);
          if (d < bd) bd = d;
        }
      }
      return bd;
    };
    const nearestSkull = (x: number, y: number, z: number) => {
      let bd = Infinity;
      for (let i = 0; i < sp.count; i++) {
        const d = Math.hypot(sp.getX(i) - x, sp.getY(i) - y, sp.getZ(i) - z);
        if (d < bd) bd = d;
      }
      return bd;
    };

    for (const seat of seats) {
      expect(nearestRoot(seat.x, seat.y, seat.z)).toBeLessThan(0.1);
    }

    let rootSamples = 0;
    let maxGap = 0;
    for (const hp of rootPosList) {
      for (let i = 0; i < hp.count; i++) {
        const x = hp.getX(i);
        const y = hp.getY(i);
        const z = hp.getZ(i);
        if (y > 0.14 || Math.abs(z) > 0.22) continue;
        if (x > -1.22 || x < -1.42) continue;
        rootSamples++;
        maxGap = Math.max(maxGap, nearestSkull(x, y, z));
      }
    }
    expect(rootSamples).toBeGreaterThan(40);
    expect(maxGap).toBeLessThan(0.13);
  });
});
