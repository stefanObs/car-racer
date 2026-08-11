import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function featureCentroidX(path: string, pick: (r: number, g: number, b: number) => boolean) {
  const doc = await io.read(path);
  const tex = doc.getRoot().listTextures()[0];
  const img = tex?.getImage();
  if (!img) throw new Error(`no texture in ${path}`);
  const { data, info } = await sharp(img).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const sample = (u: number, v: number) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(((((u % 1) + 1) % 1) * w))));
    const y = Math.min(h - 1, Math.max(0, Math.floor((1 - (((v % 1) + 1) % 1)) * h)));
    const i = (y * w + x) * ch;
    return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
  };
  let n = 0;
  let sumX = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const uv = prim.getAttribute("TEXCOORD_0");
      if (!pos || !uv) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const p = pos.getElement(i, []);
        const t = uv.getElement(i, []);
        const [r, g, b] = sample(t[0]!, t[1]!);
        if (!pick(r, g, b)) continue;
        sumX += p[0]!;
        n++;
      }
    }
  }
  return { n, meanX: n ? sumX / n : 0 };
}

describe("Käferkraft nose props face buggy forward (−X)", () => {
  it("skull eye sockets sit on the −X half (looking out from the bumper)", async () => {
    const { n, meanX } = await featureCentroidX(resolve("public/models/props/buggy-skull.glb"), (r, g, b) => (r + g + b) / 3 < 45);
    expect(n).toBeGreaterThan(80);
    expect(meanX).toBeLessThan(-0.02);
  });

  it("dog tongue marks sit on the −X half", async () => {
    const { n, meanX } = await featureCentroidX(
      resolve("public/models/props/buggy-dog.glb"),
      (r, g, b) => r > 160 && g < 120 && b < 120,
    );
    expect(n).toBeGreaterThan(10);
    expect(meanX).toBeLessThan(0);
  });

  it("bird beak/chest warm marks sit on the −X half", async () => {
    const { n, meanX } = await featureCentroidX(
      resolve("public/models/props/buggy-bird.glb"),
      (r, g, b) => r > 150 && g < 130 && b < 130,
    );
    expect(n).toBeGreaterThan(40);
    expect(meanX).toBeLessThan(-0.02);
  });
});
