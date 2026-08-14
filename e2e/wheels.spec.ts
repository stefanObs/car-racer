import { expect, test } from "@playwright/test";

test.describe("spinning wheels", () => {
  test("Bison StockWheels roll with speed and yaw when steering", async ({ page }) => {
    await page.addInitScript(() => {
      const kit = (paint: string) => ({
        ownedParts: [] as string[],
        equippedParts: [] as string[],
        paint,
        sticker: "none",
        ownedPaints: [paint],
        ownedStickers: ["none"],
      });
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 99999,
          ownedCars: ["blitz", "bison"],
          activeCar: "bison",
          kits: { blitz: kit("#e03131"), bison: kit("#2f9e44") },
          unlockedLevels: ["blitz_cup_01_hafenstart"],
          cupStars: {},
          cupIndexUnlocked: 1,
        }),
      );
    });

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible({ timeout: 45_000 });

    await page.getByRole("button", { name: "Cup" }).click();
    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();
    await expect(page.locator("#race-hud")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#game-canvas")).toBeVisible();
    await page.locator("#game-canvas").click({ force: true });

    await page.keyboard.down("ArrowUp");
    await page.keyboard.down("ArrowLeft");
    await page.waitForFunction(
      () => {
        const cars = (
          window as unknown as {
            __ccCars?: Array<{ isPlayer: boolean; modelId?: string; speed: number; steer: number }>;
          }
        ).__ccCars;
        const player = (cars ?? []).find((c) => c.isPlayer);
        if (!player || player.modelId !== "bison") return false;
        if (player.speed < 4 || Math.abs(player.steer) < 0.4) return false;

        const wheels = (
          window as unknown as {
            __spinWheels?: Array<{
              isFront: boolean;
              spinner: { rotation: { x: number }; parent: unknown };
              steer: { rotation: { y: number } };
            }>;
          }
        ).__spinWheels;
        const live = (wheels ?? []).filter((w) => w.spinner?.parent);
        const spun = live.filter((w) => Math.abs(w.spinner.rotation.x) > 0.8);
        const frontYaw = live.filter((w) => w.isFront && Math.abs(w.steer.rotation.y) > 0.12);
        return spun.length >= 4 && frontYaw.length >= 1;
      },
      null,
      { timeout: 90_000 },
    );

    const probe = await page.evaluate(() => {
      const cars = (
        window as unknown as {
          __ccCars?: Array<{ isPlayer: boolean; modelId?: string; speed: number; steer: number }>;
        }
      ).__ccCars;
      const player = (cars ?? []).find((c) => c.isPlayer);
      const wheels = (
        window as unknown as {
          __spinWheels?: Array<{
            isFront: boolean;
            spinner: { rotation: { x: number }; parent: unknown };
            steer: { rotation: { y: number } };
          }>;
        }
      ).__spinWheels;
      const live = (wheels ?? []).filter((w) => w.spinner?.parent);
      const maxAbs = live.length ? Math.max(...live.map((w) => Math.abs(w.spinner.rotation.x))) : 0;
      const frontYaw = live.filter((w) => w.isFront).map((w) => w.steer.rotation.y);
      const rearYaw = live.filter((w) => !w.isFront).map((w) => w.steer.rotation.y);
      return {
        modelId: player?.modelId,
        speed: player?.speed,
        steer: player?.steer,
        count: live.length,
        maxAbs,
        frontYaw,
        rearYaw,
      };
    });
    expect(probe.modelId).toBe("bison");
    expect(probe.count).toBeGreaterThanOrEqual(4);
    expect(probe.maxAbs).toBeGreaterThan(0.8);
    expect(probe.frontYaw.some((y) => Math.abs(y) > 0.12)).toBe(true);
    expect(probe.rearYaw.every((y) => Math.abs(y) < 0.01)).toBe(true);

    await page.screenshot({ path: "test-results/wheels-spin-race.png", fullPage: false });
    await page.keyboard.up("ArrowUp");
    await page.keyboard.up("ArrowLeft");
  });
});
