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
import { CARS } from "../data/cars";
import { buildComicCar, type ComicCarParts } from "./comicCarMesh";
import { comicToon, disposeObject } from "./comicMaterials";
import { buildLevelObstacles } from "./levelObstacles";
import { ComicPalette } from "./palette";
import { themeLook, type ThemeLook } from "./themeLook";
import { buildThemeScenery } from "./themeScenery";
import { buildSmoothTrack } from "./trackMesh";

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
  private idleGroup = new Group();
  private idleCar: Group | null = null;
  private fxTime = 0;
  private readonly hemi: HemisphereLight;
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
    this.scene.add(new AmbientLight(0xffffff, 0.4));
    const sun = new DirectionalLight(0xfff1d6, 1.25);
    sun.position.set(18, 28, 12);
    this.scene.add(sun);

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

  private buildIdleShowcase(): void {
    this.idleGroup = new Group();
    const pad = new Mesh(new PlaneGeometry(14, 22), comicToon(ComicPalette.asphalt));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.01, 0);
    const grass = new Mesh(new PlaneGeometry(28, 36), comicToon(ComicPalette.grass));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0, 0);
    const visual = buildComicCar(
      createCarState({
        id: "idle",
        x: 0,
        z: 0,
        heading: 0,
        isPlayer: true,
        paint: "#E03131",
        sticker: "flames",
        stats: { ...CARS.blitz.stats, nitroBonus: 0, ramBonus: 0, grassMitigation: 0 },
      }),
    );
    visual.root.position.set(0, 0, 0);
    visual.root.rotation.y = Math.PI;
    this.idleCar = visual.root;
    this.idleGroup.add(grass, pad, visual.root);
    this.scene.add(this.idleGroup);
  }

  renderIdle(): void {
    this.fxTime += 1 / 60;
    this.idleGroup.visible = true;
    if (this.idleCar) {
      this.idleCar.rotation.y = Math.PI + Math.sin(this.fxTime * 0.35) * 0.35;
    }
    this.camera.position.set(
      Math.sin(this.fxTime * 0.2) * 8.5,
      3.8,
      Math.cos(this.fxTime * 0.2) * 9.5,
    );
    this.camera.lookAt(0, 0.7, 0);
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
    (this.groundMesh.material as MeshToonMaterial).color.setHex(look.ground);
    const skyMat = this.skyMesh.material as MeshBasicMaterial;
    skyMat.map?.dispose();
    skyMat.map = makeSkyTexture(look);
    skyMat.needsUpdate = true;
  }

  buildTrack(session: RaceSession): void {
    this.idleGroup.visible = false;
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
    this.scene.add(this.trackGroup, this.sceneryGroup, this.obstacleGroup);
    this.clearCars();
    this.lastNitro.clear();
    for (const car of session.cars) {
      const visual = buildComicCar(car);
      this.carVisuals.set(car.id, visual);
      this.scene.add(visual.root);
    }
  }

  sync(session: RaceSession): void {
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
    const back = 7.2;
    const height = 3.35;
    const camX = player.x - Math.cos(player.heading) * back;
    const camZ = player.z - Math.sin(player.heading) * back;
    this.camera.position.set(camX, height, camZ);
    this.camera.lookAt(player.x, 0.9, player.z);
    this.renderer.render(this.scene, this.camera);
  }

  clearCars(): void {
    for (const visual of this.carVisuals.values()) {
      this.scene.remove(visual.root);
      disposeObject(visual.root);
    }
    this.carVisuals.clear();
    this.lastNitro.clear();
  }
}
