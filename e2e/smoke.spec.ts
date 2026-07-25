import { expect, test } from "@playwright/test";

test.describe("Crash Circuit smoke", () => {
  test("loads menu, opens cup, starts a race with HUD", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Crash Circuit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Freier Modus" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Garage" })).toBeVisible();

    await page.getByRole("button", { name: "Cup" }).click();
    await expect(page.getByRole("heading", { name: "Blitz-Cup" })).toBeVisible();

    await page.getByRole("button", { name: /1\.\s*Hafenstart/ }).click();

    await expect(page.locator("#race-hud")).toBeVisible();
    await expect(page.locator("#race-hud")).toContainText(/Platz/);
    await expect(page.locator("#race-hud")).toContainText(/Runde/);
    await expect(page.locator("#game-canvas")).toBeVisible();
  });

  test("opens garage with CHF and parts", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Garage" }).click();
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await expect(page.locator(".panel.garage .meta")).toContainText(/CHF|Fr/);
    await expect(page.getByRole("button", { name: /Großer Motor/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Blitz/ })).toBeVisible();
  });
});
