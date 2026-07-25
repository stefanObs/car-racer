import { APP_VERSION } from "./core/version";
import { GameApp } from "./ui/GameApp";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const uiRoot = document.querySelector<HTMLElement>("#ui-root");

function showBootError(err: unknown): void {
  const root = uiRoot ?? document.body;
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  root.innerHTML = `<div class="boot-error"><strong>Crash Circuit konnte nicht starten</strong>\n\n${message}</div>`;
}

if (!canvas || !uiRoot) {
  throw new Error("Canvas oder UI-Root fehlt.");
}

try {
  void APP_VERSION;
  const touchCapable =
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches;
  if (touchCapable) document.documentElement.dataset.touch = "1";

  const app = new GameApp(canvas, uiRoot);

  let last = performance.now();

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    app.tick(now, dt);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  showBootError(err);
}
