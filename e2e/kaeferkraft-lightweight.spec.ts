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

test.describe("Käferkraft Leichtbau split", () => {
  test("garage Leichtbau mounts detached LightweightL / LightweightR", async ({ page }) => {
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
              ownedParts: ["lightweight_body"],
              equippedParts: ["lightweight_body"],
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
    await expect(page.locator('[data-part="lightweight_body"]')).toContainText("Ablegen");
    await page.waitForTimeout(1200);

    const coverage = await page.evaluate(() => {
      type Obj = {
        name: string;
        children: Obj[];
        position: { x: number; y: number; z: number };
      };
      const car = (window as unknown as { __idleCar?: Obj }).__idleCar;
      if (!car) return { error: "no idle car", panels: [] as { name: string; x: number }[] };
      const panels: { name: string; x: number }[] = [];
      const walk = (o: Obj) => {
        if (o.name === "LightweightL" || o.name === "LightweightR") {
          panels.push({ name: o.name, x: o.position.x });
        }
        for (const c of o.children) walk(c);
      };
      walk(car);
      return {
        panels,
        error: panels.length === 0 ? "no LightweightL/R" : "",
        wrapper: Boolean(
          (function find(o: Obj): boolean {
            if (o.name === "carPart-lightweight_body") return true;
            return o.children.some(find);
          })(car),
        ),
      };
    });

    expect(coverage.error).toBe("");
    expect(coverage.wrapper).toBe(true);
    expect(coverage.panels).toHaveLength(2);
    const left = coverage.panels.find((p) => p.name === "LightweightL");
    const right = coverage.panels.find((p) => p.name === "LightweightR");
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(left!.x).toBeGreaterThan(0.4);
    expect(right!.x).toBeLessThan(-0.4);

    await page.locator("#game-canvas").screenshot({ path: "test-results/kaeferkraft-lightweight.png" });
  });
});
