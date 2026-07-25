import { APP_VERSION } from "./core/version";
import { GameApp } from "./ui/GameApp";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const uiRoot = document.querySelector<HTMLElement>("#ui-root");

if (!canvas || !uiRoot) {
  throw new Error("Canvas oder UI-Root fehlt.");
}

void APP_VERSION;
const app = new GameApp(canvas, uiRoot);

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  app.tick(now, dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
