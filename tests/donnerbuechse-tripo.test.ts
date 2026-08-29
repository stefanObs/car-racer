import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/functions";
import { CAR_MODELS } from "../src/data/carModels";
import { DONNER_STOCK_ENGINE_BOX, DONNER_STOCK_ENGINE_BOXES, inDonnerStockEngine } from "../src/render/donnerEngineBox";
import {
  DONNER_BODY_PAINT_BLUE,
  isDonnerBodyPaintBlue,
  isDonnerNoseAfterGap,
  isDonnerNosePaintBand,
  noseFaceNeedsGaragePaintRetarget,
} from "../scripts/bake-donnerbuechse-segmented-engine.mjs";
import { meshInspectBoxContains } from "../src/core/meshInspect";
import { isBlueBodyPixel } from "../src/render/paintAuthoredWhite";
import sharp from "sharp";

function countTriCentroids(mesh: { listPrimitives: () => Array<{
  getAttribute: (n: string) => { getElement: (i: number, t: number[]) => number[] } | null;
  getIndices: () => { getCount: () => number; getScalar: (i: number) => number } | null;
}> }, pred: (p: number[]) => boolean): number {
  let n = 0;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    const idx = prim.getIndices();
    if (!pos || !idx) continue;
    for (let t = 0; t < idx.getCount() / 3; t++) {
      const a = pos.getElement(idx.getScalar(t * 3), []);
      const b = pos.getElement(idx.getScalar(t * 3 + 1), []);
      const c = pos.getElement(idx.getScalar(t * 3 + 2), []);
      const p = [
        (a[0]! + b[0]! + c[0]!) / 3,
        (a[1]! + b[1]! + c[1]!) / 3,
        (a[2]! + b[2]! + c[2]!) / 3,
      ];
      if (pred(p)) n++;
    }
  }
  return n;
}

async function albedoOf(mat: { getBaseColorTexture: () => { getImage: () => Uint8Array | null } | null } | null) {
  const img = mat?.getBaseColorTexture()?.getImage();
  if (!img) throw new Error("missing albedo");
  const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function sampleRgb(tex: { data: Buffer; w: number; h: number }, u: number, v: number): [number, number, number] {
  let uu = u - Math.floor(u);
  let vv = v - Math.floor(v);
  if (uu < 0) uu += 1;
  if (vv < 0) vv += 1;
  const px = Math.min(tex.w - 1, Math.max(0, Math.floor(uu * tex.w)));
  const py = Math.min(tex.h - 1, Math.max(0, Math.floor((1 - vv) * tex.h)));
  const i = (py * tex.w + px) * 4;
  return [tex.data[i]!, tex.data[i + 1]!, tex.data[i + 2]!];
}

async function countBodyPaintBlueFaces(mesh: {
  listPrimitives: () => Array<{
    getMaterial: () => { getBaseColorTexture: () => { getImage: () => Uint8Array | null } | null } | null;
    getAttribute: (n: string) => { getElement: (i: number, t: number[]) => number[] } | null;
    getIndices: () => { getCount: () => number; getScalar: (i: number) => number } | null;
  }>;
}): Promise<number> {
  let n = 0;
  for (const prim of mesh.listPrimitives()) {
    const uv = prim.getAttribute("TEXCOORD_0");
    const idx = prim.getIndices();
    if (!uv || !idx) continue;
    const tex = await albedoOf(prim.getMaterial());
    for (let t = 0; t < idx.getCount() / 3; t++) {
      const a = uv.getElement(idx.getScalar(t * 3), []);
      const b = uv.getElement(idx.getScalar(t * 3 + 1), []);
      const c = uv.getElement(idx.getScalar(t * 3 + 2), []);
      const rgb = sampleRgb(tex, (a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3);
      if (isDonnerBodyPaintBlue(rgb)) n++;
    }
  }
  return n;
}

describe("Donnerbüchse Tripo arcade bake", () => {
  it("is a BodyPaint hot rod with length along +Z, cabin aft, and segmented StockWheel_*", async () => {
    const path = resolve("public/models/cars/donnerbuechse.glb");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    const text = readFileSync(path).toString("latin1");
    expect(text).toContain("BodyPaint");
    expect(text).toContain("StockWheel_FL");
    expect(text).not.toContain("StockEngine");
    expect(text).not.toContain("Chrome");

    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const engNode = doc.getRoot().listNodes().find((n) => n.getName() === "StockEngine");
    expect(engNode).toBeFalsy();
    const wheelNames = doc
      .getRoot()
      .listNodes()
      .map((n) => n.getName())
      .filter((n) => n?.startsWith("StockWheel_"))
      .sort();
    expect(wheelNames).toEqual(["StockWheel_FL", "StockWheel_FR", "StockWheel_RL", "StockWheel_RR"]);
    const mats = doc.getRoot().listMaterials().map((m) => m.getName());
    expect(mats).toContain("BodyPaint");
    expect(mats).toContain("Tire");
    for (const mesh of doc.getRoot().listMeshes()) {
      const name = mesh.getName() ?? "";
      if (name.startsWith("StockWheel_")) {
        expect(mesh.listPrimitives().every((p) => p.getMaterial()?.getName() === "Tire"), name).toBe(true);
        expect(
          mesh.listPrimitives().every((p) => p.getMaterial()?.getBaseColorTexture()),
          name,
        ).toBe(true);
        continue;
      }
      for (const prim of mesh.listPrimitives()) {
        expect(prim.getMaterial()?.getName()).toBe("BodyPaint");
      }
    }

    const b = getBounds(doc.getRoot().listScenes()[0]!);
    const sx = b.max[0] - b.min[0];
    const sy = b.max[1] - b.min[1];
    const sz = b.max[2] - b.min[2];
    expect(sz).toBeGreaterThan(sx);
    expect(sz).toBeGreaterThan(3.2);
    expect(sz).toBeLessThan(4.1);
    expect(sy).toBeGreaterThan(0.9);
    expect(sy).toBeLessThan(2.2);
    expect(CAR_MODELS.donnerbuechse.scale).toBe(1);
    expect(CAR_MODELS.donnerbuechse.yaw).toBe(0);

    const midZ = (b.min[2] + b.max[2]) / 2;
    let maxYNeg = -Infinity;
    let maxYPos = -Infinity;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          const v = pos.getElement(i, []);
          if (v[2]! < midZ) maxYNeg = Math.max(maxYNeg, v[1]!);
          else maxYPos = Math.max(maxYPos, v[1]!);
        }
      }
    }
    // Chopped cabin / fat rear tires sit on −Z; long hood is the lower +Z half.
    expect(maxYNeg).toBeGreaterThan(maxYPos - 0.02);

    const bodyMesh = doc.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
    expect(bodyMesh).toBeTruthy();
    let cabin = 0;
    let grille = 0;
    for (const prim of bodyMesh!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const v = pos.getElement(i, []);
        if (v[2]! < -0.3 && v[1]! > 0.8) cabin++;
        if (v[2]! > 1.55 && v[1]! > 0.3) grille++;
      }
    }
    expect(cabin).toBeGreaterThan(200);
    expect(grille).toBeGreaterThan(400);
  });

  it("welds the exposed engine on BodyPaint inside the F6 Motor-aus Kasten", async () => {
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(resolve("public/models/cars/donnerbuechse.glb"));
    expect(doc.getRoot().listMeshes().find((m) => m.getName() === "StockEngine")).toBeFalsy();
    const body = doc.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
    expect(body).toBeTruthy();
    const inBox = countTriCentroids(body!, (p) =>
      meshInspectBoxContains(DONNER_STOCK_ENGINE_BOX, { x: p[0]!, y: p[1]!, z: p[2]! }),
    );
    expect(inBox).toBeGreaterThan(80);
    expect(DONNER_STOCK_ENGINE_BOX.min).toEqual({ x: -0.755, y: 0.472, z: 0.427 });
    expect(DONNER_STOCK_ENGINE_BOX.max).toEqual({ x: 0.568, y: 1.437, z: 1.262 });
  });

  it("puts leftover zoomie/header faces in the extra Motor-aus Kastens", async () => {
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(resolve("public/models/cars/donnerbuechse.glb"));
    let leftover = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      leftover += countTriCentroids(mesh, (p) => {
        const q = { x: p[0]!, y: p[1]!, z: p[2]! };
        return inDonnerStockEngine(q) && !meshInspectBoxContains(DONNER_STOCK_ENGINE_BOX, q);
      });
    }
    expect(leftover).toBeGreaterThan(20);
    expect(DONNER_STOCK_ENGINE_BOXES).toHaveLength(16);
  });

  it("keeps body-paint blue (the (−0.593, 1.097, 0.284) sample) on BodyPaint", async () => {
    expect(DONNER_BODY_PAINT_BLUE).toEqual([40, 111, 217]);
    expect(isDonnerBodyPaintBlue(DONNER_BODY_PAINT_BLUE)).toBe(true);
    expect(isDonnerBodyPaintBlue([180, 180, 185])).toBe(false);

    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(resolve("public/models/cars/donnerbuechse.glb"));
    const body = doc.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
    expect(body).toBeTruthy();

    const target = [-0.593, 1.097, 0.284];
    let best: { d: number; rgb: [number, number, number] } | null = null;
    for (const prim of body!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const uv = prim.getAttribute("TEXCOORD_0");
      const idx = prim.getIndices();
      if (!pos || !uv || !idx) continue;
      const tex = await albedoOf(prim.getMaterial());
      for (let t = 0; t < idx.getCount() / 3; t++) {
        const a = pos.getElement(idx.getScalar(t * 3), []);
        const b = pos.getElement(idx.getScalar(t * 3 + 1), []);
        const c = pos.getElement(idx.getScalar(t * 3 + 2), []);
        const p = [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
        const d = Math.hypot(p[0]! - target[0]!, p[1]! - target[1]!, p[2]! - target[2]!);
        if (best && d >= best.d) continue;
        const ua = uv.getElement(idx.getScalar(t * 3), []);
        const ub = uv.getElement(idx.getScalar(t * 3 + 1), []);
        const uc = uv.getElement(idx.getScalar(t * 3 + 2), []);
        best = {
          d,
          rgb: sampleRgb(tex, (ua[0]! + ub[0]! + uc[0]!) / 3, (ua[1]! + ub[1]! + uc[1]!) / 3),
        };
      }
    }
    expect(best).toBeTruthy();
    expect(best!.d).toBeLessThan(0.08);
    expect(isDonnerBodyPaintBlue(best!.rgb), `sample rgb ${best!.rgb.join(",")}`).toBe(true);
    expect(await countBodyPaintBlueFaces(body!)).toBeGreaterThan(400);
  });

  it("keeps the nose after the engine gap on BodyPaint", async () => {
    const doc = await new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .read(resolve("public/models/cars/donnerbuechse.glb"));
    const body = doc.getRoot().listMeshes().find((m) => m.getName() === "BodyPaint");
    expect(body).toBeTruthy();
    expect(countTriCentroids(body!, isDonnerNoseAfterGap)).toBeGreaterThan(20);

    let unpainted = 0;
    let sampleRgbAtGap: [number, number, number] | null = null;
    let sampleDist = Infinity;
    for (const prim of body!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const uv = prim.getAttribute("TEXCOORD_0");
      const idx = prim.getIndices();
      if (!pos || !uv || !idx) continue;
      const tex = await albedoOf(prim.getMaterial());
      for (let t = 0; t < idx.getCount() / 3; t++) {
        const i0 = idx.getScalar(t * 3);
        const i1 = idx.getScalar(t * 3 + 1);
        const i2 = idx.getScalar(t * 3 + 2);
        const a = pos.getElement(i0, []);
        const b = pos.getElement(i1, []);
        const c = pos.getElement(i2, []);
        const p = [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
        if (!isDonnerNosePaintBand(p)) continue;
        const ua = uv.getElement(i0, []);
        const ub = uv.getElement(i1, []);
        const uc = uv.getElement(i2, []);
        const rgb = sampleRgb(tex, (ua[0]! + ub[0]! + uc[0]!) / 3, (ua[1]! + ub[1]! + uc[1]!) / 3);
        if (noseFaceNeedsGaragePaintRetarget(rgb)) unpainted++;
        const d = Math.hypot(p[0]! + 0.316, p[1]! - 0.987, p[2]! - 1.28);
        if (d < sampleDist) {
          sampleDist = d;
          sampleRgbAtGap = rgb;
        }
      }
    }
    expect(unpainted, "inner nose after gap must take garage paint (not washed cyan)").toBe(0);
    expect(sampleRgbAtGap, "inner nose sample after the engine gap").toBeTruthy();
    expect(isBlueBodyPixel(...sampleRgbAtGap!), "gap sample must be garage-paint blue").toBe(true);
  });

  it("stock BodyPaint albedo has almost no baked door-flame oranges", async () => {
    const path = resolve("public/models/cars/donnerbuechse.glb");
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const sharp = (await import("sharp")).default;
    let orange = 0;
    let total = 0;
    for (const mat of doc.getRoot().listMaterials()) {
      if (mat.getName() !== "BodyPaint") continue;
      const raw = mat.getBaseColorTexture()?.getImage();
      if (!raw) continue;
      const { data } = await sharp(Buffer.from(raw)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4) {
        total++;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        if (r > 150 && r > g + 12 && r - b > 55 && g > 35 && g >= b - 10) orange++;
      }
    }
    expect(total).toBeGreaterThan(10_000);
    expect(orange / total).toBeLessThan(0.005);
  });

  it("Großer Motor GLB is silver Chrome (no body-paint bleed)", async () => {
    const path = resolve("public/models/parts/donnerbuechse-big_engine.glb");
    expect(statSync(path).size).toBeGreaterThan(40_000);
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(path);
    const mat = doc.getRoot().listMaterials()[0];
    expect(mat?.getName()).toBe("Chrome");
    const raw = mat?.getBaseColorTexture()?.getImage();
    expect(raw).toBeTruthy();
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(Buffer.from(raw!)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let red = 0;
    let blue = 0;
    let lit = 0;
    let grey = 0;
    let silver = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const lum = (r + g + b) / 3;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (r + g + b < 40) continue;
      lit++;
      const chroma = max - min;
      if (chroma < 28 && lum >= 80 && lum < 150) grey++;
      if (chroma < 28 && lum >= 150) silver++;
      if (r === max && chroma / max > 0.22 && r > g + 8 && r > b + 8) red++;
      if (b === max && chroma / max > 0.32 && b > r + 8 && b > g + 16) blue++;
    }
    expect(lit).toBeGreaterThan(10_000);
    expect(red / lit).toBeLessThan(0.02);
    expect(blue / lit).toBeLessThan(0.01);
    expect(grey / lit).toBeLessThan(0.05);
    expect(silver / lit).toBeGreaterThan(0.7);
  });

  it("Großer Motor has matching exhaust banks on both ±X sides", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/parts/donnerbuechse-big_engine.glb"),
    );
    const mesh = doc.getRoot().listMeshes()[0];
    expect(mesh).toBeTruthy();
    let left = 0;
    let right = 0;
    for (const prim of mesh!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        if (v[0]! < -0.12) left++;
        else if (v[0]! > 0.12) right++;
      }
    }
    expect(left).toBeGreaterThan(800);
    expect(right).toBeGreaterThan(800);
    expect(Math.abs(left - right) / Math.max(left, right)).toBeLessThan(0.25);
  });

  it("bakes Großer Motor F5 pose into the part GLB (bay origin + shrink)", async () => {
    const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(
      resolve("public/models/parts/donnerbuechse-big_engine.glb"),
    );
    const node = doc.getRoot().listNodes().find((n) => n.getName().startsWith("tripo_node_"));
    expect(node).toBeTruthy();
    const t = node!.getTranslation();
    const s = node!.getScale();
    expect(t[0]).toBeCloseTo(0.114, 3);
    expect(t[1]).toBeCloseTo(0.157, 3);
    expect(t[2]).toBeCloseTo(0.844, 3);
    expect(s[0]).toBeCloseTo(0.514, 3);
    expect(s[1]).toBeCloseTo(0.717, 3);
    expect(s[2]).toBeCloseTo(0.514, 3);
  });
});
