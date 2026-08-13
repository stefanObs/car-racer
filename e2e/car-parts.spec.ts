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
});
