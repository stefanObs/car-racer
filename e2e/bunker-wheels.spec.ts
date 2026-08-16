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

function wheelProbe() {
  const car = (
    window as unknown as {
      __idleCar?: {
        traverse: (
          fn: (o: {
            name?: string;
            visible: boolean;
            scale: { x: number };
          }) => void,
        ) => void;
      };
    }
  ).__idleCar;
  const wheels: { name: string; visible: boolean; scaleX: number }[] = [];
  let upgradeTire = false;
  let overlay = false;
  car?.traverse((o) => {
    if (o.name && /^StockWheel_(FL|FR|RL|RR)$/.test(o.name)) {
      wheels.push({ name: o.name, visible: o.visible, scaleX: o.scale.x });
    }
    if (o.name === "UpgradeTire") upgradeTire = true;
    if (o.name === "carPart-big_wheels") overlay = true;
  });
  return { wheels, upgradeTire, overlay };
}

test.describe("Bunker Große Räder", () => {
  test("garage scales StockWheel_* (no procedural overlay)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"],
          activeCar: "bunker",
          kits: {
            bunker: {
              ownedParts: ["big_wheels"],
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
    });

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-screen", "garage", { timeout: 60_000 });
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Bunker");
    await page.waitForTimeout(1200);

    const stock = await page.evaluate(wheelProbe);
    expect(stock.wheels.map((w) => w.name).sort()).toEqual([
      "StockWheel_FL",
      "StockWheel_FR",
      "StockWheel_RL",
      "StockWheel_RR",
    ]);
    expect(stock.wheels.every((w) => w.visible && Math.abs(w.scaleX - 1) < 0.02)).toBe(true);
    expect(stock.upgradeTire).toBe(false);
    await page.locator("#game-canvas").screenshot({ path: "test-results/bunker-wheels-stock.png" });

    await page.locator('[data-part="big_wheels"]').click();
    await expect(page.locator('[data-part="big_wheels"]')).toContainText("Ablegen");
    await page.waitForTimeout(800);

    const big = await page.evaluate(wheelProbe);
    expect(big.wheels.every((w) => w.visible && Math.abs(w.scaleX - 1.35) < 0.02)).toBe(true);
    expect(big.upgradeTire).toBe(false);
    expect(big.overlay).toBe(false);
    await page.locator("#game-canvas").screenshot({ path: "test-results/bunker-wheels-big.png" });
  });
});
