import { createRaceScene } from "./render/raceScene";
import { APP_VERSION } from "./core/version";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const versionEl = document.querySelector<HTMLElement>("#app-version");

if (!canvas) {
  throw new Error("Canvas #game-canvas fehlt.");
}

if (versionEl) {
  versionEl.textContent = `v${APP_VERSION}`;
}

const race = createRaceScene(canvas);

function frame(now: number): void {
  race.tick(now);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
