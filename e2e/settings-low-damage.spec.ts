import { expect, test } from "@playwright/test";

test.describe("Einstellungen · Wenig Schaden", () => {
  test("toggles Wenig Schaden on in the settings panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
    await page.locator('[data-dev-name="garage.settings"]').click();

    const toggle = page.locator('[data-act="toggle-low-damage"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("Wenig Schaden");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    await toggle.click();
    await expect(page.locator('[data-act="toggle-low-damage"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-act="toggle-low-damage"]')).toContainText("AN");
  });
});
