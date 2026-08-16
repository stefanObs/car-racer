import { expect, test } from "@playwright/test";

test.describe("F6 mesh studio", () => {
  test("shows the car on a green void with a coordinate panel", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F6 Mesh");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible({ timeout: 45_000 });

    await page.keyboard.press("F6");
    await expect(page.locator("html")).toHaveClass(/dev-mesh-inspect-mode/);
    await expect(page.locator("[data-dev-name='dev.mesh-inspect']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect']")).toContainText("Mesh-Raum");
    await expect(page.locator(".panel.garage")).toBeHidden();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.edit']")).toHaveText("Platzieren AUS");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.catalog']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.catalog']")).toContainText("BodyPaint", {
      timeout: 15_000,
    });
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.box']")).toBeVisible();
    await page.locator("[data-dev-name='dev.mesh-inspect.tool.box']").click();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.box']")).toHaveClass(/is-on/);
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.hint']")).toContainText("Ziehen malt Kasten");

    const canvas = page.locator("#game-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width * 0.28, box!.y + box!.height * 0.28);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.72, box!.y + box!.height * 0.72, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.box']")).toContainText("Mesh-Raum Kasten", {
      timeout: 10_000,
    });
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.box']")).toContainText("min:");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.copy-box']")).toHaveText("Kasten kopieren");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.reset-box']")).toHaveText("Zurück");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.hint']")).toContainText("dreht Auto");
    await page.screenshot({ path: "tmp/f6-mesh-inspect-box.png" });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.tool.box']")).not.toHaveClass(/is-on/);

    await page.locator(".dev-mesh-inspect-catalog-list button", { hasText: /^BodyPaint$/ }).first().click();
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.edit']")).toHaveText("Platzieren AN");
    await expect(page.locator("[data-dev-name='dev.mesh-inspect.selected']")).toContainText("BodyPaint");
    await page.screenshot({ path: "tmp/f6-mesh-inspect.png" });

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

    await page.keyboard.press("F6");
    await expect(page.locator("html")).not.toHaveClass(/dev-mesh-inspect-mode/);
    await expect(page.locator(".panel.garage")).toBeVisible();
  });
});
