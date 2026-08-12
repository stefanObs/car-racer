import { expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--disable-gpu-sandbox",
    ],
  },
});

async function decalVertCounts(page: {
  evaluate: (fn: () => unknown) => Promise<unknown>;
}): Promise<Array<{ name: string; verts: number }>> {
  return page.evaluate(() => {
    const car = (window as unknown as { __idleCar?: { traverse: (fn: (o: any) => void) => void } }).__idleCar;
    if (!car) return [];
    const out: Array<{ name: string; verts: number }> = [];
    car.traverse((o) => {
      if (!o.name?.startsWith("stickerDecal")) return;
      out.push({ name: o.name, verts: o.geometry?.attributes?.position?.count ?? 0 });
    });
    return out;
  }) as Promise<Array<{ name: string; verts: number }>>;
}

test.describe("Aufkleber DecalGeometry", () => {
  test("projects readable sticker meshes on Blitz Bison Donner Bunker; nose on Käferkraft", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"],
          activeCar: "blitz",
          kits: {
            blitz: { ownedParts: [], equippedParts: [], paint: "#e03131", sticker: "flames" },
            bison: { ownedParts: [], equippedParts: [], paint: "#2f9e44", sticker: "bolt" },
            kaeferkraft: { ownedParts: [], equippedParts: [], paint: "#12b886", sticker: "flames" },
            donnerbuechse: { ownedParts: [], equippedParts: [], paint: "#228be6", sticker: "flames" },
            bunker: { ownedParts: [], equippedParts: [], paint: "#f8f9fa", sticker: "flames" },
          },
          unlockedLevels: ["blitz_cup_01_hafenstart"],
          cupStars: {},
          cupIndexUnlocked: 1,
        }),
      );
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-screen", "garage", { timeout: 60_000 });

    for (const id of ["blitz", "bison", "donnerbuechse", "bunker"] as const) {
      await page.locator(`[data-act="car"][data-car="${id}"]`).click();
      await page.waitForTimeout(600);
      const decals = await decalVertCounts(page);
      expect(decals.length, id).toBeGreaterThan(0);
      expect(
        decals.every((d) => d.verts >= 3),
        `${id} empty decal`,
      ).toBe(true);
      await page.screenshot({ path: `test-results/car-stickers-${id}.png`, fullPage: true });
    }

    await page.locator('[data-act="car"][data-car="kaeferkraft"]').click();
    await page.waitForTimeout(600);
    expect(await decalVertCounts(page)).toEqual([]);
    const nose = await page.evaluate(() => {
      const car = (window as unknown as { __idleCar?: { getObjectByName: (n: string) => unknown } }).__idleCar;
      return Boolean(car?.getObjectByName("buggyNoseVariant"));
    });
    expect(nose).toBe(true);
    await page.screenshot({ path: "test-results/car-stickers-kaeferkraft.png", fullPage: true });
  });
});
