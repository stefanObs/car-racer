import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { CAR_IDS } from "../src/data/cars";
import { CAR_WHEEL_FIT } from "../src/render/carWheels";
import { shouldApplyGaragePaint } from "../src/render/loadCarGltf";
import {
  collectSpinMounts,
  makeProceduralComicWheel,
  mountCarWheels,
  spinCarWheels,
  steerFromHeadingDelta,
} from "../src/render/carWheels";

function boxCar(): Group {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(1.6, 0.8, 3.4), new MeshBasicMaterial({ name: "BodyPaint" }));
  body.name = "BodyPaint";
  body.position.y = 0.4;
  root.add(body);
  return root;
}

function nativeTireCar(): Group {
  const root = new Group();
  const body = new Mesh(new BoxGeometry(1.4, 0.7, 3.2), new MeshBasicMaterial({ name: "BodyPaint" }));
  body.name = "Body";
  body.position.y = 0.4;
  root.add(body);
  const spots = [
    [-0.65, 0.28, 1.1],
    [0.65, 0.28, 1.1],
    [-0.65, 0.28, -1.1],
    [0.65, 0.28, -1.1],
  ] as const;
  for (const [x, y, z] of spots) {
    const tire = new Mesh(new BoxGeometry(0.22, 0.55, 0.55), new MeshBasicMaterial({ name: "Tire" }));
    tire.name = "Tire";
    tire.position.set(x, y, z);
    root.add(tire);
  }
  return root;
}

describe("spinning comic wheels", () => {
  it("skips garage paint on Tire and Wheel names", () => {
    expect(shouldApplyGaragePaint("Tire")).toBe(false);
    expect(shouldApplyGaragePaint("Wheel")).toBe(false);
    expect(shouldApplyGaragePaint("WheelSpin_FL")).toBe(false);
    expect(shouldApplyGaragePaint("BodyPaint")).toBe(true);
  });

  it("defines a wheel fit for every car (hot rod has fatter rears)", () => {
    for (const id of CAR_IDS) {
      expect(CAR_WHEEL_FIT[id].radius).toBeGreaterThan(0.2);
      expect(CAR_WHEEL_FIT[id].radius).toBeLessThan(0.55);
    }
    expect(CAR_WHEEL_FIT.donnerbuechse.rearRadius).toBeGreaterThan(CAR_WHEEL_FIT.donnerbuechse.radius);
  });

  it("mounts four spin hubs on a body-only car", () => {
    const root = boxCar();
    const wheels = mountCarWheels(root, "blitz");
    expect(wheels).toHaveLength(4);
    expect(wheels.filter((w) => w.isFront)).toHaveLength(2);
    expect(collectSpinMounts(root)).toHaveLength(4);
    expect(wheels.every((w) => w.spinner.name.startsWith("WheelSpin_"))).toBe(true);
  });

  it("reparents native Tire meshes instead of doubling them", () => {
    const root = nativeTireCar();
    let tireCount = 0;
    root.traverse((o) => {
      if ((o as Mesh).isMesh && o.name === "Tire") tireCount++;
    });
    expect(tireCount).toBe(4);
    const wheels = mountCarWheels(root, "bison");
    expect(wheels).toHaveLength(4);
    let underSpin = 0;
    for (const w of wheels) {
      w.spinner.traverse((o) => {
        if ((o as Mesh).isMesh && /tire|wheel/i.test(o.name)) underSpin++;
      });
    }
    expect(underSpin).toBeGreaterThanOrEqual(4);
  });

  it("hooks one mesh onBeforeRender for world-travel roll", () => {
    const root = boxCar();
    const wheels = mountCarWheels(root, "blitz");
    let hooks = 0;
    wheels[0]!.spinner.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh && mesh.userData.wheelRollHook) hooks++;
    });
    expect(hooks).toBeGreaterThan(0);
  });

  it("increases roll angle with speed and faster when speed is higher", () => {
    const root = boxCar();
    const wheels = mountCarWheels(root, "blitz");
    const a0 = wheels[0]!.spinner.rotation.x;
    spinCarWheels(wheels, 10, 1 / 60);
    const a1 = wheels[0]!.spinner.rotation.x;
    expect(a1).toBeGreaterThan(a0);
    spinCarWheels(wheels, 20, 1 / 60);
    const a2 = wheels[0]!.spinner.rotation.x;
    expect(a2 - a1).toBeGreaterThan(a1 - a0);
  });

  it("yaws only the front pair from steer input", () => {
    const root = boxCar();
    const wheels = mountCarWheels(root, "blitz");
    spinCarWheels(wheels, 8, 1 / 60, 1);
    for (const w of wheels) {
      if (w.isFront) expect(Math.abs(w.steer.rotation.y)).toBeGreaterThan(0.2);
      else expect(w.steer.rotation.y).toBe(0);
    }
  });

  it("maps heading delta to a clamped steer", () => {
    expect(steerFromHeadingDelta(0, 0.1)).toBeGreaterThan(0);
    expect(steerFromHeadingDelta(0, -0.1)).toBeLessThan(0);
    expect(steerFromHeadingDelta(0, 2)).toBe(1);
  });

  it("procedural wheel uses Tire material names (not BodyPaint)", () => {
    const w = makeProceduralComicWheel();
    const names: string[] = [];
    w.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) names.push(m?.name ?? "");
    });
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n === "Tire")).toBe(true);
    expect(names.some((n) => /body|paint/i.test(n))).toBe(false);
  });

  it("ships the baked comic-wheel GLB with a Tire material", () => {
    const path = resolve("public/models/props/comic-wheel.glb");
    expect(existsSync(path), path).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(8_000);
    const text = readFileSync(path).toString("latin1");
    expect(text).toContain("Tire");
    expect(text).toMatch(/Wheel|Tire/);
  });
});
