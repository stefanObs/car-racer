import { expect, test } from "@playwright/test";

test.describe("F5 mesh studio", () => {
  test("shows the car on a green void with a coordinate panel", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F5 Mesh");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible({ timeout: 45_000 });

    await page.keyboard.press("F5");
    await expect(page.locator("html")).toHaveClass(/dev-mesh-inspect-mode/);
    await expect(page.locator("[data-dev-name='dev.mesh-inspect']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect']")).toContainText("Mesh-Raum");
    await expect(page.locator(".panel.garage")).toBeHidden();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.edit']")).toHaveText("Platzieren AUS");
    await page.screenshot({ path: "tmp/f5-mesh-inspect.png" });

    await page.keyboard.press("E");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.edit']")).toHaveText("Platzieren AN");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.rotate']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.scaleUniform']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.scaleFree']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.comp.edge']")).toBeVisible();

    await page.keyboard.press("R");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.rotate']")).toHaveClass(/is-on/);
    await page.keyboard.press("S");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.scaleUniform']")).toHaveClass(/is-on/);
    await page.keyboard.press("X");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.scaleFree']")).toHaveClass(/is-on/);
    await page.keyboard.press("K");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.comp.edge']")).toHaveClass(/is-on/);
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.hint']")).toContainText("Klick Kante");

    await page.locator("[data-dev-name='dev.mesh-inspect.edit']").click();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.edit']")).toHaveText("Platzieren AUS");

    await page.keyboard.press("F5");
    await expect(page.locator("html")).not.toHaveClass(/dev-mesh-inspect-mode/);
    await expect(page.locator(".panel.garage")).toBeVisible();
  });
});
