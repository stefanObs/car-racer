export interface Actions {
  throttle: number;
  brake: number;
  steer: number;
  nitro: boolean;
  uiConfirm: boolean;
  uiBack: boolean;
  uiUp: boolean;
  uiDown: boolean;
  uiLeft: boolean;
  uiRight: boolean;
}

const keys = new Set<string>();

export function bindKeyboard(): void {
  window.addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
}

export interface TouchState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  nitro: boolean;
}

export const touchState: TouchState = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  nitro: false,
};

function readGamepad(): Partial<Actions> {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = pads.find(Boolean);
  if (!pad) return {};
  const steerAxis = pad.axes[0] ?? 0;
  const throttle = Math.max(0, pad.buttons[7]?.value ?? 0);
  const brake = Math.max(0, pad.buttons[6]?.value ?? 0);
  const nitro = pad.buttons[0]?.pressed || pad.buttons[5]?.pressed;
  return {
    steer: Math.abs(steerAxis) > 0.12 ? steerAxis : 0,
    throttle,
    brake,
    nitro: Boolean(nitro),
    uiConfirm: Boolean(pad.buttons[0]?.pressed),
    uiBack: Boolean(pad.buttons[1]?.pressed),
    uiUp: Boolean(pad.buttons[12]?.pressed),
    uiDown: Boolean(pad.buttons[13]?.pressed),
    uiLeft: Boolean(pad.buttons[14]?.pressed),
    uiRight: Boolean(pad.buttons[15]?.pressed),
  };
}

export function sampleActions(): Actions {
  const gp = readGamepad();
  let throttle = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
  let brake = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
  let steer = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) steer -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) steer += 1;
  let nitro = keys.has("Space") || keys.has("ShiftLeft") || keys.has("ShiftRight");

  if (touchState.throttle) throttle = 1;
  if (touchState.brake) brake = 1;
  if (touchState.left) steer -= 1;
  if (touchState.right) steer += 1;
  if (touchState.nitro) nitro = true;

  throttle = Math.max(throttle, gp.throttle ?? 0);
  brake = Math.max(brake, gp.brake ?? 0);
  if (gp.steer !== undefined && gp.steer !== 0) steer = gp.steer;
  nitro = nitro || Boolean(gp.nitro);

  return {
    throttle,
    brake,
    steer: Math.max(-1, Math.min(1, steer)),
    nitro,
    uiConfirm: keys.has("Enter") || Boolean(gp.uiConfirm),
    uiBack: keys.has("Escape") || Boolean(gp.uiBack),
    uiUp: keys.has("ArrowUp") || Boolean(gp.uiUp),
    uiDown: keys.has("ArrowDown") || Boolean(gp.uiDown),
    uiLeft: keys.has("ArrowLeft") || Boolean(gp.uiLeft),
    uiRight: keys.has("ArrowRight") || Boolean(gp.uiRight),
  };
}
