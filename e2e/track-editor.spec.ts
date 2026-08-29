import { expect, test } from "@playwright/test";

test.describe("F8 Strecken-Editor", () => {
  test("opens overlay, copies a patch, and Esc returns to the garage", async ({ page, context }) => {
    test.setTimeout(90_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F8 Editor");

    await page.keyboard.press("F8");

    await expect(page.locator("html")).toHaveAttribute("data-screen", "trackEditor", { timeout: 20_000 });
    await expect(page.locator("[data-dev-name='editor.title']")).toHaveText("Strecken-Editor");
    await expect(page.locator("[data-dev-name='editor.palette.gauge']")).toBeVisible();
    await expect(page.locator("[data-dev-name='editor.copy']")).toContainText("Kopieren");
    await expect(page.locator("[data-dev-name='editor.reset']")).toBeVisible();
    await expect(page.locator("[data-dev-name='editor.pano-y']")).toBeVisible();
    await expect(page.locator("[data-dev-name='dev.badge']")).toContainText("F8 Editor AN");

    await page.locator("[data-dev-name='editor.palette.crane']").click();
    const canvas = page.locator("#game-canvas");
    await canvas.click({ position: { x: 420, y: 280 } });
    await page.locator("[data-dev-name='editor.copy']").click();
    await expect(page.locator("[data-dev-name='editor.copy']")).toContainText("kopiert", { timeout: 8_000 });
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("CRASH CIRCUIT F8 TRACK PATCH v1");
    expect(clip).toContain("level: blitz_cup_01_hafenstart");

    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-screen", "garage");
    await expect(page.getByRole("button", { name: "Cup" })).toBeVisible();
  });
});
