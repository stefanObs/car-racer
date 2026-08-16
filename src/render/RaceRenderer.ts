import {
  AmbientLight,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
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
import { forwardSpeedAlongHeading, type CarState } from "../sim/vehicle";
import { surfaceAt } from "../sim/zones";
import { sampleCenterline } from "../track/buildTrack";
import { carStateLookKey } from "./carLookKey";
import type { FinishCelebrate } from "../core/finishCelebrate";
import { finishCelebrateProgress, isPodiumPlace } from "../core/finishCelebrate";
import type { MeshInspectBoxFace, MeshInspectComponent, MeshInspectDragMode, MeshInspectTool } from "../core/meshInspect";
import { fxRearZOf, upgradeCarFx } from "./attachCarFx";
import { applyCarFx, nitroBoosting } from "./carFx";
import { buildComicCar, type ComicCarParts } from "./comicCarMesh";
import { comicToon, disposeObject } from "./comicMaterials";
import { spinCarWheels } from "./carWheels";
import { bodyBaseLean, bodyRollZ } from "./carBodyPose";
import { GaragePresenter, type GarageLook } from "./garagePresenter";
import { buildLevelObstacles } from "./levelObstacles";
import {
  buildPanoramaSurround,
  buildSkyDomeMesh,
  disposePanoramaMaps,
  makeSkyDomeTexture,
} from "./panoramaSurround";
import { themeLook } from "./themeLook";
import { buildThemeScenery, trackCentroid } from "./themeScenery";
import { buildSmoothTrack } from "./trackMesh";
import { buildDebugPadGroup, disposeDebugPadGroup } from "./debugPadMesh";
import {
  createLapBillboard,
  disposeLapBillboard,
  lapBillboardFlashUntil,
  lapBillboardFlashVisible,
  syncLapBillboard,
} from "./lapBillboard";
import { ensureIdleClearsRaceField } from "./idleRaceTeardown";

export class RaceRenderer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(46, 1, 0.1, 900);
  readonly renderer: WebGLRenderer;
  private readonly carVisuals = new Map<string, ComicCarParts>();
  private readonly lastNitro = new Map<string, number>();
  /** Comic lap plaques — only while a finish-line flash is active. */
  private readonly lapBillboards = new Map<string, Group>();
  private readonly lapBillboardLastLap = new Map<string, number>();
  private readonly lapBillboardFlashUntil = new Map<string, number>();
  private trackGroup = new Group();
  private sceneryGroup = new Group();
  private panoramaGroup = new Group();
  private obstacleGroup = new Group();
  private celebrateGroup = new Group();
  private celebrateSeed = -1;
  private readonly garage: GaragePresenter;
  private fxTime = 0;
  /** True while track/scenery from the last race are still meant to be shown. */
  private raceFieldActive = false;
  private readonly hemi: HemisphereLight;
  private readonly ambient: AmbientLight;
  private readonly sun: DirectionalLight;
  private readonly groundMesh: Mesh;
  private skyMesh: Mesh;
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

    this.groundMesh = new Mesh(new PlaneGeometry(640, 640), comicToon(look.ground));
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.08;
    this.scene.add(this.groundMesh);

    this.skyMesh = buildSkyDomeMesh(look);
    this.scene.add(this.skyMesh);

    this.garage = new GaragePresenter({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      hemi: this.hemi,
      ambient: this.ambient,
      sun: this.sun,
      fog: this.fog,
      groundMesh: this.groundMesh,
      getSkyMesh: () => this.skyMesh,
      getPanoramaGroup: () => this.panoramaGroup,
    });
    this.garage.buildIdleShowcase();

    window.addEventListener("resize", () => this.resize(canvas));
    this.resize(canvas);
    this.renderIdle();
  }

  private hideRaceFieldMeshes(): void {
    this.trackGroup.visible = false;
    this.sceneryGroup.visible = false;
    this.panoramaGroup.visible = false;
    this.obstacleGroup.visible = false;
    this.raceFieldActive = false;
  }

  setGarageLook(look: GarageLook): void {
    this.garage.setLook(look);
  }

  setGarageDragging(dragging: boolean): void {
    this.garage.setDragging(dragging);
  }

  /** Hover lift while RMB / two-finger tumble is held; releasing snaps flat on the pad. */
  setGaragePitchInspect(active: boolean): void {
    this.garage.setPitchInspect(active);
  }

  isMeshInspect(): boolean {
    return this.garage.isMeshInspect();
  }

  setMeshInspect(on: boolean): void {
    this.garage.setMeshInspect(on);
  }

  pickMeshInspect(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    return this.garage.pickMeshInspect(clientX, clientY, canvas);
  }

  isMeshInspectEdit(): boolean {
    return this.garage.isMeshInspectEdit();
  }

  setMeshInspectEdit(on: boolean): void {
    this.garage.setMeshInspectEdit(on);
  }

  meshInspectSelection() {
    return this.garage.meshInspectSelection();
  }

  meshInspectCatalog() {
    return this.garage.meshInspectCatalog();
  }

  meshInspectPatchText() {
    return this.garage.meshInspectPatchText();
  }

  meshInspectDirtyCount() {
    return this.garage.meshInspectDirtyCount();
  }

  selectMeshInspectById(id: string): boolean {
    return this.garage.selectMeshInspectById(id);
  }

  meshInspectHitIsSelection(hitId: string | null | undefined): boolean {
    return this.garage.meshInspectHitIsSelection(hitId);
  }

  selectMeshInspectAt(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    wantParent: boolean,
    wantEdge = false,
  ) {
    return this.garage.selectMeshInspectAt(clientX, clientY, canvas, wantParent, wantEdge);
  }

  clearMeshInspectSelection(): boolean {
    return this.garage.clearMeshInspectSelection();
  }

  dragMeshInspect(
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
    mode: MeshInspectDragMode,
  ): void {
    this.garage.dragMeshInspect(fromClientX, fromClientY, toClientX, toClientY, canvas, mode);
  }

  nudgeMeshInspect(dx: number, dy: number, dz: number): void {
    this.garage.nudgeMeshInspect(dx, dy, dz);
  }

  resetMeshInspectSelection(): boolean {
    return this.garage.resetMeshInspectSelection();
  }

  yawMeshInspect(radians: number): void {
    this.garage.yawMeshInspect(radians);
  }

  rotateMeshInspect(dxPx: number, dyPx: number, mode: MeshInspectDragMode): void {
    this.garage.rotateMeshInspect(dxPx, dyPx, mode);
  }

  scaleMeshInspect(dxPx: number, dyPx: number, mode: MeshInspectDragMode, uniform: boolean): void {
    this.garage.scaleMeshInspect(dxPx, dyPx, mode, uniform);
  }

  scaleMeshInspectUniform(factor: number): void {
    this.garage.scaleMeshInspectUniform(factor);
  }

  dragMeshInspectEdge(
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
    mode: MeshInspectDragMode,
  ): void {
    this.garage.dragMeshInspectEdge(fromClientX, fromClientY, toClientX, toClientY, canvas, mode);
  }

  meshInspectPlaceTool() {
    return this.garage.meshInspectPlaceTool();
  }

  setMeshInspectPlaceTool(tool: MeshInspectTool): void {
    this.garage.setMeshInspectPlaceTool(tool);
  }

  meshInspectPlaceComponent() {
    return this.garage.meshInspectPlaceComponent();
  }

  setMeshInspectPlaceComponent(component: MeshInspectComponent): void {
    this.garage.setMeshInspectPlaceComponent(component);
  }

  meshInspectHasEdge(): boolean {
    return this.garage.meshInspectHasEdge();
  }

  clearMeshInspectEdge(): boolean {
    return this.garage.clearMeshInspectEdge();
  }

  isMeshInspectBoxPaint(): boolean {
    return this.garage.isMeshInspectBoxPaint();
  }

  setMeshInspectBoxPaint(on: boolean): void {
    this.garage.setMeshInspectBoxPaint(on);
  }

  meshInspectBox() {
    return this.garage.meshInspectPaintedBox();
  }

  commitMeshInspectBox(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    canvas: HTMLCanvasElement,
  ) {
    return this.garage.commitMeshInspectBox(x0, y0, x1, y1, canvas);
  }

  pickMeshInspectBoxHandle(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    return this.garage.pickMeshInspectBoxHandle(clientX, clientY, canvas);
  }

  resizeMeshInspectBox(
    face: MeshInspectBoxFace,
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
  ): void {
    this.garage.resizeMeshInspectBox(face, fromClientX, fromClientY, toClientX, toClientY, canvas);
  }

  clearMeshInspectBox(): boolean {
    return this.garage.clearMeshInspectBox();
  }

  meshInspectBoxCanReset(): boolean {
    return this.garage.meshInspectBoxCanReset();
  }

  resetMeshInspectBox(): boolean {
    return this.garage.resetMeshInspectBox();
  }

  /** Pointer drag — LMB yaw; RMB / 2-finger free tumble. */
  addGarageOrbitFromDrag(deltaXPx: number, deltaYPx: number, axes?: { yaw: boolean; pitch: boolean }): void {
    this.garage.addOrbitFromDrag(deltaXPx, deltaYPx, axes);
  }

  renderIdle(): void {
    ensureIdleClearsRaceField({
      raceCarCount: this.carVisuals.size,
      raceFieldVisible: this.raceFieldActive,
      clearRaceCars: () => this.clearCars(),
      hideRaceField: () => this.hideRaceFieldMeshes(),
      restoreGarageEnvironment: () => this.garage.applyEnvironment(),
    });
    this.fxTime += 1 / 60;
    this.garage.tickIdle(this.fxTime);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private applyTheme(theme: string, trackCentroidXZ?: { x: number; z: number }): void {
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
    // Harbor: pier pad around the oval only — water apron + panorama own the horizon.
    // Must be centered on the track centroid (Hafenstart is not at world origin).
    const harbor = theme.toLowerCase() === "harbor";
    const span = harbor ? 128 : 640;
    const prev = this.groundMesh.geometry;
    this.groundMesh.geometry = new PlaneGeometry(span, span);
    prev.dispose();
    if (trackCentroidXZ) {
      this.groundMesh.position.set(trackCentroidXZ.x, -0.08, trackCentroidXZ.z);
    } else {
      this.groundMesh.position.set(0, -0.08, 0);
    }
    const skyMat = this.skyMesh.material as MeshBasicMaterial;
    skyMat.map?.dispose();
    const skyTex = makeSkyDomeTexture(look, theme);
    skyMat.map = skyTex;
    skyMat.needsUpdate = true;
    // Equirect harbor plate as scene background so the skyline always reads when looking out.
    if (harbor) {
      skyTex.mapping = EquirectangularReflectionMapping;
      this.scene.background = skyTex;
      this.skyMesh.visible = false;
    } else {
      this.scene.background = new Color(look.sky);
      this.skyMesh.visible = true;
    }
  }

  buildTrack(session: RaceSession): void {
    this.garage.hide();
    this.groundMesh.visible = true;
    this.skyMesh.visible = true;
    if (!session.track.debugPad) this.applyTheme(session.level.theme, trackCentroid(session.track));
    this.scene.remove(this.trackGroup);
    this.scene.remove(this.sceneryGroup);
    this.scene.remove(this.panoramaGroup);
    this.scene.remove(this.obstacleGroup);
    if (this.trackGroup.userData.debugPad) disposeDebugPadGroup(this.trackGroup);
    disposeObject(this.trackGroup);
    disposeObject(this.sceneryGroup);
    disposePanoramaMaps(this.panoramaGroup);
    disposeObject(this.panoramaGroup);
    disposeObject(this.obstacleGroup);
    const look = themeLook(session.level.theme);
    if (session.track.debugPad) {
      this.trackGroup = buildDebugPadGroup();
      this.sceneryGroup = new Group();
      this.panoramaGroup = new Group();
      this.obstacleGroup = new Group();
      this.groundMesh.visible = false;
      this.skyMesh.visible = true;
      this.scene.background = new Color(0x5ba3d9);
      this.fog.color.setHex(0x8ec4e8);
      this.fog.near = 180;
      this.fog.far = 720;
      this.renderer.setClearColor(0x5ba3d9, 1);
      this.hemi.color.setHex(0xfff4e0);
      this.hemi.groundColor.setHex(0xd0d6dc);
      this.hemi.intensity = 1.25;
      this.ambient.intensity = 0.95;
      this.sun.color.setHex(0xfff8ee);
      this.sun.intensity = 2.15;
      this.sun.position.set(8, 22, 14);
    } else {
      this.trackGroup = buildSmoothTrack(session.track);
      this.sceneryGroup = buildThemeScenery(session.track, session.level.theme);
      this.panoramaGroup = buildPanoramaSurround(session.track, session.level.theme, look);
      this.obstacleGroup = buildLevelObstacles(session.level);
      this.groundMesh.visible = true;
    }
    this.trackGroup.visible = true;
    this.sceneryGroup.visible = true;
    this.panoramaGroup.visible = !session.track.debugPad;
    this.obstacleGroup.visible = true;
    this.raceFieldActive = true;
    this.clearCelebrate();
    this.scene.add(this.trackGroup, this.sceneryGroup, this.panoramaGroup, this.obstacleGroup);
    this.clearCars();
    this.lastNitro.clear();
    for (const car of session.cars) {
      const visual = buildComicCar(car);
      upgradeCarFx(visual);
      visual.root.userData.lookKey = carStateLookKey(car);
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
    this.garage.hide();

    for (const car of session.cars) {
      let visual = this.carVisuals.get(car.id);
      const lookKey = carStateLookKey(car);
      if (visual && visual.root.userData.lookKey !== lookKey) {
        this.replaceCarVisual(car);
        visual = this.carVisuals.get(car.id);
      }
      if (!visual) {
        visual = buildComicCar(car);
        upgradeCarFx(visual);
        visual.root.userData.lookKey = lookKey;
        this.carVisuals.set(car.id, visual);
        this.scene.add(visual.root);
      }
      if (!visual) continue;
      const { root } = visual;
      const stage = stageFromHp(car.hp);
      root.visible = !(car.koTimer > 0 && car.hp <= 0 && Math.sin(car.koTimer * 20) <= 0);

      const bump = surfaceAt(session.track, car.x, car.z, car.stats.grassMitigation, car.stats.suspension).bump;
      const hop =
        car.y > 0.05
          ? 0
          : bump * 0.25 * Math.sin(this.fxTime * 22 + car.progress * 3) +
            (stage >= 2 ? Math.sin(this.fxTime * 18 + car.progress) * 0.05 : 0);
      const pitch = car.y > 0.05 ? Math.min(0.55, car.vy * 0.045) : 0;
      const moveAng = Math.atan2(car.vz, car.vx);
      let slip = car.heading - moveAng;
      while (slip > Math.PI) slip -= Math.PI * 2;
      while (slip < -Math.PI) slip += Math.PI * 2;
      // Nose follows control heading; mild bank only — steered wheels carry the turn read
      root.position.set(car.x, car.y + (car.healFx > 0.2 ? 0.05 : 0) + hop, car.z);
      root.rotation.y = Math.PI / 2 - car.heading;
      root.rotation.x = pitch;
      root.rotation.z = bodyRollZ({
        drift: car.drift,
        slip,
        baseLean: bodyBaseLean(stage, car.y > 0.05, bump),
        wobble: Math.sin(this.fxTime * 10),
      });

      const rollSpeed = forwardSpeedAlongHeading(car.heading, car.vx, car.vz);
      spinCarWheels(visual.wheels ?? [], rollSpeed, 1 / 60, car.steer);
      visual.lastHeading = car.heading;

      const prevNitro = this.lastNitro.get(car.id) ?? car.nitro;
      const boosting = nitroBoosting(prevNitro, car.nitro);
      this.lastNitro.set(car.id, car.nitro);
      applyCarFx(
        {
          smoke: visual.smoke,
          sparks: visual.sparks,
          nitro: visual.nitro,
          shield: visual.shield,
          fxRearZ: fxRearZOf(visual),
        },
        { stage, healFx: car.healFx, boosting, lapShield: car.lapShield },
        this.fxTime,
      );

      const prevLap = this.lapBillboardLastLap.get(car.id);
      const flashUntil = lapBillboardFlashUntil(prevLap, car.lap, this.fxTime);
      if (flashUntil != null) this.lapBillboardFlashUntil.set(car.id, flashUntil);
      this.lapBillboardLastLap.set(car.id, car.lap);
      const flashing = lapBillboardFlashVisible(
        this.lapBillboardFlashUntil.get(car.id) ?? 0,
        this.fxTime,
      );

      let plaque = this.lapBillboards.get(car.id);
      if (flashing) {
        if (!plaque) {
          plaque = createLapBillboard();
          this.lapBillboards.set(car.id, plaque);
          this.scene.add(plaque);
        }
        syncLapBillboard(plaque, root, this.camera, car.lap, session.level.laps, root.visible, car.y);
      } else if (plaque) {
        plaque.visible = false;
      }
    }

    // Drop plaques for cars that left the field
    for (const [id, plaque] of this.lapBillboards) {
      if (this.carVisuals.has(id)) continue;
      this.scene.remove(plaque);
      disposeLapBillboard(plaque);
      this.lapBillboards.delete(id);
      this.lapBillboardLastLap.delete(id);
      this.lapBillboardFlashUntil.delete(id);
    }

    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __ccCars?: typeof session.cars;
        __ccFxTripo?: boolean;
        __ccScene?: typeof this.scene;
      };
      w.__ccCars = session.cars;
      w.__ccFxTripo = [...this.carVisuals.values()].every((v) => v.smoke.userData.tripoFx === true);
      w.__ccScene = this.scene;
    }

    const player = session.player();
    if (celebrate && celebrate.ranked) {
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
      const height = 3.35 + Math.min(2.2, player.y * 0.55);
      const camX = player.x - Math.cos(player.heading) * back;
      const camZ = player.z - Math.sin(player.heading) * back;
      this.camera.position.set(camX, height, camZ);
      this.camera.lookAt(player.x, 0.9 + player.y * 0.65, player.z);
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
    for (const plaque of this.lapBillboards.values()) {
      this.scene.remove(plaque);
      disposeLapBillboard(plaque);
    }
    this.lapBillboards.clear();
    this.lapBillboardLastLap.clear();
    this.lapBillboardFlashUntil.clear();
    this.clearCelebrate();
  }

  private replaceCarVisual(car: CarState): void {
    const old = this.carVisuals.get(car.id);
    if (old) {
      this.scene.remove(old.root);
      disposeObject(old.root);
      this.carVisuals.delete(car.id);
    }
    const visual = buildComicCar(car);
    upgradeCarFx(visual);
    visual.root.userData.lookKey = carStateLookKey(car);
    this.carVisuals.set(car.id, visual);
    this.scene.add(visual.root);
  }
}
