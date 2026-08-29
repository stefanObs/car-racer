import { expect, test } from "@playwright/test";

/** CONCEPT §5 — garage shows distinct one-liners and Eigenschaften bars per class. */
test.describe("distinct car class garage copy", () => {
  test("cycles owned cars and shows class fantasy blurbs + stat popup", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "crash-circuit-save-v1",
        JSON.stringify({
          version: 2,
          chf: 99999,
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
              paint: "#339af0",
              sticker: "none",
              ownedPaints: ["#339af0"],
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
        }),
      );
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();

    const blurbs = [
      { name: "Blitz", text: /Remplern|Buckeln/ },
      { name: "Bison", text: /schiebt/ },
      { name: "Käferkraft", text: /Gras|Sprünge/ },
      { name: "Donnerbüchse", text: /Nitro/ },
      { name: "Bunker", text: /Schanzen|Gras/ },
    ];

    for (const { name, text } of blurbs) {
      await page.locator(".garage-car").filter({ hasText: name }).click();
      await expect(page.locator(".panel.garage .dim").filter({ hasText: text })).toBeVisible();
    }

    await expect(page.locator(".car-stats-popup")).toBeVisible();
    await expect(page.locator(".car-stats-popup .stat-bar")).toHaveCount(8);
    await page.screenshot({ path: "tmp/class-identities-garage.png", fullPage: true });
  });
});
