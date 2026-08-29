import {
  BoxHelper,
  Group,
  Mesh,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  type Object3D,
  type WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  flyLookTarget,
  TRACK_EDITOR_GAUGE_KIND,
  type FlyCamera,
  type TrackEditorDoc,
  type TrackEditorPlacement,
} from "../core/trackEditor";
import { gaugeBoxSize, isTrackEditorPlaceKind } from "../data/trackEditorCatalog";
import type { TrackPropId } from "../data/trackModels";
import { comicToon, disposeObject, withOutline } from "./comicMaterials";
import { instanceTrackProp } from "./trackKit";
import { applyHorizonHeight, applyPanoramaKind, type PanoramaKind } from "./panoramaSurround";
import { themeLook } from "./themeLook";

export const TRACK_EDITOR_OVERLAY_NAME = "trackEditorOverlay";
export const TRACK_EDITOR_SELECT_HELPER_NAME = "trackEditorSelect";

export type TrackEditorPick =
  | { kind: "prop"; id: string }
  | { kind: "ground"; x: number; z: number }
  | { kind: "miss" };

type Hooks = {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  getScenery: () => Group;
  getPanorama: () => Group;
  hideCars: (hidden: boolean) => void;
};

const _ray = new Raycaster();
const _ndc = new Vector2();
const _hit = new Vector3();
const _ground = new Plane(new Vector3(0, 1, 0), 0);

export class TrackEditorPresenter {
  private readonly overlay = new Group();
  private selectHelper: BoxHelper | null = null;
  private active = false;
  private readonly meshes = new Map<string, Group>();
  private readonly hooks: Hooks;

  constructor(hooks: Hooks) {
    this.hooks = hooks;
    this.overlay.name = TRACK_EDITOR_OVERLAY_NAME;
  }

  isActive(): boolean {
    return this.active;
  }

  enter(doc: TrackEditorDoc, fly: FlyCamera, levelTheme: string): void {
    this.active = true;
    if (!this.overlay.parent) this.hooks.scene.add(this.overlay);
    this.hooks.hideCars(true);
    this.syncDoc(doc);
    this.applyFly(fly);
    this.applyPanorama(doc.panoramaKind, doc.panoramaOffsetY, doc.panoramaHeightScale, levelTheme);
    this.setHideScenery(doc.hideScenery);
  }

  exit(): void {
    this.active = false;
    this.clearMeshes();
    this.overlay.removeFromParent();
    this.hooks.hideCars(false);
    this.hooks.getScenery().visible = true;
    this.applyPanorama("harbor", 0, 1, "harbor");
  }

  syncDoc(doc: TrackEditorDoc): void {
    const keep = new Set(doc.placements.map((p) => p.id));
    for (const [id, mesh] of [...this.meshes.entries()]) {
      if (keep.has(id)) continue;
      this.overlay.remove(mesh);
      disposeObject(mesh);
      this.meshes.delete(id);
    }
    for (const p of doc.placements) {
      let mesh = this.meshes.get(p.id);
      if (!mesh || mesh.userData.trackEditorKind !== p.kind) {
        if (mesh) {
          this.overlay.remove(mesh);
          disposeObject(mesh);
        }
        mesh = this.makeProp(p);
        this.meshes.set(p.id, mesh);
        this.overlay.add(mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.yaw;
    }
    this.syncSelection(doc.selectedId);
    this.selectHelper?.update();
  }

  applyFly(cam: FlyCamera): void {
    this.hooks.camera.position.set(cam.x, cam.y, cam.z);
    const t = flyLookTarget(cam);
    this.hooks.camera.lookAt(t.x, t.y, t.z);
  }

  applyPanorama(
    kind: string,
    offsetY: number,
    heightScale: number,
    levelTheme: string,
  ): void {
    const look = themeLook(levelTheme);
    applyPanoramaKind(this.hooks.getPanorama(), kind as PanoramaKind, look);
    applyHorizonHeight(this.hooks.getPanorama(), offsetY, heightScale);
  }

  setHideScenery(hide: boolean): void {
    this.hooks.getScenery().visible = !hide;
  }

  render(): void {
    this.hooks.renderer.render(this.hooks.scene, this.hooks.camera);
  }

  pick(clientX: number, clientY: number, canvas: HTMLCanvasElement): TrackEditorPick {
    this.setRay(clientX, clientY, canvas);
    const hits = _ray.intersectObject(this.overlay, true);
    for (const hit of hits) {
      const id = editorIdOf(hit.object);
      if (id) return { kind: "prop", id };
    }
    const ground = this.groundAtRay();
    if (ground) return { kind: "ground", x: ground.x, z: ground.z };
    return { kind: "miss" };
  }

  groundAt(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; z: number } | null {
    this.setRay(clientX, clientY, canvas);
    return this.groundAtRay();
  }

  private groundAtRay(): { x: number; z: number } | null {
    const ok = _ray.ray.intersectPlane(_ground, _hit);
    if (!ok) return null;
    return { x: _hit.x, z: _hit.z };
  }

  private setRay(clientX: number, clientY: number, canvas: HTMLCanvasElement): void {
    const r = canvas.getBoundingClientRect();
    _ndc.set(((clientX - r.left) / Math.max(r.width, 1)) * 2 - 1, -((clientY - r.top) / Math.max(r.height, 1)) * 2 + 1);
    this.hooks.camera.updateMatrixWorld(true);
    _ray.setFromCamera(_ndc, this.hooks.camera);
  }

  private syncSelection(id: string | null): void {
    this.selectHelper?.removeFromParent();
    this.selectHelper = null;
    if (!id) return;
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    const helper = new BoxHelper(mesh, 0xffe066);
    helper.name = TRACK_EDITOR_SELECT_HELPER_NAME;
    helper.userData.trackEditorId = id;
    this.overlay.add(helper);
    this.selectHelper = helper;
  }

  private makeProp(p: TrackEditorPlacement): Group {
    const wrap = new Group();
    wrap.name = `editor-${p.kind}-${p.id}`;
    wrap.userData.trackEditorId = p.id;
    wrap.userData.trackEditorKind = p.kind;
    if (p.kind === TRACK_EDITOR_GAUGE_KIND) {
      wrap.add(makeGaugeMesh());
      return wrap;
    }
    if (isTrackEditorPlaceKind(p.kind) && p.kind !== TRACK_EDITOR_GAUGE_KIND) {
      const kit = instanceTrackProp(p.kind as TrackPropId, 0, 0, 0);
      if (kit) {
        stampEditorId(kit, p.id);
        wrap.add(kit);
        return wrap;
      }
    }
    wrap.add(makePlaceholderMesh());
    return wrap;
  }

  private clearMeshes(): void {
    for (const mesh of this.meshes.values()) {
      this.overlay.remove(mesh);
      disposeObject(mesh);
    }
    this.meshes.clear();
    this.selectHelper?.removeFromParent();
    this.selectHelper = null;
  }
}

function stampEditorId(root: Object3D, id: string): void {
  root.traverse((obj) => {
    obj.userData.trackEditorId = id;
  });
}

function editorIdOf(obj: Object3D): string | null {
  let cur: Object3D | null = obj;
  while (cur) {
    const id = cur.userData.trackEditorId;
    if (typeof id === "string") return id;
    cur = cur.parent;
  }
  return null;
}

function makeGaugeMesh(): Mesh {
  const { width, height, depth } = gaugeBoxSize();
  const mesh = withOutline(new RoundedBoxGeometry(width, height, depth, 2, 0.06), comicToon(0xffe066), 0.04);
  mesh.position.y = height / 2;
  mesh.userData.trackEditorKind = TRACK_EDITOR_GAUGE_KIND;
  return mesh;
}

function makePlaceholderMesh(): Mesh {
  const mesh = withOutline(new RoundedBoxGeometry(2, 2, 2, 2, 0.08), comicToon(0xe03131), 0.05);
  mesh.position.y = 1;
  return mesh;
}
