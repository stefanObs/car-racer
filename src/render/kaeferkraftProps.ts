/**
 * Extra comic props for Käferkraft GLB — free mesh has a column hub but no wheel rim.
 */
import { CylinderGeometry, Group, Mesh, Object3D, TorusGeometry } from "three";
import { comicToon } from "./comicMaterials";

function buildWheelMesh(): Group {
  const g = new Group();
  g.name = "kaeferkraftSteeringWheel";
  const dark = comicToon(0x1a1a1a);
  dark.name = "Dark";

  const rim = new Mesh(new TorusGeometry(0.2, 0.028, 8, 24), dark);
  // Face the driver (+X); nose of car is −X
  rim.rotation.y = Math.PI / 2;

  const hub = new Mesh(new CylinderGeometry(0.05, 0.055, 0.06, 10), dark);
  hub.rotation.z = Math.PI / 2;

  g.add(rim, hub);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    const spoke = new Mesh(new CylinderGeometry(0.014, 0.014, 0.32, 6), dark);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.x = a;
    g.add(spoke);
  }
  return g;
}

/**
 * Place a black steering wheel in the cockpit.
 * Fixed local pose (source column hub) — more reliable than hunting meshes after normalize.
 */
export function attachKaeferkraftSteeringWheel(root: Object3D): void {
  if (root.getObjectByName("kaeferkraftSteeringWheel")) return;
  const wheel = buildWheelMesh();
  // Toward driver seat (z≈−0.25), above floor pan, on the column line
  wheel.position.set(-0.1, 0.28, -0.12);
  root.add(wheel);
}

export function buildKaeferkraftSteeringWheel(): Group {
  const g = buildWheelMesh();
  g.position.set(-0.1, 0.28, -0.12);
  return g;
}
