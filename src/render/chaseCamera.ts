/** Pure chase-camera projection for Asphalt-Comic (concept: rear elevated chase). */

export type ChasePose = {
  x: number;
  z: number;
  heading: number;
};

export type ChaseCameraParams = {
  /** Distance behind the car along heading. */
  back: number;
  /** Camera height above ground. */
  height: number;
  /** Perspective focal length in pixels at reference height. */
  focal: number;
  /** Screen horizon Y (vanishing line). */
  horizonY: number;
  centerX: number;
  near: number;
};

export type ProjectedPoint = {
  sx: number;
  sy: number;
  depth: number;
  scale: number;
};

export function chaseBasis(heading: number): { fwdX: number; fwdZ: number; rightX: number; rightZ: number } {
  const fwdX = Math.cos(heading);
  const fwdZ = Math.sin(heading);
  return { fwdX, fwdZ, rightX: -fwdZ, rightZ: fwdX };
}

export function projectWorldPoint(
  wx: number,
  wy: number,
  wz: number,
  pose: ChasePose,
  cam: ChaseCameraParams,
): ProjectedPoint | null {
  const { fwdX, fwdZ, rightX, rightZ } = chaseBasis(pose.heading);
  const camX = pose.x - fwdX * cam.back;
  const camZ = pose.z - fwdZ * cam.back;
  const dx = wx - camX;
  const dy = wy - cam.height;
  const dz = wz - camZ;
  const localR = dx * rightX + dz * rightZ;
  const localF = dx * fwdX + dz * fwdZ;
  if (localF < cam.near) return null;
  const scale = cam.focal / localF;
  return {
    sx: cam.centerX + localR * scale,
    sy: cam.horizonY - dy * scale,
    depth: localF,
    scale,
  };
}

export function edgePoint(
  cx: number,
  cz: number,
  tx: number,
  tz: number,
  lateral: number,
): { x: number; z: number } {
  const len = Math.hypot(tx, tz) || 1;
  const rx = -tz / len;
  const rz = tx / len;
  return { x: cx + rx * lateral, z: cz + rz * lateral };
}
