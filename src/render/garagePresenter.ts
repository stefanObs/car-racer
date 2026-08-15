import {
  Color,
  Group,
  type AmbientLight,
  type DirectionalLight,
  type Fog,
  type HemisphereLight,
  type Mesh,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { CARS } from "../data/cars";
import { createCarState } from "../sim/vehicle";
import { upgradeCarFx } from "./attachCarFx";
import { buildComicCar } from "./comicCarMesh";
import { disposeObject } from "./comicMaterials";
import { carPartTemplatesReady, ensureCarPartTemplates, garageLookCacheKey } from "./carParts";
import type { GarageLook } from "./garageLook";
import { buildGarageBay, GARAGE_PAD_CENTER, GARAGE_PAD_DECK_FALLBACK_Y, garagePadDeckY } from "./garageBay";
import {
  applyGarageDragOrbit,
  garageDisplayYaw,
  garageInspectLiftAmount,
  garageOrbitPivotY,
  garagePitchAfterInspectChange,
  GARAGE_PITCH_DEFAULT,
  GARAGE_YAW_DEFAULT,
} from "./garageOrbit";
import { mountGarageOrbitPivot } from "./garageOrbitPivot";
import { carBodyWorldCenter, garagePadContactSnapDelta, seatGarageGroundBlob } from "./garageSit";

export type { GarageLook } from "./garageLook";

export type GaragePresenterHost = {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  hemi: HemisphereLight;
  ambient: AmbientLight;
  sun: DirectionalLight;
  fog: Fog;
  groundMesh: Mesh;
  getSkyMesh: () => Mesh;
  getPanoramaGroup: () => Group;
};

/** Idle garage bay: sit-on-pad showcase + orbit. Race field stays on RaceRenderer. */
export class GaragePresenter {
  group = new Group();
  private idleCar: Group | null = null;
  private idleOrbit: Group | null = null;
  private idleLookKey = "";
  private pendingGarageLookKey: string | null = null;
  private garageYaw = GARAGE_YAW_DEFAULT;
  private garagePitch = GARAGE_PITCH_DEFAULT;
  private garageDragging = false;
  private garagePitchInspect = false;
  private garageSitY = 0;
  private garageSitCenterY = 0;
  private garageOrbitX = GARAGE_PAD_CENTER.x as number;
  private garageOrbitZ = GARAGE_PAD_CENTER.z as number;
  private garageInspectLift = 1.2;
  private fxTime = 0;
  private readonly host: GaragePresenterHost;

  constructor(host: GaragePresenterHost) {
    this.host = host;
  }

  buildIdleShowcase(look?: GarageLook): void {
    const { scene } = this.host;
    if (this.group.parent) scene.remove(this.group);
    disposeObject(this.group);
    this.group = buildGarageBay();
    this.idleCar = null;
    this.idleOrbit = null;

    const paint = look?.paint ?? "#E03131";
    const sticker = look?.sticker ?? "none";
    const modelId = look?.modelId ?? "blitz";
    const equippedParts = look?.equippedParts ?? [];
    this.idleLookKey = garageLookCacheKey({ modelId, paint, sticker, equippedParts });

    const visual = buildComicCar(
      createCarState({
        id: "idle",
        x: 0,
        z: 0,
        heading: 0,
        isPlayer: true,
        paint,
        sticker,
        modelId,
        equippedParts: [...equippedParts],
        stats: {
          ...CARS[modelId].stats,
          nitroBonus: 0,
          ramBonus: 0,
          grassMitigation: 0,
          brakeBonus: 0,
        },
      }),
    );
    upgradeCarFx(visual);
    const pad = this.group.getObjectByName("garagePad");
    const deckY = pad ? garagePadDeckY(pad) : GARAGE_PAD_DECK_FALLBACK_Y;
    visual.root.position.set(GARAGE_PAD_CENTER.x, deckY, GARAGE_PAD_CENTER.z);
    visual.root.rotation.set(0, 0, 0);
    visual.root.scale.setScalar(1.35);
    this.group.add(visual.root);
    visual.root.updateMatrixWorld(true);
    visual.root.position.y += garagePadContactSnapDelta(visual.root, deckY);
    this.garageSitY = visual.root.position.y;
    visual.root.updateMatrixWorld(true);
    const center = carBodyWorldCenter(visual.root);
    this.garageInspectLift = garageInspectLiftAmount(center.y);
    this.garageSitCenterY = center.y;
    this.garageOrbitX = center.x;
    this.garageOrbitZ = center.z;

    const pivot = mountGarageOrbitPivot(this.group, visual.root, center);
    this.idleOrbit = pivot;
    this.idleCar = visual.root;
    this.applyOrbitPose();
    pivot.position.y += garagePadContactSnapDelta(visual.root, deckY);
    this.garageSitCenterY = pivot.position.y;
    this.garageInspectLift = garageInspectLiftAmount(this.garageSitCenterY);
    seatGarageGroundBlob(visual.root, deckY);
    visual.root.userData.carPartsSitY = this.garageSitY;
    visual.root.userData.blitzSitY = this.garageSitY;
    scene.add(this.group);
    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __idleCar?: Group;
        __garageBay?: Group;
        __garageOrbit?: Group;
      };
      w.__idleCar = visual.root;
      w.__garageBay = this.group;
      w.__garageOrbit = pivot;
    }

    this.applyEnvironment();
  }

  applyEnvironment(): void {
    const { groundMesh, scene, fog, renderer, hemi, ambient, sun } = this.host;
    groundMesh.visible = false;
    this.host.getSkyMesh().visible = false;
    this.host.getPanoramaGroup().visible = false;
    scene.background = new Color(0x5ba3d9);
    fog.color.setHex(0x8ec4e8);
    fog.near = 40;
    fog.far = 90;
    renderer.setClearColor(0x5ba3d9, 1);
    hemi.color.setHex(0xfff4e0);
    hemi.groundColor.setHex(0xd0d6dc);
    hemi.intensity = 1.25;
    ambient.intensity = 0.95;
    sun.color.setHex(0xfff8ee);
    sun.intensity = 2.15;
    sun.position.set(8, 22, 14);
  }

  setLook(look: GarageLook): void {
    const key = garageLookCacheKey(look);
    if (key === this.idleLookKey && this.idleCar && this.pendingGarageLookKey == null) return;

    const kitsReady = carPartTemplatesReady(look.modelId);
    this.buildIdleShowcase(look);

    if (kitsReady) {
      this.pendingGarageLookKey = null;
      return;
    }

    this.pendingGarageLookKey = key;
    void ensureCarPartTemplates(look.modelId).then(() => {
      if (this.pendingGarageLookKey !== key) return;
      this.pendingGarageLookKey = null;
      this.idleLookKey = "";
      this.buildIdleShowcase(look);
    });
  }

  setDragging(dragging: boolean): void {
    this.garageDragging = dragging;
  }

  setPitchInspect(active: boolean): void {
    this.garagePitch = garagePitchAfterInspectChange(
      this.garagePitchInspect,
      active,
      this.garagePitch,
    );
    this.garagePitchInspect = active;
    this.applyOrbitPose();
  }

  addOrbitFromDrag(deltaXPx: number, deltaYPx: number, axes?: { yaw: boolean; pitch: boolean }): void {
    const next = applyGarageDragOrbit(this.garageYaw, this.garagePitch, deltaXPx, deltaYPx, axes);
    this.garageYaw = next.yaw;
    this.garagePitch = next.pitch;
  }

  applyOrbitPose(): void {
    const pivot = this.idleOrbit;
    if (!pivot) return;
    pivot.position.set(
      this.garageOrbitX,
      garageOrbitPivotY(this.garageSitCenterY, this.garagePitchInspect, this.garageInspectLift),
      this.garageOrbitZ,
    );
    pivot.rotation.order = "YXZ";
    pivot.rotation.y = garageDisplayYaw(this.garageYaw, this.fxTime, this.garageDragging);
    pivot.rotation.x = this.garagePitchInspect ? this.garagePitch : GARAGE_PITCH_DEFAULT;
    pivot.rotation.z = 0;
  }

  tickIdle(fxTime: number): void {
    this.fxTime = fxTime;
    this.group.visible = true;
    this.applyOrbitPose();
    const { camera } = this.host;
    camera.position.set(3.4, 2.7, 9.2);
    const lookY = this.garagePitchInspect
      ? garageOrbitPivotY(this.garageSitCenterY, true, this.garageInspectLift)
      : 0.95;
    camera.lookAt(1.5, lookY, 0.2);
  }

  hide(): void {
    this.group.visible = false;
  }
}
