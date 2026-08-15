/**
 * Asphalt-Comic 2D “movies” after the finish line.
 * Painted track/podium panels (not stick-figure SVG). Podium 1–3: ~15s reels. Field: short beat.
 */

export const PODIUM_MOVIE_SECONDS = 15;
export const FIELD_MOVIE_SECONDS = 5;

export type PodiumMovieKind = "gold" | "silver" | "bronze" | "field";

export const RESULT_MOVIE_DIR = "/ui/result-movies";

export const RESULT_MOVIE_PANELS: Record<PodiumMovieKind, readonly string[]> = {
  gold: [
    `${RESULT_MOVIE_DIR}/gold-podium.jpg`,
    `${RESULT_MOVIE_DIR}/gold-finish.jpg`,
    `${RESULT_MOVIE_DIR}/gold-end.jpg`,
  ],
  silver: [
    `${RESULT_MOVIE_DIR}/silver-podium.jpg`,
    `${RESULT_MOVIE_DIR}/silver-proud.jpg`,
    `${RESULT_MOVIE_DIR}/silver-end.jpg`,
  ],
  bronze: [
    `${RESULT_MOVIE_DIR}/bronze-podium.jpg`,
    `${RESULT_MOVIE_DIR}/bronze-relief.jpg`,
    `${RESULT_MOVIE_DIR}/bronze-end.jpg`,
  ],
  field: [`${RESULT_MOVIE_DIR}/field-sad.jpg`],
};

export function podiumMovieKind(place: number): PodiumMovieKind {
  if (place === 1) return "gold";
  if (place === 2) return "silver";
  if (place === 3) return "bronze";
  return "field";
}

export function podiumMovieDuration(place: number): number {
  return podiumMovieKind(place) === "field" ? FIELD_MOVIE_SECONDS : PODIUM_MOVIE_SECONDS;
}

export function podiumMovieTitle(place: number): string {
  if (place === 1) return "SIEGER!";
  if (place === 2) return "SILBER!";
  if (place === 3) return "BRONZE!";
  return "SCHADE!";
}

export function podiumMovieSub(place: number): string {
  if (place === 1) return "Platz 1 — ganz oben!";
  if (place === 2) return "Platz 2 — stark gefahren!";
  if (place === 3) return "Platz 3 — Podest geschafft!";
  return `Platz ${place} — nächstes Mal!`;
}

export function podiumMovieHeroSrc(place: number): string {
  return RESULT_MOVIE_PANELS[podiumMovieKind(place)][0]!;
}

function confettiBits(count: number): string {
  return Array.from({ length: count }, (_, i) => {
    const left = 4 + ((i * 37) % 92);
    const delay = ((i * 0.17) % 2.4).toFixed(2);
    const hue = i % 3 === 0 ? "gold" : i % 3 === 1 ? "cyan" : "red";
    return `<i class="pm-confetti pm-confetti--${hue}" style="--x:${left}%;--d:${delay}s"></i>`;
  }).join("");
}

function artScene(
  src: string,
  scene: "a" | "b" | "c" | "sad",
  extras = "",
): string {
  return `
      <div class="pm-scene pm-scene--${scene}" data-dev-name="movie.scene.${scene}">
        <img class="pm-art pm-art--${scene}" src="${src}" alt="" />
        ${extras}
      </div>`;
}

function sceneCards(kind: PodiumMovieKind): string {
  const panels = RESULT_MOVIE_PANELS[kind];
  if (kind === "gold") {
    return `
      ${artScene(panels[0]!, "a", `${confettiBits(16)}<span class="pm-prop pm-prop--trophy" hidden></span>`)}
      ${artScene(panels[1]!, "b", `${confettiBits(10)}<div class="pm-speedlines" aria-hidden="true"></div>`)}
      ${artScene(panels[2]!, "c", `<p class="pm-endcard">Nr. 1</p>`)}`;
  }
  if (kind === "silver") {
    return `
      ${artScene(panels[0]!, "a", `<span class="pm-prop pm-prop--silver" hidden></span>`)}
      ${artScene(panels[1]!, "b")}
      ${artScene(panels[2]!, "c", `<p class="pm-endcard">Stark!</p>`)}`;
  }
  if (kind === "bronze") {
    return `
      ${artScene(panels[0]!, "a", `<span class="pm-prop pm-prop--bronze" hidden></span>`)}
      ${artScene(panels[1]!, "b")}
      ${artScene(panels[2]!, "c", `<p class="pm-endcard">Podest!</p>`)}`;
  }
  return artScene(panels[0]!, "sad", `<p class="pm-endcard pm-endcard--sad">Weiter üben!</p>`);
}

/** Full-bleed 2D comic reel HTML for the finish overlay. */
export function podiumMovieHtml(place: number): string {
  const kind = podiumMovieKind(place);
  const title = podiumMovieTitle(place);
  const sub = podiumMovieSub(place);
  const duration = podiumMovieDuration(place);
  const pose = kind === "gold" ? "cheer" : kind === "silver" ? "wave" : kind === "bronze" ? "fist" : "sad";
  return `
    <div
      class="podium-movie podium-movie--${kind} podium-movie--painted"
      data-dev-name="finish.movie"
      data-place="${place}"
      data-kind="${kind}"
      data-pose="${pose}"
      style="--movie-s:${duration}"
      role="img"
      aria-label="${title} ${sub}"
    >
      <div class="podium-movie__frame">
        <div class="podium-movie__reel">
          ${sceneCards(kind)}
        </div>
        <div class="podium-movie__caption">
          <p class="podium-movie__title">${title}</p>
          <p class="podium-movie__sub">${sub}</p>
        </div>
        <div class="podium-movie__bar" aria-hidden="true"><i></i></div>
      </div>
    </div>`;
}
