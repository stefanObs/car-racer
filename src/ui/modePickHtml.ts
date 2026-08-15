import type { LevelDefinition } from "../track/types";
import { renderTrackPlanSvg } from "./trackPlan";

function trackPickButton(
  level: LevelDefinition,
  opts?: { locked?: boolean; stars?: number },
): string {
  const locked = Boolean(opts?.locked);
  const stars = opts?.stars;
  const starHtml =
    stars == null ? "" : `<span class="track-pick__stars">${"★".repeat(stars)}</span>`;
  const title =
    level.cupIndex != null ? `${level.cupIndex}. ${level.displayName}` : level.displayName;
  return `<button data-nav data-act="race" data-level="${level.id}" class="track-pick" ${locked ? "disabled" : ""}>
          ${renderTrackPlanSvg(level, 132)}
          <span class="track-pick__meta">
            <strong>${title}</strong>
            <span class="dim">${locked ? "Gesperrt" : level.description}</span>
            ${starHtml}
          </span>
        </button>`;
}

export function renderCupPickHtml(
  levels: readonly LevelDefinition[],
  cupIndexUnlocked: number,
  cupStars: Record<string, number>,
): string {
  const rows = levels
    .map((l) =>
      trackPickButton(l, {
        locked: (l.cupIndex ?? 99) > cupIndexUnlocked,
        stars: cupStars[l.id] ?? 0,
      }),
    )
    .join("");
  return `<h2>Blitz-Cup</h2><div class="stack track-pick-list">${rows}</div><button data-nav data-act="garage">Garage</button>`;
}

export function renderFreePickHtml(levels: readonly LevelDefinition[]): string {
  const rows = levels.map((l) => trackPickButton(l)).join("");
  return `<h2>Freier Modus</h2><div class="stack track-pick-list">${rows || "<p>Noch keine Strecken freigeschaltet.</p>"}</div><button data-nav data-act="garage">Garage</button>`;
}

export function renderTrainingPickHtml(levels: readonly LevelDefinition[]): string {
  const rows = levels.map((l) => trackPickButton(l)).join("");
  return `<h2>Training</h2><p class="tag">Alle Strecken, allein — ohne Platzierung.</p><div class="stack track-pick-list">${rows}</div><button data-nav data-act="garage">Garage</button>`;
}
