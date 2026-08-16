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

async function idlePartNames(page: {
  evaluate: (fn: () => string[]) => Promise<string[]>;
}): Promise<string[]> {
  return page.evaluate(() => {
    const car = (
      window as unknown as {
        __idleCar?: { traverse: (fn: (o: { name: string }) => void) => void };
      }
    ).__idleCar;
    if (!car) return [];
    const found: string[] = [];
    car.traverse((o) => {
      if (o.name.startsWith("carPart-") || o.name.startsWith("blitzPart-")) found.push(o.name);
    });
    return found;
  });
}

const OWNED_BLITZ = [
  "rear_spoiler",
  "big_engine",
  "nitro_kit",
  "spike_bumper",
  "offroad_suspension",
] as const;

test.describe("Equipped part meshes (all cars)", () => {
  test("garage Ausrüsten shows add-ons on Blitz and Bison", async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript((ownedBlitz) => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"],
          activeCar: "blitz",
          kits: {
            blitz: {
              ownedParts: [...ownedBlitz],
              equippedParts: [],
              paint: "#e03131",
              sticker: "none",
            },
            bison: {
              ownedParts: [
                "rear_spoiler",
                "nitro_kit",
                "spike_bumper",
                "better_brakes",
                "big_engine",
              ],
              equippedParts: [],
              paint: "#2f9e44",
              sticker: "none",
            },
            kaeferkraft: {
              ownedParts: ["rear_spoiler", "big_engine", "nitro_kit"],
              equippedParts: [],
              paint: "#12b886",
              sticker: "none",
            },
            donnerbuechse: {
              ownedParts: ["rear_spoiler", "spike_bumper"],
              equippedParts: [],
              paint: "#228be6",
              sticker: "none",
            },
            bunker: {
              ownedParts: ["rear_spoiler", "better_brakes", "nitro_kit"],
              equippedParts: [],
              paint: "#868e96",
              sticker: "none",
            },
          },
          unlockedLevels: ["blitz_cup_01_hafenstart"],
          cupStars: {},
          cupIndexUnlocked: 1,
        }),
      );
    }, OWNED_BLITZ);

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-screen", "garage", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: /Heckspoiler/ })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/car-parts-blitz-before.png", fullPage: true });

    const spoiler = page.locator('[data-part="rear_spoiler"]');
    const spike = page.locator('[data-part="spike_bumper"]');
    const nitro = page.locator('[data-part="nitro_kit"]');
    await expect(page.locator('[data-part="better_brakes"]')).toHaveCount(0);
    await spoiler.click();
    await spike.click();
    await nitro.click();
    await expect(spoiler).toContainText("Ablegen");
    await page.waitForTimeout(800);

    expect(await idlePartNames(page)).toEqual(
      expect.arrayContaining([
        "carPart-rear_spoiler",
        "carPart-spike_bumper",
        "carPart-nitro_kit",
      ]),
    );

    await page.screenshot({ path: "test-results/car-parts-blitz-after.png", fullPage: true });

    await spoiler.click();
    await expect(spoiler).toContainText("Ausrüsten");
    await page.waitForTimeout(400);
    const afterUnequip = await idlePartNames(page);
    expect(afterUnequip).not.toContain("carPart-rear_spoiler");
    expect(afterUnequip).toEqual(
      expect.arrayContaining(["carPart-spike_bumper", "carPart-nitro_kit"]),
    );

    await page.getByRole("button", { name: /^Bison/ }).click();
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Bison");
    await page.waitForTimeout(600);
    await page.locator('[data-part="rear_spoiler"]').click();
    await page.locator('[data-part="nitro_kit"]').click();
    await page.locator('[data-part="spike_bumper"]').click();
    await page.waitForTimeout(1200);
    expect(await idlePartNames(page)).toEqual(
      expect.arrayContaining([
        "carPart-rear_spoiler",
        "carPart-nitro_kit",
        "carPart-spike_bumper",
      ]),
    );
    await page.screenshot({ path: "test-results/car-parts-bison.png", fullPage: true });

    await page.locator('button[data-car="kaeferkraft"]').click();
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Käferkraft");
    await page.locator('[data-part="big_engine"]').click();
    await page.locator('[data-part="rear_spoiler"]').click();
    await page.waitForTimeout(1200);
    expect(await idlePartNames(page)).toEqual(
      expect.arrayContaining(["carPart-big_engine", "carPart-rear_spoiler"]),
    );
    await page.screenshot({ path: "test-results/car-parts-kaeferkraft.png", fullPage: true });

    await page.locator('button[data-car="donnerbuechse"]').click();
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Donnerbüchse");
    await page.locator('[data-part="rear_spoiler"]').click();
    await page.locator('[data-part="spike_bumper"]').click();
    await page.waitForTimeout(1200);
    expect(await idlePartNames(page)).toEqual(
      expect.arrayContaining(["carPart-rear_spoiler", "carPart-spike_bumper"]),
    );
    await page.screenshot({ path: "test-results/car-parts-donner.png", fullPage: true });

    await page.locator('button[data-car="bunker"]').click();
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Bunker");
    await page.locator('[data-part="rear_spoiler"]').click();
    await page.locator('[data-part="nitro_kit"]').click();
    await page.waitForTimeout(1200);
    expect(await idlePartNames(page)).toEqual(
      expect.arrayContaining(["carPart-rear_spoiler", "carPart-nitro_kit"]),
    );
    await page.screenshot({ path: "test-results/car-parts-bunker.png", fullPage: true });
  });

  test("Blitz Großer Motor red follows garage paint", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz"],
          activeCar: "blitz",
          kits: {
            blitz: {
              ownedParts: ["big_engine"],
              equippedParts: ["big_engine"],
              paint: "#339af0",
              sticker: "none",
            },
          },
          unlockedLevels: ["blitz_cup_01_hafenstart"],
          cupStars: {},
          cupIndexUnlocked: 1,
        }),
      );
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-screen", "garage", { timeout: 60_000 });
    await expect(page.locator('[data-part="big_engine"]')).toContainText("Ablegen");
    await page.waitForTimeout(800);
    expect(await idlePartNames(page)).toContain("carPart-big_engine");
    const scoopMat = await page.evaluate(() => {
      const car = (window as unknown as { __idleCar?: { traverse: (fn: (o: Record<string, unknown>) => void) => void } })
        .__idleCar;
      if (!car) return { error: "no-car" };
      let info: Record<string, unknown> | null = null;
      car.traverse((o) => {
        if (o.name !== "carPart-big_engine") return;
        (o as { traverse: (fn: (m: Record<string, unknown>) => void) => void }).traverse((m) => {
          if (!m.isMesh) return;
          const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as {
            map?: { constructor?: { name?: string }; image?: { width?: number; height?: number } };
            color?: { getHex: () => number };
          };
          if (!mat) return;
          info = {
            mapType: mat.map?.constructor?.name ?? "none",
            color: mat.color?.getHex?.() ?? null,
            imageW: mat.map?.image?.width ?? 0,
            imageH: mat.map?.image?.height ?? 0,
            canvas: typeof HTMLCanvasElement !== "undefined" && mat.map?.image instanceof HTMLCanvasElement,
          };
        });
      });
      return info ?? { error: "no-mesh" };
    });
    expect(scoopMat, JSON.stringify(scoopMat)).toMatchObject({ canvas: true });
    const atlasRed = await page.evaluate(() => {
      const car = (window as unknown as { __idleCar?: { traverse: (fn: (o: Record<string, unknown>) => void) => void } })
        .__idleCar;
      if (!car) return -1;
      let red = 0;
      car.traverse((o) => {
        if (o.name !== "carPart-big_engine") return;
        (o as { traverse: (fn: (m: Record<string, unknown>) => void) => void }).traverse((m) => {
          if (!m.isMesh) return;
          const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as {
            map?: { image?: HTMLCanvasElement };
          };
          const c = mat.map?.image;
          if (!c || typeof c.getContext !== "function") return;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          const data = ctx.getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
            if (r > 140 && r > g * 1.6 && r > b * 1.6) red++;
          }
        });
      });
      return red;
    });
    expect(atlasRed, "baked scoop atlas should not keep comic red").toBe(0);
    await page.screenshot({ path: "test-results/car-parts-blitz-engine-blue-paint.png", fullPage: true });
  });
});
