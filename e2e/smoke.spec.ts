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

    // Drag on canvas (behind UI) — yaw + pitch orbit
    const canvas = page.locator("#game-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const x = box!.x + box!.width * 0.72;
    const y = box!.y + box!.height * 0.55;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(canvas).toHaveClass(/is-orbiting/);
    await page.mouse.move(x + 120, y + 90);
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

  test("garage cosmetics: preview then buy paint and stickers", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 20000,
          ownedCars: ["blitz", "bison", "kaeferkraft", "donnerbuechse", "bunker"],
          activeCar: "blitz",
          kits: {
            blitz: {
              ownedParts: [],
              equippedParts: [],
              paint: "#e03131",
              sticker: "none",
              ownedPaints: ["#e03131"],
              ownedStickers: ["none"],
            },
            bison: {
              ownedParts: [],
              equippedParts: [],
              paint: "#2f9e44",
              sticker: "none",
              ownedPaints: ["#2f9e44"],
              ownedStickers: ["none"],
            },
            kaeferkraft: {
              ownedParts: [],
              equippedParts: [],
              paint: "#12b886",
              sticker: "none",
              ownedPaints: ["#12b886"],
              ownedStickers: ["none"],
            },
            donnerbuechse: {
              ownedParts: [],
              equippedParts: [],
              paint: "#f08c00",
              sticker: "none",
              ownedPaints: ["#f08c00"],
              ownedStickers: ["none"],
            },
            bunker: {
              ownedParts: [],
              equippedParts: [],
              paint: "#868e96",
              sticker: "none",
              ownedPaints: ["#868e96"],
              ownedStickers: ["none"],
            },
          },
          unlockedLevels: ["blitz_cup_01_hafenstart"],
          cupStars: {},
          cupIndexUnlocked: 1,
        }),
      );
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Aufkleber" })).toBeVisible();
    await page.getByRole("button", { name: /Flammen/ }).click();
    await expect(page.getByRole("button", { name: /Flammen/ })).toHaveClass(/is-preview/);
    await expect(page.getByRole("button", { name: /Kaufen/ }).first()).toBeVisible();
    await page.locator('[data-act="buy-sticker"]').click();
    await expect(page.getByRole("button", { name: /^Flammen$/ })).toHaveClass(/is-on/);

    await page.getByRole("button", { name: /Käferkraft/ }).click();
    await expect(page.getByRole("heading", { name: "Nase / Kopf" })).toBeVisible();
    await page.getByRole("button", { name: /Vogel/ }).click();
    await expect(page.getByRole("button", { name: /Vogel/ })).toHaveClass(/is-preview/);
    await page.locator('[data-act="buy-sticker"]').click();
    await expect(page.getByRole("button", { name: /^Vogel$/ })).toHaveClass(/is-on/);

    await page.getByRole("button", { name: /Bunker/ }).click();
    await expect(page.getByRole("heading", { name: "Aufkleber" })).toBeVisible();
    await expect(page.getByRole("button", { name: "IronClad" })).toHaveCount(0);
    await page.locator('[data-act="paint"][data-color="#e03131"]').click();
    await expect(page.locator('[data-act="paint"][data-color="#e03131"]')).toHaveClass(/is-preview/);
    await page.locator('[data-act="buy-paint"]').click();
    await expect(page.locator('[data-act="paint"][data-color="#e03131"]')).toHaveClass(/is-on/);
    await expect(page.locator("#game-canvas")).toBeVisible();
  });

  test("unowned car opens a marked preview then buy owns it", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 2000,
          ownedCars: ["blitz"],
          activeCar: "blitz",
          kits: { blitz: { ownedParts: [], equippedParts: [], paint: "#e03131", sticker: "none" } },
          unlockedLevels: ["blitz_cup_01_hafenstart"],
          cupStars: {},
          cupIndexUnlocked: 1,
        }),
      );
    });
    await page.goto("/");
    await page.getByRole("button", { name: /Bison/ }).click();
    await expect(page.locator("[data-dev-name='garage.preview']")).toBeVisible();
    await expect(page.getByRole("button", { name: /Kaufen/ }).first()).toBeEnabled();
    await page.locator("[data-act='buy-car']").click();
    await expect(page.locator("[data-dev-name='garage.preview']")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Bison/ })).toContainText("Aktiv");
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
