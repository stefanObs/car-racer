import {
  AmbientLight,
  BackSide,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { stageFromHp } from "../sim/damage";
import type { RaceSession } from "../sim/race";
import { createCarState } from "../sim/vehicle";
import { surfaceAt } from "../sim/zones";
import { sampleCenterline } from "../track/buildTrack";
import { CARS, type CarId } from "../data/cars";
import type { FinishCelebrate } from "../ui/finishCelebrate";
import { finishCelebrateProgress, isPodiumPlace } from "../ui/finishCelebrate";
import { buildComicCar, type ComicCarParts } from "./comicCarMesh";
import { comicToon, disposeObject } from "./comicMaterials";
import { buildGarageBay } from "./garageBay";
import { buildLevelObstacles } from "./levelObstacles";
import { themeLook, type ThemeLook } from "./themeLook";
import { buildThemeScenery } from "./themeScenery";
import { buildSmoothTrack } from "./trackMesh";
import {
  applyGarageDragYaw,
  garageDisplayYaw,
  GARAGE_YAW_DEFAULT,
} from "../ui/garageOrbit";

function hexCss(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function makeSkyTexture(look: ThemeLook): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, hexCss(look.hemiSky));
  g.addColorStop(0.45, hexCss(look.sky));
  g.addColorStop(1, hexCss(look.skyLow));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  ctx.fillStyle = "#f4f7fa";
  ctx.fillRect(0, 18, 8, 3);
  ctx.fillRect(0, 28, 8, 2);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export class RaceRenderer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(46, 1, 0.1, 600);
  readonly renderer: WebGLRenderer;
  private readonly carVisuals = new Map<string, ComicCarParts>();
  private readonly lastNitro = new Map<string, number>();
  private trackGroup = new Group();
  private sceneryGroup = new Group();
  private obstacleGroup = new Group();
  private celebrateGroup = new Group();
  private celebrateSeed = -1;
  private idleGroup = new Group();
  private idleCar: Group | null = null;
  private idleLookKey = "";
  private garageYaw = GARAGE_YAW_DEFAULT;
  private garageDragging = false;
  private fxTime = 0;
  private readonly hemi: HemisphereLight;
  private readonly ambient: AmbientLight;
  private readonly sun: DirectionalLight;
  private readonly groundMesh: Mesh;
  private readonly skyMesh: Mesh;
  private readonly fog: Fog;

  constructor(canvas: HTMLCanvasElement) {
    const look = themeLook("harbor");
    this.scene.background = new Color(look.sky);
    this.fog = new Fog(look.skyLow, look.fogNear, look.fogFar);
    this.scene.fog = this.fog;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(look.sky, 1);
    this.renderer.outputColorSpace = SRGBColorSpace;
    canvas.style.imageRendering = "auto";

    this.hemi = new HemisphereLight(look.hemiSky, look.hemiGround, 0.65);
    this.scene.add(this.hemi);
    this.ambient = new AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambient);
    this.sun = new DirectionalLight(0xfff1d6, 1.25);
    this.sun.position.set(18, 28, 12);
    this.scene.add(this.sun);

    this.groundMesh = new Mesh(new PlaneGeometry(480, 480), comicToon(look.ground));
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.08;
    this.scene.add(this.groundMesh);

    this.skyMesh = new Mesh(
      new SphereGeometry(280, 24, 16),
      new MeshBasicMaterial({ map: makeSkyTexture(look), side: BackSide }),
    );
    this.skyMesh.scale.y = 0.72;
    this.scene.add(this.skyMesh);

    // Soft cloud cards
    for (const [x, y, z, sx] of [
      [-50, 34, -70, 18],
      [40, 38, -90, 22],
      [-30, 32, 80, 14],
      [60, 36, 50, 16],
    ] as const) {
      const cloud = new Mesh(
        new SphereGeometry(1, 8, 8),
        comicToon(0xf8f9fa),
      );
      cloud.scale.set(sx, sx * 0.38, sx * 0.55);
      cloud.position.set(x, y, z);
      this.scene.add(cloud);
    }

    this.buildIdleShowcase();

    window.addEventListener("resize", () => this.resize(canvas));
    this.resize(canvas);
    this.renderIdle();
  }

  private buildIdleShowcase(look?: { paint: string; sticker: string; modelId: CarId }): void {
    if (this.idleGroup.parent) this.scene.remove(this.idleGroup);
    disposeObject(this.idleGroup);
    this.idleGroup = buildGarageBay();
    this.idleCar = null;

    const paint = look?.paint ?? "#E03131";
    const sticker = look?.sticker ?? "flames";
    const modelId = look?.modelId ?? "blitz";
    this.idleLookKey = `${modelId}|${paint}|${sticker}`;

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
        stats: { ...CARS[modelId].stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0 },
      }),
    );
    visual.root.position.set(1.5, 0.12, 0);
    visual.root.rotation.y = this.garageYaw;
    visual.root.scale.setScalar(1.35);
    this.idleCar = visual.root;
    this.idleGroup.add(visual.root);
    this.scene.add(this.idleGroup);

    this.groundMesh.visible = false;
    this.skyMesh.visible = false;
    // Sunny open-bay look (Asphalt-Comic daylight — not a cave)
    this.scene.background = new Color(0x5ba3d9);
    this.fog.color.setHex(0x8ec4e8);
    this.fog.near = 40;
    this.fog.far = 90;
    this.renderer.setClearColor(0x5ba3d9, 1);
    this.hemi.color.setHex(0xfff4e0);
    this.hemi.groundColor.setHex(0xd0d6dc);
    this.hemi.intensity = 1.25;
    this.ambient.intensity = 0.95;
    this.sun.color.setHex(0xfff8ee);
    this.sun.intensity = 2.15;
    this.sun.position.set(8, 22, 14);
  }

  setGarageLook(look: { paint: string; sticker: string; modelId: CarId }): void {
    const key = `${look.modelId}|${look.paint}|${look.sticker}`;
    if (key === this.idleLookKey && this.idleCar) return;
    this.buildIdleShowcase(look);
  }

  setGarageDragging(dragging: boolean): void {
    this.garageDragging = dragging;
  }

  /** Horizontal pointer drag in CSS pixels — left mouse / touch. */
  addGarageYawFromDrag(deltaXPx: number): void {
    this.garageYaw = applyGarageDragYaw(this.garageYaw, deltaXPx);
  }

  renderIdle(): void {
    this.fxTime += 1 / 60;
    this.idleGroup.visible = true;
    if (this.idleCar) {
      this.idleCar.rotation.y = garageDisplayYaw(this.garageYaw, this.fxTime, this.garageDragging);
    }
    // Front-biased camera — nose toward viewer
    this.camera.position.set(3.2, 2.35, 7.6);
    this.camera.lookAt(1.5, 0.85, 0.2);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private applyTheme(theme: string): void {
    const look = themeLook(theme);
    this.scene.background = new Color(look.sky);
    this.fog.color.setHex(look.skyLow);
    this.fog.near = look.fogNear;
    this.fog.far = look.fogFar;
    this.renderer.setClearColor(look.sky, 1);
    this.hemi.color.setHex(look.hemiSky);
    this.hemi.groundColor.setHex(look.hemiGround);
    this.hemi.intensity = 0.65;
    this.ambient.intensity = 0.4;
    this.sun.color.setHex(0xfff1d6);
    this.sun.intensity = 1.25;
    this.sun.position.set(18, 28, 12);
    (this.groundMesh.material as MeshToonMaterial).color.setHex(look.ground);
    const skyMat = this.skyMesh.material as MeshBasicMaterial;
    skyMat.map?.dispose();
    skyMat.map = makeSkyTexture(look);
    skyMat.needsUpdate = true;
  }

  buildTrack(session: RaceSession): void {
    this.idleGroup.visible = false;
    this.groundMesh.visible = true;
    this.skyMesh.visible = true;
    this.applyTheme(session.level.theme);
    this.scene.remove(this.trackGroup);
    this.scene.remove(this.sceneryGroup);
    this.scene.remove(this.obstacleGroup);
    disposeObject(this.trackGroup);
    disposeObject(this.sceneryGroup);
    disposeObject(this.obstacleGroup);
    this.trackGroup = buildSmoothTrack(session.track);
    this.sceneryGroup = buildThemeScenery(session.track, session.level.theme);
    this.obstacleGroup = buildLevelObstacles(session.level);
    this.clearCelebrate();
    this.scene.add(this.trackGroup, this.sceneryGroup, this.obstacleGroup);
    this.clearCars();
    this.lastNitro.clear();
    for (const car of session.cars) {
      const visual = buildComicCar(car);
      this.carVisuals.set(car.id, visual);
      this.scene.add(visual.root);
    }
  }

  private clearCelebrate(): void {
    this.scene.remove(this.celebrateGroup);
    disposeObject(this.celebrateGroup);
    this.celebrateGroup = new Group();
    this.celebrateSeed = -1;
  }

  private ensureCelebrateBurst(session: RaceSession, fx: FinishCelebrate): void {
    if (this.celebrateSeed === fx.place) return;
    this.clearCelebrate();
    this.celebrateSeed = fx.place;
    const podium = isPodiumPlace(fx.place);
    const player = session.player();
    const count = podium ? 36 : 14;
    const colors = podium
      ? [0xffe066, 0xe03131, 0xf8f9fa, 0x339af0, 0xf08c00]
      : [0xadb5bd, 0x868e96, 0xf8f9fa];
    for (let i = 0; i < count; i++) {
      const m = new Mesh(
        new SphereGeometry(0.18 + (i % 3) * 0.06, 6, 6),
        comicToon(colors[i % colors.length]!),
      );
      m.userData = {
        ang: (i / count) * Math.PI * 2,
        speed: 1.2 + (i % 5) * 0.25,
        rise: podium ? 4.5 + (i % 4) * 0.4 : 2.2 + (i % 3) * 0.3,
        spin: 2 + (i % 4),
      };
      m.position.set(player.x, 0.5, player.z);
      this.celebrateGroup.add(m);
    }
    this.scene.add(this.celebrateGroup);
  }

  sync(session: RaceSession, celebrate?: FinishCelebrate | null): void {
    this.fxTime += 1 / 60;
    this.idleGroup.visible = false;

    for (const car of session.cars) {
      let visual = this.carVisuals.get(car.id);
      if (!visual) {
        visual = buildComicCar(car);
        this.carVisuals.set(car.id, visual);
        this.scene.add(visual.root);
      }
      const { root, smoke, sparks, nitro } = visual;
      const stage = stageFromHp(car.hp);
      root.visible = !(car.koTimer > 0 && car.hp <= 0 && Math.sin(car.koTimer * 20) <= 0);

      const bump = surfaceAt(session.track, car.x, car.z, car.stats.grassMitigation, car.stats.suspension).bump;
      const hop =
        bump * 0.25 * Math.sin(this.fxTime * 22 + car.progress * 3) +
        (stage >= 2 ? Math.sin(this.fxTime * 18 + car.progress) * 0.05 : 0);
      const lean = (stage >= 2 ? 0.1 : 0) + bump * 0.14;
      root.position.set(car.x, (car.healFx > 0.2 ? 0.05 : 0) + hop, car.z);
      root.rotation.y = Math.PI / 2 - car.heading;
      root.rotation.z = lean * Math.sin(this.fxTime * 10);

      const showSmoke = stage >= 1 && stage < 4;
      smoke.children.forEach((child, i) => {
        const m = child as Mesh;
        m.visible = showSmoke && i < (stage === 1 ? 2 : stage === 2 ? 4 : 6);
        if (!m.visible) return;
        const t = this.fxTime * (1.5 + i * 0.2) + i;
        m.position.set(Math.sin(t) * 0.25, 1.05 + (t % 1.2) * 0.85, -1.15 - i * 0.12);
        m.scale.setScalar(0.7 + (t % 1));
      });

      const healing = car.healFx > 0.25;
      sparks.children.forEach((child, i) => {
        const m = child as Mesh;
        m.visible = healing;
        if (!m.visible) return;
        const t = this.fxTime * 8 + i;
        m.position.set(Math.cos(t + i) * 0.85, 0.5 + Math.abs(Math.sin(t)) * 0.7, Math.sin(t * 1.3) * 0.9);
      });

      const prevNitro = this.lastNitro.get(car.id) ?? car.nitro;
      const boosting = car.nitro < prevNitro - 0.001;
      this.lastNitro.set(car.id, car.nitro);
      nitro.children.forEach((child, i) => {
        const m = child as Mesh;
        m.visible = boosting;
        if (m.visible) m.scale.z = 1 + (i % 3) * 0.15 + Math.sin(this.fxTime * 20 + i) * 0.1;
      });
    }

    const player = session.player();
    if (celebrate) {
      this.ensureCelebrateBurst(session, celebrate);
      const p = finishCelebrateProgress(celebrate);
      const podium = isPodiumPlace(celebrate.place);
      const finish = sampleCenterline(session.track, 0);
      const fx = Math.atan2(finish.tangent.z, finish.tangent.x);
      this.celebrateGroup.children.forEach((child) => {
        const m = child as Mesh;
        const u = m.userData as { ang: number; speed: number; rise: number; spin: number };
        const rad = (podium ? 3.2 : 1.8) * Math.min(1, p * 1.4);
        const y = 0.4 + u.rise * Math.sin(Math.min(1, p * 1.1) * Math.PI);
        const cx = finish.position.x;
        const cz = finish.position.z;
        m.position.set(
          cx + Math.cos(u.ang + celebrate.t * u.speed) * rad,
          y,
          cz + Math.sin(u.ang + celebrate.t * u.speed) * rad,
        );
        m.rotation.y = celebrate.t * u.spin;
        m.visible = p < 0.95;
      });

      // Frame the ZIEL banner head-on during the celebrate beat
      const back = podium ? 16 - p * 2 : 14;
      const height = podium ? 5.2 + p * 0.8 : 4.6;
      const orbit = podium ? celebrate.t * 0.25 : 0;
      const camX = finish.position.x - Math.cos(fx + orbit) * back;
      const camZ = finish.position.z - Math.sin(fx + orbit) * back;
      this.camera.position.set(camX, height, camZ);
      this.camera.lookAt(finish.position.x, podium ? 4.2 : 3.6, finish.position.z);
    } else {
      if (this.celebrateSeed !== -1) this.clearCelebrate();
      const back = 7.2;
      const height = 3.35;
      const camX = player.x - Math.cos(player.heading) * back;
      const camZ = player.z - Math.sin(player.heading) * back;
      this.camera.position.set(camX, height, camZ);
      this.camera.lookAt(player.x, 0.9, player.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  clearCars(): void {
    for (const visual of this.carVisuals.values()) {
      this.scene.remove(visual.root);
      disposeObject(visual.root);
    }
    this.carVisuals.clear();
    this.lastNitro.clear();
    this.clearCelebrate();
  }
}
