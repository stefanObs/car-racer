import { preloadCarModels } from "./render/loadCarGltf";
import { preloadCarParts } from "./render/carParts";
import { preloadBuggyNoses } from "./render/buggyNose";
import { preloadBuggyNoseTextures } from "./render/buggyNoseTextures";
import { preloadFxModels } from "./render/loadFxGltf";
import { preloadGarageProps, preloadGarageShellMeshes } from "./render/loadGarageGltf";
import { preloadGarageShellTextures } from "./render/garageTextures";
import { preloadFlameSticker } from "./render/carStickers";
import { GameApp } from "./ui/GameApp";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const uiRoot = document.querySelector<HTMLElement>("#ui-root");

function showBootError(err: unknown): void {
  const root = uiRoot ?? document.body;
  const message = err instanceof Error ? err.message : String(err);
  root.innerHTML = `<div class="boot-error" role="alert"><strong>Crash Circuit konnte nicht starten</strong><pre>${message.replace(/</g, "&lt;")}</pre></div>`;
}

if (!canvas || !uiRoot) {
  throw new Error("Canvas oder UI-Root fehlt.");
}

const gameCanvas = canvas;
const gameUi = uiRoot;

async function boot(): Promise<void> {
  const touchCapable =
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches;
  if (touchCapable) document.documentElement.dataset.touch = "1";

  await preloadBuggyNoseTextures();
  await preloadFlameSticker();
  await Promise.all([
    preloadCarModels(),
    preloadBuggyNoses(),
    preloadGarageShellTextures().catch((err) => console.warn("[boot] garage shell textures skipped", err)),
    preloadGarageShellMeshes().catch((err) => console.warn("[boot] garage shell meshes skipped", err)),
    preloadGarageProps().catch((err) => console.warn("[boot] garage skipped", err)),
    preloadCarParts().catch((err) => console.warn("[boot] car parts skipped", err)),
    preloadFxModels(),
  ]);

  const app = new GameApp(gameCanvas, gameUi);
  let last = performance.now();

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    app.tick(now, dt);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error(err);
  showBootError(err);
});
