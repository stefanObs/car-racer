import {
  BoxHelper,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  SphereGeometry,
  Vector2,
  Vector3,
  type AmbientLight,
  type DirectionalLight,
  type Fog,
  type HemisphereLight,
  type MeshToonMaterial,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { CARS } from "../data/cars";
import { createCarState } from "../sim/vehicle";
import { upgradeCarFx } from "./attachCarFx";
import { buildComicCar } from "./comicCarMesh";
import { comicToon, disposeObject, withOutline } from "./comicMaterials";
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
import { carBodyWorldBox, carBodyWorldCenter, garagePadContactSnapDelta, seatGarageGroundBlob } from "./garageSit";
import {
  MESH_INSPECT_EDGE_HELPER_NAME,
  MESH_INSPECT_MARKER_BLUE,
  MESH_INSPECT_MARKER_NAME,
  MESH_INSPECT_MARKER_RADIUS,
  MESH_INSPECT_MARKER_RED,
  MESH_INSPECT_SELECT_HELPER_NAME,
  carMeshSpaceRoot,
  meshInspectBackgroundHex,
  meshInspectHitName,
  pickMeshInspectHits,
  pointerToNdc,
  type MeshInspectMarkerPose,
} from "./meshInspectPick";
import {
  applyMeshSpaceDelta,
  applyMeshSpaceRotation,
  applyViewDragRotation,
  applyWorldDeltaToObject,
  cameraPlaneWorldDelta,
  constrainWorldDeltaInMeshSpace,
  findObjectByUuid,
  isObjectUnder,
  rememberMeshInspectHome,
  restoreMeshInspectHome,
  selectionPose,
} from "./meshInspectTransform";
import {
  applyWorldDeltaToEdge,
  edgeWorldEnds,
  pickClosestEdge,
  restoreGeometryHome,
  type PickedMeshEdge,
} from "./meshInspectEdges";
import type {
  MeshInspectComponent,
  MeshInspectDragMode,
  MeshInspectHit,
  MeshInspectSelection,
  MeshInspectTool,
} from "../core/meshInspect";

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
  private meshInspect = false;
  private readonly meshInspectHidden: { obj: Group["children"][number]; visible: boolean }[] = [];
  private meshInspectMarker: Mesh | null = null;
  private meshInspectEdit = false;
  private meshInspectSelected: Object3D | null = null;
  private meshInspectSelectHelper: BoxHelper | null = null;
  private meshInspectTool: MeshInspectTool = "move";
  private meshInspectComponent: MeshInspectComponent = "object";
  private meshInspectEdge: PickedMeshEdge | null = null;
  private meshInspectEdgeHelper: Line | null = null;
  private idlePaint = "#e03131";
  private readonly host: GaragePresenterHost;
  private readonly _inspectLook = new Vector3();
  private readonly _inspectSize = new Vector3();
  private readonly _inspectWorld = new Vector3();
  private readonly _inspectFromNdc = new Vector2();
  private readonly _inspectToNdc = new Vector2();
  private readonly _edgeA = new Vector3();
  private readonly _edgeB = new Vector3();

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

    const paint = look?.paint ?? "#e03131";
    this.idlePaint = paint;
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
    this.meshInspectHidden.length = 0;
    this.clearMeshInspectSelection();
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
    this.applyMeshInspectView();
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
    if (this.meshInspect) return;
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
    if (this.meshInspect) {
      pivot.position.set(this.garageOrbitX, this.garageSitCenterY, this.garageOrbitZ);
      pivot.rotation.order = "YXZ";
      pivot.rotation.y = this.garageYaw;
      pivot.rotation.x = this.garagePitch;
      pivot.rotation.z = 0;
      return;
    }
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

  isMeshInspect(): boolean {
    return this.meshInspect;
  }

  setMeshInspect(on: boolean): void {
    if (this.meshInspect === on) {
      this.applyMeshInspectView();
      return;
    }
    this.meshInspect = on;
    if (!on) {
      this.hideMeshInspectMarker();
      this.garagePitchInspect = false;
      this.meshInspectEdit = false;
      this.meshInspectTool = "move";
      this.meshInspectComponent = "object";
      this.clearMeshInspectSelection();
    }
    this.applyMeshInspectView();
    this.applyOrbitPose();
    if (on) this.frameMeshInspectCamera();
  }

  isMeshInspectEdit(): boolean {
    return this.meshInspect && this.meshInspectEdit;
  }

  setMeshInspectEdit(on: boolean): void {
    if (!this.meshInspect) return;
    this.meshInspectEdit = on;
    if (!on) {
      this.meshInspectTool = "move";
      this.meshInspectComponent = "object";
      this.clearMeshInspectSelection();
    }
  }

  meshInspectPlaceTool(): MeshInspectTool {
    return this.meshInspectTool;
  }

  setMeshInspectPlaceTool(tool: MeshInspectTool): void {
    if (!this.meshInspectEdit) return;
    this.meshInspectTool = tool;
  }

  meshInspectPlaceComponent(): MeshInspectComponent {
    return this.meshInspectComponent;
  }

  setMeshInspectPlaceComponent(component: MeshInspectComponent): void {
    if (!this.meshInspectEdit) return;
    this.meshInspectComponent = component;
    if (component === "object") this.clearMeshInspectEdge();
  }

  meshInspectHasEdge(): boolean {
    return this.meshInspectEdge !== null;
  }

  meshInspectSelection(): MeshInspectSelection | null {
    return this.selectionPoseOrNull();
  }

  meshInspectHitIsSelection(hitId: string | null | undefined): boolean {
    if (!this.meshInspectSelected || !hitId) return false;
    return isObjectUnder(this.meshInspectSelected, hitId);
  }

  pickMeshInspect(clientX: number, clientY: number, canvas: HTMLCanvasElement): MeshInspectHit[] {
    if (!this.meshInspect || !this.idleCar) {
      this.hideMeshInspectMarker();
      return [];
    }
    const picked = pickMeshInspectHits(this.idleCar, this.host.camera, clientX, clientY, canvas);
    this.syncMeshInspectMarker(picked.marker);
    this.syncMeshInspectSelectHelper();
    return picked.hits;
  }

  selectMeshInspectAt(
    clientX: number,
    clientY: number,
    canvas: HTMLCanvasElement,
    wantParent: boolean,
    wantEdge = false,
  ): MeshInspectHit[] {
    if (!this.meshInspect || !this.idleCar) {
      this.hideMeshInspectMarker();
      return [];
    }
    const picked = pickMeshInspectHits(this.idleCar, this.host.camera, clientX, clientY, canvas);
    this.syncMeshInspectMarker(picked.marker);
    const hits = picked.hits;
    const nearest = hits[0];
    if (!nearest?.id) {
      this.clearMeshInspectSelection();
      return hits;
    }
    const pickEdge = wantEdge || this.meshInspectComponent === "edge";
    if (pickEdge) {
      const mesh = this.inspectMeshFromPick(picked.hitMeshId ?? nearest.id);
      const world = picked.hitWorld;
      if (!mesh || !world) {
        this.clearMeshInspectSelection();
        return hits;
      }
      this.meshInspectComponent = "edge";
      this.setMeshInspectSelected(mesh);
      this.meshInspectEdge = pickClosestEdge(mesh, new Vector3(world.x, world.y, world.z));
      this.syncMeshInspectSelectHelper();
      return hits;
    }
    const id = wantParent && nearest.parentId ? nearest.parentId : nearest.id;
    const obj = findObjectByUuid(this.idleCar, id);
    if (!obj) {
      this.clearMeshInspectSelection();
      return hits;
    }
    this.clearMeshInspectEdge();
    this.setMeshInspectSelected(obj);
    return hits;
  }

  clearMeshInspectSelection(): boolean {
    const had = this.meshInspectSelected !== null || this.meshInspectEdge !== null;
    this.meshInspectSelected = null;
    this.clearMeshInspectEdge();
    this.disposeMeshInspectSelectHelper();
    this.disposeMeshInspectEdgeHelper();
    return had;
  }

  clearMeshInspectEdge(): boolean {
    const had = this.meshInspectEdge !== null;
    this.meshInspectEdge = null;
    if (this.meshInspectEdgeHelper) this.meshInspectEdgeHelper.visible = false;
    return had;
  }

  dragMeshInspect(
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
    mode: MeshInspectDragMode,
  ): void {
    const obj = this.meshInspectSelected;
    const car = this.idleCar;
    if (!obj || !car) return;
    const space = carMeshSpaceRoot(car);
    obj.updateMatrixWorld(true);
    obj.getWorldPosition(this._inspectWorld);
    this._inspectFromNdc.copy(pointerToNdc(fromClientX, fromClientY, canvas));
    this._inspectToNdc.copy(pointerToNdc(toClientX, toClientY, canvas));
    const worldDelta = cameraPlaneWorldDelta(
      this.host.camera,
      this._inspectFromNdc,
      this._inspectToNdc,
      this._inspectWorld,
    );
    const constrained = constrainWorldDeltaInMeshSpace(space, this._inspectWorld, worldDelta, mode);
    applyWorldDeltaToObject(obj, constrained);
    this.syncMeshInspectSelectHelper();
  }

  dragMeshInspectEdge(
    fromClientX: number,
    fromClientY: number,
    toClientX: number,
    toClientY: number,
    canvas: HTMLCanvasElement,
    mode: MeshInspectDragMode,
  ): void {
    const edge = this.meshInspectEdge;
    const car = this.idleCar;
    if (!edge || !car) return;
    const space = carMeshSpaceRoot(car);
    edgeWorldEnds(edge, this._edgeA, this._edgeB);
    this._inspectWorld.copy(this._edgeA).add(this._edgeB).multiplyScalar(0.5);
    this._inspectFromNdc.copy(pointerToNdc(fromClientX, fromClientY, canvas));
    this._inspectToNdc.copy(pointerToNdc(toClientX, toClientY, canvas));
    const worldDelta = cameraPlaneWorldDelta(
      this.host.camera,
      this._inspectFromNdc,
      this._inspectToNdc,
      this._inspectWorld,
    );
    const constrained = constrainWorldDeltaInMeshSpace(space, this._inspectWorld, worldDelta, mode);
    applyWorldDeltaToEdge(edge, constrained);
    this.syncMeshInspectSelectHelper();
  }

  rotateMeshInspect(dxPx: number, dyPx: number, mode: MeshInspectDragMode): void {
    const obj = this.meshInspectSelected;
    const car = this.idleCar;
    if (!obj || !car) return;
    applyViewDragRotation(obj, carMeshSpaceRoot(car), dxPx, dyPx, mode);
    this.syncMeshInspectSelectHelper();
  }

  yawMeshInspect(radians: number): void {
    const obj = this.meshInspectSelected;
    const car = this.idleCar;
    if (!obj || !car) return;
    applyMeshSpaceRotation(obj, carMeshSpaceRoot(car), radians, 0);
    this.syncMeshInspectSelectHelper();
  }

  nudgeMeshInspect(dx: number, dy: number, dz: number): void {
    const obj = this.meshInspectSelected;
    const car = this.idleCar;
    if (!obj || !car) return;
    applyMeshSpaceDelta(obj, carMeshSpaceRoot(car), dx, dy, dz);
    this.syncMeshInspectSelectHelper();
  }

  resetMeshInspectSelection(): boolean {
    const obj = this.meshInspectSelected;
    if (!obj) return false;
    let ok = restoreMeshInspectHome(obj);
    if (obj instanceof Mesh) ok = restoreGeometryHome(obj) || ok;
    const edgeMesh = this.meshInspectEdge?.mesh;
    if (edgeMesh && edgeMesh !== obj) ok = restoreGeometryHome(edgeMesh) || ok;
    this.syncMeshInspectSelectHelper();
    return ok;
  }

  private ensureMeshInspectMarker(): Mesh {
    if (this.meshInspectMarker) return this.meshInspectMarker;
    const mesh = withOutline(
      new SphereGeometry(MESH_INSPECT_MARKER_RADIUS, 24, 18),
      comicToon(MESH_INSPECT_MARKER_RED),
      0.0035,
    );
    mesh.name = MESH_INSPECT_MARKER_NAME;
    mesh.frustumCulled = false;
    mesh.renderOrder = 8;
    mesh.traverse((obj) => {
      const child = obj as Mesh;
      if (child.isMesh) child.raycast = () => {};
    });
    this.host.scene.add(mesh);
    this.meshInspectMarker = mesh;
    return mesh;
  }

  private syncMeshInspectMarker(pose: MeshInspectMarkerPose | null): void {
    const marker = this.ensureMeshInspectMarker();
    if (!pose) {
      marker.visible = false;
      return;
    }
    marker.visible = true;
    marker.position.set(pose.x, pose.y, pose.z);
    (marker.material as MeshToonMaterial).color.setHex(
      pose.onRed ? MESH_INSPECT_MARKER_BLUE : MESH_INSPECT_MARKER_RED,
    );
  }

  private hideMeshInspectMarker(): void {
    if (this.meshInspectMarker) this.meshInspectMarker.visible = false;
  }

  private setMeshInspectSelected(obj: Object3D): void {
    rememberMeshInspectHome(obj);
    this.meshInspectSelected = obj;
    this.syncMeshInspectSelectHelper();
  }

  private selectionPoseOrNull(): MeshInspectSelection | null {
    const obj = this.meshInspectSelected;
    const car = this.idleCar;
    if (!obj || !car) return null;
    const space = carMeshSpaceRoot(car);
    const pose = selectionPose(obj, space, meshInspectHitName(obj, car));
    const edge = this.meshInspectEdge;
    if (!edge) return pose;
    edgeWorldEnds(edge, this._edgeA, this._edgeB);
    const mid = this._inspectWorld.copy(this._edgeA).add(this._edgeB).multiplyScalar(0.5);
    space.updateMatrixWorld(true);
    space.worldToLocal(mid);
    return { ...pose, kind: "edge", x: mid.x, y: mid.y, z: mid.z };
  }

  private syncMeshInspectSelectHelper(): void {
    const obj = this.meshInspectSelected;
    if (!obj || !this.meshInspect) {
      this.disposeMeshInspectSelectHelper();
      return;
    }
    if (!this.meshInspectSelectHelper || this.meshInspectSelectHelper.userData.inspectTarget !== obj) {
      this.disposeMeshInspectSelectHelper();
      const helper = new BoxHelper(obj, 0xffe066);
      helper.name = MESH_INSPECT_SELECT_HELPER_NAME;
      helper.userData.inspectTarget = obj;
      helper.raycast = () => {};
      this.host.scene.add(helper);
      this.meshInspectSelectHelper = helper;
    }
    this.meshInspectSelectHelper.update();
    this.meshInspectSelectHelper.visible = true;
    this.syncMeshInspectEdgeHelper();
  }

  private inspectMeshFromPick(id: string): Mesh | null {
    if (!this.idleCar) return null;
    const obj = findObjectByUuid(this.idleCar, id);
    if (!obj) return null;
    if (obj instanceof Mesh && obj.isMesh) return obj;
    let found: Mesh | null = null;
    obj.traverse((child) => {
      if (found || !(child instanceof Mesh) || !child.isMesh) return;
      found = child;
    });
    return found;
  }

  private syncMeshInspectEdgeHelper(): void {
    const edge = this.meshInspectEdge;
    if (!edge || !this.meshInspect) {
      if (this.meshInspectEdgeHelper) this.meshInspectEdgeHelper.visible = false;
      return;
    }
    const line = this.ensureMeshInspectEdgeHelper();
    edgeWorldEnds(edge, this._edgeA, this._edgeB);
    const pos = line.geometry.getAttribute("position");
    pos.setXYZ(0, this._edgeA.x, this._edgeA.y, this._edgeA.z);
    pos.setXYZ(1, this._edgeB.x, this._edgeB.y, this._edgeB.z);
    pos.needsUpdate = true;
    line.visible = true;
  }

  private ensureMeshInspectEdgeHelper(): Line {
    if (this.meshInspectEdgeHelper) return this.meshInspectEdgeHelper;
    const geo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
    const line = new Line(geo, new LineBasicMaterial({ color: 0xff6b35, depthTest: false }));
    line.name = MESH_INSPECT_EDGE_HELPER_NAME;
    line.frustumCulled = false;
    line.renderOrder = 9;
    line.raycast = () => {};
    this.host.scene.add(line);
    this.meshInspectEdgeHelper = line;
    return line;
  }

  private disposeMeshInspectEdgeHelper(): void {
    const line = this.meshInspectEdgeHelper;
    if (!line) return;
    line.removeFromParent();
    line.geometry.dispose();
    (line.material as LineBasicMaterial).dispose();
    this.meshInspectEdgeHelper = null;
  }

  private disposeMeshInspectSelectHelper(): void {
    const helper = this.meshInspectSelectHelper;
    if (!helper) return;
    helper.removeFromParent();
    helper.geometry.dispose();
    const mat = helper.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
    this.meshInspectSelectHelper = null;
  }

  private applyMeshInspectView(): void {
    for (const entry of this.meshInspectHidden) entry.obj.visible = entry.visible;
    this.meshInspectHidden.length = 0;
    if (!this.meshInspect) {
      this.applyEnvironment();
      this.host.scene.fog = this.host.fog;
      return;
    }
    for (const child of this.group.children) {
      if (child === this.idleOrbit) continue;
      this.meshInspectHidden.push({ obj: child, visible: child.visible });
      child.visible = false;
    }
    const blob = this.idleCar?.getObjectByName("carGroundBlob");
    if (blob) {
      this.meshInspectHidden.push({ obj: blob, visible: blob.visible });
      blob.visible = false;
    }
    const { scene, renderer, groundMesh } = this.host;
    groundMesh.visible = false;
    this.host.getSkyMesh().visible = false;
    this.host.getPanoramaGroup().visible = false;
    scene.fog = null;
    const bg = meshInspectBackgroundHex(this.idlePaint);
    scene.background = new Color(bg);
    renderer.setClearColor(bg, 1);
  }

  private frameMeshInspectCamera(): void {
    const car = this.idleCar;
    if (!car) return;
    car.updateMatrixWorld(true);
    const box = carBodyWorldBox(car);
    box.getCenter(this._inspectLook);
    box.getSize(this._inspectSize);
    const radius = Math.max(this._inspectSize.x, this._inspectSize.y, this._inspectSize.z) * 0.5;
    const dist = Math.max(3.5, radius * 2.5);
    const { camera } = this.host;
    camera.position.set(
      this._inspectLook.x + dist * 0.28,
      this._inspectLook.y + Math.max(0.35, radius * 0.35),
      this._inspectLook.z + dist,
    );
    camera.lookAt(this._inspectLook);
  }

  tickIdle(fxTime: number): void {
    this.fxTime = fxTime;
    this.group.visible = true;
    this.applyOrbitPose();
    if (this.meshInspect) {
      this.frameMeshInspectCamera();
      this.syncMeshInspectSelectHelper();
      return;
    }
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
