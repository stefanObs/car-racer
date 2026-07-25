import { expect, test } from "@playwright/test";

test.describe("Crash Circuit smoke", () => {
  test("boots into garage hub, opens cup, starts a race with HUD", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Freier Modus" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ad-hoc" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ausrüsten/ })).toBeVisible();

    await page.getByRole("button", { name: "Cup" }).click();
    await expect(page.getByRole("heading", { name: "Blitz-Cup" })).toBeVisible();

    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();

    await expect(page.locator("#race-hud")).toBeVisible();
    await expect(page.locator("#race-hud")).toContainText(/Platz/);
    await expect(page.locator("[data-dev-name='hud.lap']")).toBeVisible();
    await expect(page.locator("[data-dev-name='hud.lap']")).toContainText(/Runde/);
    await expect(page.locator("[data-dev-name='hud.lap.current']")).toHaveText("1");
    await expect(page.locator("#race-hud")).toContainText(/Runde/);
    await expect(page.locator("#game-canvas")).toBeVisible();
  });

  test("garage shows wallet and equip/shop parts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-screen", "garage");
    await expect(page.locator("[data-dev-name='garage.wallet']")).toContainText(/CHF|Fr/);
    await expect(page.getByRole("button", { name: /Großer Motor/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Kaufen/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Blitz Sportwagen/ })).toBeVisible();

    // Drag on canvas (behind UI) — turntable orbit
    const canvas = page.locator("#game-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const x = box!.x + box!.width * 0.72;
    const y = box!.y + box!.height * 0.55;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(canvas).toHaveClass(/is-orbiting/);
    await page.mouse.move(x + 120, y);
    await page.mouse.up();
    await expect(canvas).not.toHaveClass(/is-orbiting/);
  });

  test("keyboard focus on Cup then opens cup list", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Cup" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Blitz-Cup" })).toBeVisible();
  });

  test("tablet landscape keeps touch controls in race", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
    });
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-touch", "1");
    await page.getByRole("button", { name: "Cup" }).click();
    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();
    await expect(page.locator(".touch-controls")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gas" })).toBeVisible();
  });

  test("opens ad-hoc seed screen and can start a race", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ad-hoc" }).click();
    await expect(page.getByRole("heading", { name: "Ad-hoc" })).toBeVisible();
    await expect(page.locator("input[data-seed-input]")).toBeVisible();
    await page.getByRole("button", { name: /Start #/ }).click();
    await expect(page.locator("#race-hud")).toBeVisible();
    await expect(page.locator("#race-hud")).toContainText(/Platz/);
  });
});
