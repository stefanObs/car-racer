import { expect, test } from "@playwright/test";

test.describe("garage inspect release", () => {
  test("RMB release snaps car flat on the pad", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await page.waitForTimeout(1500);

    const canvas = page.locator("#game-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const x = box!.x + box!.width * 0.72;
    const y = box!.y + box!.height * 0.55;

    const readPose = () =>
      page.evaluate(() => {
        const p = (
          window as unknown as {
            __garageOrbit?: { position: { y: number }; rotation: { x: number } };
          }
        ).__garageOrbit;
        if (!p) return null;
        return { y: p.position.y, rx: p.rotation.x };
      });

    const sit = await readPose();
    expect(sit).toBeTruthy();

    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(x + 40, y + 140);
    await page.waitForTimeout(100);
    const held = await readPose();
    expect(held!.rx).toBeGreaterThan(0.4);
    expect(held!.y).toBeGreaterThan(sit!.y + 0.1);

    await page.mouse.up({ button: "right" });
    await page.waitForTimeout(100);
    const released = await readPose();
    expect(released!.rx).toBeCloseTo(0, 3);
    expect(released!.y).toBeCloseTo(sit!.y, 3);
  });
});
