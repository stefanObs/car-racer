import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { RaceSession } from "../sim/race";
import type { CarState } from "../sim/vehicle";
import { sampleCenterline } from "../track/buildTrack";

function toonMat(color: string | number): MeshLambertMaterial {
  return new MeshLambertMaterial({ color });
}

export class RaceRenderer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 1, 0.1, 400);
  readonly renderer: WebGLRenderer;
  private readonly carMeshes = new Map<string, Group>();
  private trackGroup = new Group();

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new Color(0x5ba3d9);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x5ba3d9, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const ambient = new AmbientLight(0xffffff, 0.75);
    const sun = new DirectionalLight(0xffffff, 0.9);
    sun.position.set(8, 18, 6);
    this.scene.add(ambient, sun);
    window.addEventListener("resize", () => this.resize(canvas));
    this.resize(canvas);
    this.renderIdle();
  }

  /** Sky clear so the menu is not a black WebGL canvas. */
  renderIdle(): void {
    this.camera.position.set(0, 8, 16);
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
      const asphalt = new Mesh(
        new BoxGeometry(len, 0.15, asphaltW),
        toonMat(0x4a4f57),
      );
      asphalt.position.set(mx, 0, mz);
      asphalt.rotation.y = -angle;
      this.trackGroup.add(asphalt);

      const grassW = track.grassWidth;
      for (const side of [-1, 1]) {
        const grass = new Mesh(new BoxGeometry(len, 0.12, grassW), toonMat(0x3f8f3a));
        const off = track.asphaltHalfWidth + grassW / 2;
        grass.position.set(
          mx + Math.sin(angle) * off * side,
          0.01,
          mz - Math.cos(angle) * off * side,
        );
        grass.rotation.y = -angle;
        this.trackGroup.add(grass);

        const wallKind = track.wallKind[i] ?? "concrete";
        const wall = new Mesh(
          new BoxGeometry(len, wallKind === "tire" ? 1.1 : 1.4, 0.5),
          toonMat(wallKind === "tire" ? 0x1a1a1a : 0x8b9098),
        );
        const wallOff = track.asphaltHalfWidth + track.grassWidth + 0.4;
        wall.position.set(
          mx + Math.sin(angle) * wallOff * side,
          wallKind === "tire" ? 0.55 : 0.7,
          mz - Math.cos(angle) * wallOff * side,
        );
        wall.rotation.y = -angle;
        this.trackGroup.add(wall);

        if (wallKind === "tire") {
          const stripe = new Mesh(new BoxGeometry(len * 0.3, 0.25, 0.52), toonMat(0xe85d04));
          stripe.position.copy(wall.position);
          stripe.position.y = 0.9;
          stripe.rotation.y = -angle;
          this.trackGroup.add(stripe);
        }
      }
    }
    this.scene.add(this.trackGroup);

    for (const car of session.cars) {
      const g = this.makeCarMesh(car);
      this.carMeshes.set(car.id, g);
      this.scene.add(g);
    }
  }

  private makeCarMesh(car: CarState): Group {
    const g = new Group();
    const body = new Mesh(new BoxGeometry(1.3, 0.55, 2.3), toonMat(car.paint));
    body.position.y = 0.4;
    const cabin = new Mesh(new BoxGeometry(1.0, 0.35, 1.1), toonMat(0x1b1b1f));
    cabin.position.set(0, 0.75, -0.1);
    g.add(body, cabin);
    if (car.sticker && car.sticker !== "none") {
      const stickerColor =
        car.sticker === "flames" ? 0xff7a18 : car.sticker === "bolt" ? 0xffe066 : 0x74c0fc;
      const sticker = new Mesh(new BoxGeometry(0.15, 0.35, 1.2), toonMat(stickerColor));
      sticker.position.set(0.7, 0.45, 0);
      g.add(sticker);
    }
    return g;
  }

  sync(session: RaceSession): void {
    for (const car of session.cars) {
      let mesh = this.carMeshes.get(car.id);
      if (!mesh) {
        mesh = this.makeCarMesh(car);
        this.carMeshes.set(car.id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = car.koTimer <= 0 || car.hp > 0;
      if (car.koTimer > 0 && car.hp <= 0) mesh.visible = Math.sin(car.koTimer * 20) > 0;
      mesh.position.set(car.x, car.healFx > 0 ? 0.05 : 0, car.z);
      mesh.rotation.y = -car.heading + Math.PI / 2;
      // facing: heading 0 = +X; model forward is -Z in three default box — use -heading
      mesh.rotation.y = Math.PI / 2 - car.heading;
    }

    const player = session.player();
    const look = sampleCenterline(session.track, (player.progress % session.track.totalLength) + 0.1);
    void look;
    const back = 10;
    const height = 5.5;
    const camX = player.x - Math.cos(player.heading) * back;
    const camZ = player.z - Math.sin(player.heading) * back;
    this.camera.position.set(camX, height, camZ);
    this.camera.lookAt(player.x, 0.5, player.z);
    this.renderer.render(this.scene, this.camera);
  }

  clearCars(): void {
    for (const mesh of this.carMeshes.values()) this.scene.remove(mesh);
    this.carMeshes.clear();
  }
}
