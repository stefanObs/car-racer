import { expect, test } from "@playwright/test";

const XL_CUP_TRACKS = [
  { label: /1\.\s*Hafenstart/, id: "blitz_cup_01_hafenstart" },
  { label: /2\.\s*Parabolbogen/, id: "blitz_cup_02_kuestenline" },
  { label: /3\.\s*Schikanenring/, id: "blitz_cup_03_stadtring" },
  { label: /4\.\s*Omegatal/, id: "blitz_cup_04_buckelpiste" },
  { label: /5\.\s*Kuppenfinale/, id: "blitz_cup_05_cupfinale" },
] as const;

async function hpPercent(page: import("@playwright/test").Page): Promise<number> {
  const width = await page.locator("[data-dev-name='hud.hp'] i.hp").evaluate((el) => el.style.width);
  return Number.parseInt(width.replace("%", ""), 10);
}

test.describe("XL cup tracks (browser)", () => {
  for (const track of XL_CUP_TRACKS) {
    test(`training race HUD + input: ${track.id}`, async ({ page }) => {
      test.setTimeout(180_000);

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(String(err)));

      await page.goto("/");
      await page.getByRole("button", { name: "Training" }).click();
      await expect(page.getByRole("heading", { name: "Training" })).toBeVisible();
      await expect(page.getByRole("button", { name: track.label })).toBeVisible();
      await page.getByRole("button", { name: track.label }).click();

      await expect(page.locator("html")).toHaveAttribute("data-screen", "race", { timeout: 90_000 });
      await expect(page.locator("#race-hud")).toBeVisible({ timeout: 90_000 });
      await expect(page.locator("#game-canvas")).toBeVisible();
      await expect(page.locator("[data-dev-name='hud.training']")).toHaveText("Training");
      await expect(page.locator("[data-dev-name='hud.minimap-wrap']")).toBeVisible();
      await expect(page.locator("[data-dev-name='hud.lap.current']")).toHaveText("1");

      const hpStart = await hpPercent(page);
      expect(hpStart).toBeGreaterThanOrEqual(95);

      // Bash toward the wall — must stay in race (walls clamp; no world escape / instant KO).
      await page.keyboard.down("ArrowUp");
      await page.keyboard.down("ArrowLeft");
      await page.keyboard.down("Shift");
      await page.waitForTimeout(2000);
      await page.keyboard.up("Shift");
      await page.keyboard.up("ArrowLeft");
      await page.keyboard.up("ArrowUp");

      const hpAfter = await hpPercent(page);
      expect(hpAfter, `${track.id} KO while still on race`).toBeGreaterThan(0);
      await expect(page.locator("html")).toHaveAttribute("data-screen", "race");

      const blocking = consoleErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
      expect(blocking, `console errors on ${track.id}`).toEqual([]);
    });
  }
});
