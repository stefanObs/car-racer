import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";
import { stageFromHp } from "../sim/damage";
import type { RaceSession } from "../sim/race";
import { surfaceAt } from "../sim/zones";
import { buildComicCar, type ComicCarParts } from "./comicCarMesh";
import { comicToon, disposeObject, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";
import { buildThemeScenery } from "./themeScenery";

export class RaceRenderer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(48, 1, 0.1, 500);
  readonly renderer: WebGLRenderer;
  private readonly carVisuals = new Map<string, ComicCarParts>();
  private readonly lastNitro = new Map<string, number>();
  private trackGroup = new Group();
  private sceneryGroup = new Group();
  private fxTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new Color(ComicPalette.sky);
    this.scene.fog = new Fog(ComicPalette.sky, 60, 180);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(ComicPalette.sky, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Hard daylight for cel read (few value steps)
    this.scene.add(new HemisphereLight(0xb8d4f0, 0x3f8f3a, 0.45));
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const sun = new DirectionalLight(0xfff1d6, 1.35);
    sun.position.set(14, 24, 10);
    this.scene.add(sun);

    const ground = new Mesh(new PlaneGeometry(420, 420), comicToon(ComicPalette.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    this.scene.add(ground);

    // Stylized cloud billboards
    for (const [x, z, s] of [
      [-40, -60, 12],
      [30, -80, 16],
      [-20, 70, 10],
      [50, 40, 14],
    ] as const) {
      const cloud = withOutline(new BoxGeometry(s, s * 0.35, 1), comicToon(0xf8f9fa), 1.06);
      cloud.position.set(x, 28, z);
      this.scene.add(cloud);
    }

    window.addEventListener("resize", () => this.resize(canvas));
    this.resize(canvas);
    this.renderIdle();
  }

  renderIdle(): void {
    this.camera.position.set(0, 4, 10);
    this.camera.lookAt(0, 0.8, 0);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  buildTrack(session: RaceSession): void {
    this.scene.remove(this.trackGroup);
    this.scene.remove(this.sceneryGroup);
    disposeObject(this.trackGroup);
    disposeObject(this.sceneryGroup);
    this.trackGroup = new Group();
    this.sceneryGroup = buildThemeScenery(session.track, session.level.theme);
    const track = session.track;

    for (let i = 0; i < track.centerline.length - 1; i++) {
      const a = track.centerline[i]!;
      const b = track.centerline[i + 1]!;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.1;
      const angle = Math.atan2(b.z - a.z, b.x - a.x);
      const asphaltW = track.asphaltHalfWidth * 2;

      const asphalt = withOutline(new BoxGeometry(len, 0.16, asphaltW), comicToon(ComicPalette.asphalt), 1.015);
      asphalt.position.set(mx, 0, mz);
      asphalt.rotation.y = -angle;
      this.trackGroup.add(asphalt);

      // Motion / lane marks
      if (i % 2 === 0) {
        const line = new Mesh(new BoxGeometry(Math.min(len * 0.4, 2.8), 0.05, 0.25), comicToon(ComicPalette.asphaltLine));
        line.position.set(mx, 0.11, mz);
        line.rotation.y = -angle;
        this.trackGroup.add(line);
      }

      const grassW = track.grassWidth;
      for (const side of [-1, 1] as const) {
        const grass = withOutline(
          new BoxGeometry(len, 0.12, grassW),
          comicToon(side > 0 ? ComicPalette.grass : ComicPalette.grassDark),
          1.015,
        );
        const off = track.asphaltHalfWidth + grassW / 2;
        grass.position.set(mx + Math.sin(angle) * off * side, 0.02, mz - Math.cos(angle) * off * side);
        grass.rotation.y = -angle;
        this.trackGroup.add(grass);

        const curb = new Mesh(
          new BoxGeometry(len, 0.18, 0.42),
          comicToon(i % 2 === 0 ? ComicPalette.curbLight : ComicPalette.curbDark),
        );
        const curbOff = track.asphaltHalfWidth + 0.18;
        curb.position.set(mx + Math.sin(angle) * curbOff * side, 0.1, mz - Math.cos(angle) * curbOff * side);
        curb.rotation.y = -angle;
        this.trackGroup.add(curb);

        const wallKind = track.wallKind[i] ?? "concrete";
        const wallOff = track.asphaltHalfWidth + track.grassWidth + 0.55;
        if (wallKind === "tire") {
          const stacks = Math.max(1, Math.floor(len / 2));
          for (let s = 0; s < stacks; s++) {
            const t = (s + 0.5) / stacks;
            const px = a.x + (b.x - a.x) * t + Math.sin(angle) * wallOff * side;
            const pz = a.z + (b.z - a.z) * t - Math.cos(angle) * wallOff * side;
            this.trackGroup.add(this.makeTireStack(px, pz, -angle));
          }
        } else {
          const wall = withOutline(
            new BoxGeometry(len, 1.45, 0.5),
            comicToon(i % 3 === 0 ? ComicPalette.concreteDark : ComicPalette.concrete),
            1.03,
          );
          wall.position.set(mx + Math.sin(angle) * wallOff * side, 0.72, mz - Math.cos(angle) * wallOff * side);
          wall.rotation.y = -angle;
          this.trackGroup.add(wall);
          // Chain-link hint
          const fence = withOutline(new BoxGeometry(len, 0.7, 0.08), comicToon(ComicPalette.outline), 1.02);
          fence.position.set(
            mx + Math.sin(angle) * (wallOff + 0.15) * side,
            1.55,
            mz - Math.cos(angle) * (wallOff + 0.15) * side,
          );
          fence.rotation.y = -angle;
          this.trackGroup.add(fence);
        }
      }
    }

    this.scene.add(this.trackGroup, this.sceneryGroup);
    this.clearCars();
    this.lastNitro.clear();
    for (const car of session.cars) {
      const visual = buildComicCar(car);
      this.carVisuals.set(car.id, visual);
      this.scene.add(visual.root);
    }
  }

  private makeTireStack(x: number, z: number, rotY: number): Group {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    for (let i = 0; i < 3; i++) {
      const tire = withOutline(new CylinderGeometry(0.58, 0.58, 0.4, 10), comicToon(ComicPalette.tire), 1.08);
      tire.rotation.z = Math.PI / 2;
      tire.position.set((i - 1) * 0.12, 0.38 + i * 0.4, 0);
      g.add(tire);
    }
    const stripe = new Mesh(new BoxGeometry(0.22, 0.22, 1.2), comicToon(ComicPalette.tireAccent));
    stripe.position.set(0, 0.85, 0);
    g.add(stripe);
    return g;
  }

  sync(session: RaceSession): void {
    this.fxTime += 1 / 60;
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
        m.position.set(Math.sin(t) * 0.25, 1.0 + (t % 1.2) * 0.8, -1.1 - i * 0.12);
        m.scale.setScalar(0.7 + (t % 1));
      });

      const healing = car.healFx > 0.25;
      sparks.children.forEach((child, i) => {
        const m = child as Mesh;
        m.visible = healing;
        if (!m.visible) return;
        const t = this.fxTime * 8 + i;
        m.position.set(Math.cos(t + i) * 0.8, 0.45 + Math.abs(Math.sin(t)) * 0.7, Math.sin(t * 1.3) * 0.9);
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

    // Chase cam — lower & closer (reference composition)
    const player = session.player();
    const back = 7.5;
    const height = 3.6;
    const camX = player.x - Math.cos(player.heading) * back;
    const camZ = player.z - Math.sin(player.heading) * back;
    this.camera.position.set(camX, height, camZ);
    this.camera.lookAt(player.x, 0.85, player.z);
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
