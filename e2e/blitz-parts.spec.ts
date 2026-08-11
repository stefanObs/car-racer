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

async function idlePartNames(page: { evaluate: (fn: () => string[]) => Promise<string[]> }): Promise<string[]> {
  return page.evaluate(() => {
    const car = (window as unknown as { __idleCar?: { traverse: (fn: (o: { name: string }) => void) => void } })
      .__idleCar;
    if (!car) return [];
    const found: string[] = [];
    car.traverse((o) => {
      if (o.name.startsWith("blitzPart-")) found.push(o.name);
    });
    return found;
  });
}

test.describe("Blitz equipped part meshes", () => {
  test("garage Ausrüsten shows spoiler / spike / nitro add-ons", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz", "bison"],
          activeCar: "blitz",
          kits: {
            blitz: {
              ownedParts: ["rear_spoiler", "big_engine", "nitro_kit", "spike_bumper"],
              equippedParts: [],
              paint: "#e03131",
              sticker: "none",
            },
            bison: {
              ownedParts: ["rear_spoiler", "nitro_kit", "spike_bumper"],
              equippedParts: [],
              paint: "#2f9e44",
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
    await expect(page.getByRole("button", { name: /Heckspoiler/ })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "test-results/blitz-parts-before.png", fullPage: true });

    const spoiler = page.locator('[data-part="rear_spoiler"]');
    const spike = page.locator('[data-part="spike_bumper"]');
    const nitro = page.locator('[data-part="nitro_kit"]');
    await spoiler.click();
    await spike.click();
    await nitro.click();
    await expect(spoiler).toContainText("Ablegen");
    await page.waitForTimeout(800);

    expect(await idlePartNames(page)).toEqual(
      expect.arrayContaining(["blitzPart-rear_spoiler", "blitzPart-spike_bumper", "blitzPart-nitro_kit"]),
    );

    await page.screenshot({ path: "test-results/blitz-parts-after.png", fullPage: true });

    await spoiler.click();
    await expect(spoiler).toContainText("Ausrüsten");
    await page.waitForTimeout(400);
    const afterUnequip = await idlePartNames(page);
    expect(afterUnequip).not.toContain("blitzPart-rear_spoiler");
    expect(afterUnequip).toEqual(expect.arrayContaining(["blitzPart-spike_bumper", "blitzPart-nitro_kit"]));
    await page.screenshot({ path: "test-results/blitz-parts-unequip-spoiler.png", fullPage: true });

    await page.getByRole("button", { name: /^Bison/ }).click();
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Bison");
    await page.waitForTimeout(800);
    expect(await idlePartNames(page)).toEqual([]);
    await page.screenshot({ path: "test-results/blitz-parts-bison.png", fullPage: true });
  });
});
