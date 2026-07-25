import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import { stageFromHp } from "../sim/damage";
import type { RaceSession } from "../sim/race";
import type { CarState } from "../sim/vehicle";
import { surfaceAt } from "../sim/zones";
import { comicToon, disposeObject, withOutline } from "./comicMaterials";
import { ComicPalette } from "./palette";

type CarVisual = {
  root: Group;
  body: Mesh;
  smoke: Group;
  sparks: Group;
  nitro: Group;
};

export class RaceRenderer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(52, 1, 0.1, 500);
  readonly renderer: WebGLRenderer;
  private readonly carVisuals = new Map<string, CarVisual>();
  private readonly lastNitro = new Map<string, number>();
  private trackGroup = new Group();
  private fxTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new Color(ComicPalette.sky);
    this.scene.fog = new Fog(ComicPalette.sky, 80, 220);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(ComicPalette.sky, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambient = new AmbientLight(0xffffff, 0.55);
    const sun = new DirectionalLight(0xfff3e0, 1.15);
    sun.position.set(12, 22, 8);
    const fill = new DirectionalLight(0xa8d5ff, 0.35);
    fill.position.set(-10, 8, -6);
    this.scene.add(ambient, sun, fill);

    const ground = new Mesh(new PlaneGeometry(400, 400), comicToon(ComicPalette.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    this.scene.add(ground);

    window.addEventListener("resize", () => this.resize(canvas));
    this.resize(canvas);
    this.renderIdle();
  }

  renderIdle(): void {
    this.camera.position.set(0, 10, 18);
    this.camera.lookAt(0, 0, 0);
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
    disposeObject(this.trackGroup);
    this.trackGroup = new Group();
    const track = session.track;

    for (let i = 0; i < track.centerline.length - 1; i++) {
      const a = track.centerline[i]!;
      const b = track.centerline[i + 1]!;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.1;
      const angle = Math.atan2(b.z - a.z, b.x - a.x);
      const asphaltW = track.asphaltHalfWidth * 2;

      const asphalt = withOutline(new BoxGeometry(len, 0.18, asphaltW), comicToon(ComicPalette.asphalt), 1.02);
      asphalt.position.set(mx, 0, mz);
      asphalt.rotation.y = -angle;
      this.trackGroup.add(asphalt);

      if (i % 2 === 0) {
        const line = new Mesh(new BoxGeometry(Math.min(len * 0.45, 3.2), 0.04, 0.28), comicToon(ComicPalette.asphaltLine));
        line.position.set(mx, 0.12, mz);
        line.rotation.y = -angle;
        this.trackGroup.add(line);
      }

      const grassW = track.grassWidth;
      for (const side of [-1, 1] as const) {
        const grass = withOutline(
          new BoxGeometry(len, 0.14, grassW),
          comicToon(side > 0 ? ComicPalette.grass : ComicPalette.grassDark),
          1.02,
        );
        const off = track.asphaltHalfWidth + grassW / 2;
        grass.position.set(mx + Math.sin(angle) * off * side, 0.02, mz - Math.cos(angle) * off * side);
        grass.rotation.y = -angle;
        this.trackGroup.add(grass);

        // Red/white curb at asphalt edge
        const curb = new Mesh(
          new BoxGeometry(len, 0.16, 0.35),
          comicToon(i % 2 === 0 ? ComicPalette.curbLight : ComicPalette.curbDark),
        );
        const curbOff = track.asphaltHalfWidth + 0.15;
        curb.position.set(mx + Math.sin(angle) * curbOff * side, 0.1, mz - Math.cos(angle) * curbOff * side);
        curb.rotation.y = -angle;
        this.trackGroup.add(curb);

        const wallKind = track.wallKind[i] ?? "concrete";
        const wallOff = track.asphaltHalfWidth + track.grassWidth + 0.55;
        if (wallKind === "tire") {
          const stacks = Math.max(1, Math.floor(len / 2.2));
          for (let s = 0; s < stacks; s++) {
            const t = (s + 0.5) / stacks;
            const px = a.x + (b.x - a.x) * t + Math.sin(angle) * wallOff * side;
            const pz = a.z + (b.z - a.z) * t - Math.cos(angle) * wallOff * side;
            this.trackGroup.add(this.makeTireStack(px, pz, -angle));
          }
        } else {
          const wall = withOutline(
            new BoxGeometry(len, 1.35, 0.55),
            comicToon(i % 3 === 0 ? ComicPalette.concreteDark : ComicPalette.concrete),
            1.03,
          );
          wall.position.set(mx + Math.sin(angle) * wallOff * side, 0.68, mz - Math.cos(angle) * wallOff * side);
          wall.rotation.y = -angle;
          this.trackGroup.add(wall);
        }
      }
    }

    this.scene.add(this.trackGroup);
    this.clearCars();
    this.lastNitro.clear();
    for (const car of session.cars) {
      const visual = this.makeCarVisual(car);
      this.carVisuals.set(car.id, visual);
      this.scene.add(visual.root);
    }
  }

  private makeTireStack(x: number, z: number, rotY: number): Group {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    for (let i = 0; i < 3; i++) {
      const tire = withOutline(
        new CylinderGeometry(0.55, 0.55, 0.38, 10),
        comicToon(ComicPalette.tire),
        1.06,
      );
      tire.rotation.z = Math.PI / 2;
      tire.position.set((i - 1) * 0.15, 0.35 + i * 0.38, 0);
      g.add(tire);
      if (i === 1) {
        const stripe = new Mesh(new BoxGeometry(0.2, 0.2, 1.15), comicToon(ComicPalette.tireAccent));
        stripe.position.set(0, 0.75, 0);
        g.add(stripe);
      }
    }
    return g;
  }

  private makeCarVisual(car: CarState): CarVisual {
    const root = new Group();
    const body = withOutline(new BoxGeometry(1.35, 0.5, 2.4), comicToon(car.paint), 1.08);
    body.position.y = 0.42;
    body.scale.set(1, 1, 1);

    const nose = withOutline(new BoxGeometry(1.15, 0.28, 0.55), comicToon(car.paint), 1.08);
    nose.position.set(0, 0.38, 1.35);

    const cabin = withOutline(new BoxGeometry(1.05, 0.38, 1.15), comicToon(ComicPalette.cabin), 1.08);
    cabin.position.set(0, 0.78, -0.05);

    const spoiler = withOutline(new BoxGeometry(1.25, 0.12, 0.35), comicToon(ComicPalette.cabin), 1.1);
    spoiler.position.set(0, 0.95, -1.05);

    const wheels: Mesh[] = [];
    for (const [wx, wz] of [
      [-0.7, 0.75],
      [0.7, 0.75],
      [-0.7, -0.85],
      [0.7, -0.85],
    ] as const) {
      const wheel = withOutline(new CylinderGeometry(0.32, 0.32, 0.28, 10), comicToon(ComicPalette.tire), 1.1);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.32, wz);
      wheels.push(wheel);
      root.add(wheel);
    }

    if (car.sticker && car.sticker !== "none") {
      const stickerColor =
        car.sticker === "flames"
          ? ComicPalette.nitroOrange
          : car.sticker === "bolt"
            ? ComicPalette.repairSpark
            : ComicPalette.nitroCyan;
      const sticker = new Mesh(new BoxGeometry(0.08, 0.32, 1.1), comicToon(stickerColor));
      sticker.position.set(0.72, 0.48, 0.1);
      root.add(sticker);
    }

    const smoke = new Group();
    for (let i = 0; i < 5; i++) {
      const puff = new Mesh(new SphereGeometry(0.18 + i * 0.04, 8, 8), comicToon(ComicPalette.smoke));
      puff.visible = false;
      smoke.add(puff);
    }
    const sparks = new Group();
    for (let i = 0; i < 6; i++) {
      const spark = new Mesh(new BoxGeometry(0.08, 0.08, 0.08), comicToon(ComicPalette.repairSpark, { emissive: ComicPalette.repairSpark }));
      spark.visible = false;
      sparks.add(spark);
    }
    const nitro = new Group();
    for (let i = 0; i < 4; i++) {
      const trail = new Mesh(
        new BoxGeometry(0.2, 0.12, 0.55),
        comicToon(i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan, {
          emissive: i % 2 === 0 ? ComicPalette.nitroOrange : ComicPalette.nitroCyan,
        }),
      );
      trail.position.set((i - 1.5) * 0.18, 0.35, -1.5 - i * 0.25);
      trail.visible = false;
      nitro.add(trail);
    }

    root.add(body, nose, cabin, spoiler, smoke, sparks, nitro);
    return { root, body, smoke, sparks, nitro };
  }

  sync(session: RaceSession): void {
    this.fxTime += 1 / 60;
    for (const car of session.cars) {
      let visual = this.carVisuals.get(car.id);
      if (!visual) {
        visual = this.makeCarVisual(car);
        this.carVisuals.set(car.id, visual);
        this.scene.add(visual.root);
      }
      const { root, smoke, sparks, nitro } = visual;
      const stage = stageFromHp(car.hp);
      root.visible = !(car.koTimer > 0 && car.hp <= 0 && Math.sin(car.koTimer * 20) <= 0);

      const suspension = car.stats.suspension;
      const bump = surfaceAt(session.track, car.x, car.z, car.stats.grassMitigation, suspension).bump;
      const hop =
        bump * 0.22 * Math.sin(this.fxTime * 22 + car.progress * 3) +
        (stage >= 2 ? Math.sin(this.fxTime * 18 + car.progress) * 0.04 : 0);
      const lean = (stage >= 2 ? 0.08 : 0) + bump * 0.12;
      root.position.set(car.x, (car.healFx > 0.2 ? 0.06 : 0) + hop, car.z);
      root.rotation.y = Math.PI / 2 - car.heading;
      root.rotation.z = lean * Math.sin(this.fxTime * 10);

      // Damage smoke
      const showSmoke = stage >= 1 && stage < 4;
      smoke.children.forEach((child, i) => {
        const m = child as Mesh;
        m.visible = showSmoke && i < (stage === 1 ? 2 : stage === 2 ? 4 : 5);
        if (!m.visible) return;
        const t = this.fxTime * (1.5 + i * 0.2) + i;
        m.position.set(Math.sin(t) * 0.2, 0.9 + (t % 1.2) * 0.7, -0.9 - i * 0.1);
        const s = 0.7 + (t % 1);
        m.scale.setScalar(s);
      });

      // Heal sparks
      const healing = car.healFx > 0.25;
      sparks.children.forEach((child, i) => {
        const m = child as Mesh;
        m.visible = healing;
        if (!m.visible) return;
        const t = this.fxTime * 8 + i;
        m.position.set(Math.cos(t + i) * 0.7, 0.4 + Math.abs(Math.sin(t)) * 0.6, Math.sin(t * 1.3) * 0.8);
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
    const back = 11;
    const height = 5.8;
    const camX = player.x - Math.cos(player.heading) * back;
    const camZ = player.z - Math.sin(player.heading) * back;
    this.camera.position.set(camX, height, camZ);
    this.camera.lookAt(player.x, 0.6, player.z);
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
