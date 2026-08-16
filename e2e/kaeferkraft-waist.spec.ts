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

test.describe("Käferkraft waist poles", () => {
  test("garage Verstärkter Rahmen covers BodyPaint span with buried caps", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"],
          activeCar: "kaeferkraft",
          kits: {
            kaeferkraft: {
              ownedParts: ["reinforced_frame"],
              equippedParts: ["reinforced_frame"],
              paint: "#12b886",
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
    await expect(page.locator(".garage-car.is-active .garage-car__name")).toHaveText("Käferkraft");
    await expect(page.locator('[data-part="reinforced_frame"]')).toContainText("Ablegen");
    await page.waitForTimeout(1200);
    await page.keyboard.press("F6");
    await page.waitForTimeout(200);
    const canvas = page.locator("#game-canvas");
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.45, { steps: 12 });
      await page.mouse.up();
    }
    await page.waitForTimeout(400);
    await canvas.screenshot({ path: "test-results/kaeferkraft-waist.png" });

    const coverage = await page.evaluate(() => {
      type Obj = {
        name: string;
        children: Obj[];
        geometry?: {
          computeBoundingBox?: () => void;
          boundingBox?: { min: { y: number }; max: { y: number } } | null;
        };
        position: { x: number; y: number; z: number };
      };
      const car = (window as unknown as { __idleCar?: Obj }).__idleCar;
      if (!car)
        return {
          error: "no idle car",
          waists: [] as { name: string; mid: [number, number, number]; half: number }[],
          stays: [] as { name: string; mid: [number, number, number] }[],
        };
      const waists: { name: string; mid: [number, number, number]; half: number }[] = [];
      const stays: { name: string; mid: [number, number, number] }[] = [];
      const walk = (o: Obj) => {
        if (o.name === "WaistL" || o.name === "WaistR") {
          o.geometry?.computeBoundingBox?.();
          const bb = o.geometry?.boundingBox;
          const half = bb ? (bb.max.y - bb.min.y) / 2 : 0;
          waists.push({ name: o.name, mid: [o.position.x, o.position.y, o.position.z], half });
        }
        if (o.name === "WaistToFrontTop_L" || o.name === "WaistToFrontTop_R") {
          stays.push({ name: o.name, mid: [o.position.x, o.position.y, o.position.z] });
        }
        for (const c of o.children) walk(c);
      };
      walk(car);
      return { waists, stays, error: waists.length === 0 ? "no Waist" : "" };
    });

    expect(coverage.error).toBe("");
    expect(coverage.waists).toHaveLength(2);
    expect(coverage.stays).toHaveLength(2);
    const left = coverage.waists.find((w) => w.name === "WaistL");
    const right = coverage.waists.find((w) => w.name === "WaistR");
    const stayL = coverage.stays.find((s) => s.name === "WaistToFrontTop_L");
    const stayR = coverage.stays.find((s) => s.name === "WaistToFrontTop_R");
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(left!.mid[2]).toBeLessThan(0);
    expect(right!.mid[2]).toBeGreaterThan(0);
    expect(left!.mid[0]).toBeGreaterThan(-0.05);
    expect(left!.mid[0]).toBeLessThan(0.05);
    expect(left!.mid[1]).toBeGreaterThan(1.03);
    expect(left!.mid[1]).toBeLessThan(1.08);
    expect(left!.mid[2]).toBeGreaterThan(-0.56);
    expect(left!.mid[2]).toBeLessThan(-0.49);
    expect(right!.mid[0]).toBeGreaterThan(-0.05);
    expect(right!.mid[0]).toBeLessThan(0.15);
    expect(left!.half).toBeGreaterThan(0.6);
    expect(left!.half).toBeLessThan(0.72);
    expect(right!.half).toBeGreaterThan(0.55);
    expect(right!.mid[2]).toBeGreaterThan(0.5);
    expect(right!.mid[2]).toBeLessThan(0.58);
    expect(stayL).toBeTruthy();
    expect(stayR).toBeTruthy();
    expect(stayL!.mid[1]).toBeGreaterThan(1.28);
    expect(stayL!.mid[1]).toBeLessThan(1.42);
    expect(stayL!.mid[2]).toBeLessThan(-0.45);
    expect(stayR!.mid[1]).toBeGreaterThan(1.28);
    expect(stayR!.mid[1]).toBeLessThan(1.42);
    expect(stayR!.mid[2]).toBeGreaterThan(0.45);
  });
});
