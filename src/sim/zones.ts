import type { BuiltTrack } from "../track/types";
import { nearestOnTrack, unevenIntensityAt } from "../track/buildTrack";
import { CORRIDOR_ALONG_WINDOW_M } from "../track/layoutRules";

export type SurfaceZone = "asphalt" | "grass" | "wall";

export function surfaceAt(
  track: BuiltTrack,
  x: number,
  z: number,
  grassMitigation: number,
  suspension: number,
  preferAlong?: number,
): {
  zone: SurfaceZone;
  speedFactor: number;
  gripFactor: number;
  wallKind: "tire" | "concrete";
  bump: number;
  lateral: number;
  distanceAlong: number;
  tangent: { x: number; z: number };
} {
  const near = nearestOnTrack(
    track,
    { x, z },
    preferAlong === undefined
      ? undefined
      : { preferAlong, maxAlongGap: CORRIDOR_ALONG_WINDOW_M },
  );
  const absLat = Math.abs(near.lateral);
  const asphaltEdge = track.asphaltHalfWidth;
  const grassEdge = asphaltEdge + track.grassWidth;

  let zone: SurfaceZone = "asphalt";
  let speedFactor = 1;
  let gripFactor = 1;

  if (absLat > grassEdge) {
    zone = "wall";
    speedFactor = near.wall === "tire" ? 0.35 : 0.15;
    gripFactor = 0.4;
  } else if (absLat > asphaltEdge) {
    zone = "grass";
    const baseSlow = 0.62;
    const mitigated = baseSlow + (1 - baseSlow) * Math.min(0.55, grassMitigation + (suspension - 1) * 0.15);
    // suspension reduces but never removes — cap mitigation so factor stays < 1
    speedFactor = Math.min(0.92, mitigated);
    gripFactor = 0.75 + grassMitigation * 0.1;
  }

  const uneven = unevenIntensityAt(track, near.distanceAlong);
  const bump = uneven * Math.max(0.15, 1.1 - suspension);

  return {
    zone,
    speedFactor,
    gripFactor,
    wallKind: near.wall,
    bump,
    lateral: near.lateral,
    distanceAlong: near.distanceAlong,
    tangent: near.tangent,
  };
}
