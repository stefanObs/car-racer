import {
  defaultFlyCamera,
  snapshotTrackEditor,
  trackEditorDocFromLevel,
  TRACK_EDITOR_DEFAULT_LEVEL_ID,
  type FlyCamera,
  type TrackEditorDoc,
} from "../core/trackEditor";
import { CUP_LEVELS, asTrainingLevel, levelById } from "../data/levels";
import type { SaveData } from "../meta/save";
import type { GameRenderer } from "../render/createGameRenderer";
import { sampleCenterline } from "../track/buildTrack";
import type { BuiltTrack, LevelDefinition } from "../track/types";
import { createRaceSession, mountRace, teardownRace } from "./raceFlow";

export function trackEditorLevel(id: string | undefined): LevelDefinition {
  return levelById(id ?? TRACK_EDITOR_DEFAULT_LEVEL_ID) ?? CUP_LEVELS[0]!;
}

export function flyCameraForTrack(track: BuiltTrack): FlyCamera {
  const start = sampleCenterline(track, 0);
  const heading = Math.atan2(start.tangent.z, start.tangent.x);
  return defaultFlyCamera(start.position, heading);
}

export async function beginTrackEditor(
  renderer: GameRenderer,
  save: SaveData,
  level: LevelDefinition,
  stylePops: { clear(): void },
): Promise<{ session: ReturnType<typeof createRaceSession>; doc: TrackEditorDoc; snap: TrackEditorDoc; fly: FlyCamera }> {
  renderer.exitTrackEditor();
  teardownRace(renderer, stylePops);
  const session = createRaceSession(save, asTrainingLevel(level));
  await mountRace(renderer, session);
  const doc = trackEditorDocFromLevel(level);
  const snap = snapshotTrackEditor(doc);
  const fly = flyCameraForTrack(session.track);
  renderer.enterTrackEditor(doc, fly);
  return { session, doc, snap, fly };
}

export function endTrackEditor(renderer: GameRenderer, stylePops: { clear(): void }): void {
  renderer.exitTrackEditor();
  teardownRace(renderer, stylePops);
}

export function trackEditorTrackOptions(): { id: string; displayName: string }[] {
  return CUP_LEVELS.map((l) => ({ id: l.id, displayName: l.displayName }));
}
