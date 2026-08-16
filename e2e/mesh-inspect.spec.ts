import { expect, test } from "@playwright/test";

test.describe("F5 mesh studio", () => {
  test("shows the car on a blue void with a coordinate panel", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F5 Mesh");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible({ timeout: 45_000 });

    await page.keyboard.press("F5");
    await expect(page.locator("html")).toHaveClass(/dev-mesh-inspect-mode/);
    await expect(page.locator("[data-dev-name='dev.mesh-inspect']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect']")).toContainText("Mesh-Raum");
    await expect(page.locator(".panel.garage")).toBeHidden();
    await page.screenshot({ path: "tmp/f5-mesh-inspect.png" });

    await page.keyboard.press("F5");
    await expect(page.locator("html")).not.toHaveClass(/dev-mesh-inspect-mode/);
    await expect(page.locator(".panel.garage")).toBeVisible();
  });
});
