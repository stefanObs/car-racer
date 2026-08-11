import { expect, test } from "@playwright/test";

test.describe("garage bay workshop stock", () => {
  test("opens the hub with inventory grid and a WebGL bay", async ({ page }) => {
    const glbOk = Promise.all(
      ["cabinet", "workbench", "tire-stack", "shelf", "drums", "toolchest", "gas", "hoist"].map((name) =>
        page.waitForResponse((res) => res.url().includes(`/models/garage/${name}.glb`) && res.ok()),
      ),
    );
    await page.goto("/");
    await glbOk;
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ausrüsten/ })).toBeVisible();
    await expect(page.getByText(/Bestand — nur/)).toBeVisible();
    await expect(page.locator(".garage-parts--grid").first()).toBeVisible();
    await expect(page.locator("#game-canvas")).toBeVisible();
    await expect(page.locator(".boot-error")).toHaveCount(0);

    await page.waitForFunction(() => {
      const bay = (window as unknown as {
        __garageBay?: { getObjectByName: (n: string) => { children: unknown[] } | undefined };
      }).__garageBay;
      const stock = bay?.getObjectByName("garageStock");
      const hero = bay?.getObjectByName("garageHero");
      return Boolean(
        stock &&
          stock.children.length === 7 &&
          hero &&
          hero.children.length === 3 &&
          bay?.getObjectByName("garageToolChest") &&
          bay?.getObjectByName("garageGasBottles") &&
          bay?.getObjectByName("garageHoist"),
      );
    });

    await page.screenshot({ path: "/tmp/garage-hub-ui.png", fullPage: true });
    await page.locator(".panel.garage").evaluate((el) => {
      (el as HTMLElement).style.opacity = "0";
      (el as HTMLElement).style.pointerEvents = "none";
    });
    const stats = page.locator(".car-stats-popup");
    if ((await stats.count()) > 0) {
      await stats.evaluate((el) => {
        (el as HTMLElement).style.display = "none";
      });
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: "/tmp/garage-bay-stock.png", fullPage: true });
  });
});
