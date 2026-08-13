/**
 * Asphalt-Comic 2D “movies” after the finish line.
 * Podium (1–3): ~15s distinct reels. Field: short disappointed driver beat.
 */

export const PODIUM_MOVIE_SECONDS = 15;
export const FIELD_MOVIE_SECONDS = 5;

export type PodiumMovieKind = "gold" | "silver" | "bronze" | "field";

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

/** Comic driver silhouette (SVG) — pose via CSS classes on the wrapper. */
function driverSvg(): string {
  return `
<svg class="pm-driver__svg" viewBox="0 0 120 140" aria-hidden="true">
  <ellipse cx="60" cy="128" rx="28" ry="6" fill="#1b1b1f" opacity="0.35"/>
  <path class="pm-driver__legs" d="M42 88 L38 122 H52 L58 92 Z M78 88 L82 122 H68 L62 92 Z" fill="#2b2f38" stroke="#1b1b1f" stroke-width="3"/>
  <path class="pm-driver__boots" d="M34 118 H54 L52 128 H32 Z M86 118 H66 L68 128 H88 Z" fill="#e03131" stroke="#1b1b1f" stroke-width="2.5"/>
  <rect class="pm-driver__torso" x="40" y="52" width="40" height="42" rx="10" fill="#e03131" stroke="#1b1b1f" stroke-width="3"/>
  <path class="pm-driver__arms" d="M40 58 L22 78 L28 84 L44 68 Z M80 58 L98 78 L92 84 L76 68 Z" fill="#f4a261" stroke="#1b1b1f" stroke-width="3"/>
  <circle class="pm-driver__head" cx="60" cy="36" r="18" fill="#f4a261" stroke="#1b1b1f" stroke-width="3"/>
  <path class="pm-driver__helmet" d="M42 34 Q60 12 78 34 L74 42 Q60 28 46 42 Z" fill="#3db9c7" stroke="#1b1b1f" stroke-width="3"/>
  <path class="pm-driver__visor" d="M48 36 H72 V42 H48 Z" fill="#1b1b1f"/>
  <circle class="pm-driver__eye-l" cx="54" cy="38" r="2.2" fill="#1b1b1f"/>
  <circle class="pm-driver__eye-r" cx="66" cy="38" r="2.2" fill="#1b1b1f"/>
  <path class="pm-driver__mouth" d="M54 46 Q60 52 66 46" fill="none" stroke="#1b1b1f" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;
}

function podiumBlocks(highlight: 1 | 2 | 3): string {
  return `
<div class="pm-stands" aria-hidden="true">
  <div class="pm-stand pm-stand--2${highlight === 2 ? " pm-stand--lit" : ""}"><span>2</span></div>
  <div class="pm-stand pm-stand--1${highlight === 1 ? " pm-stand--lit" : ""}"><span>1</span></div>
  <div class="pm-stand pm-stand--3${highlight === 3 ? " pm-stand--lit" : ""}"><span>3</span></div>
</div>`;
}

function confettiBits(count: number): string {
  return Array.from({ length: count }, (_, i) => {
    const left = 4 + ((i * 37) % 92);
    const delay = ((i * 0.17) % 2.4).toFixed(2);
    const hue = i % 3 === 0 ? "gold" : i % 3 === 1 ? "cyan" : "red";
    return `<i class="pm-confetti pm-confetti--${hue}" style="--x:${left}%;--d:${delay}s"></i>`;
  }).join("");
}

function trophyProp(): string {
  return `<div class="pm-prop pm-prop--trophy" aria-hidden="true">🏆</div>`;
}

function medalProp(kind: "silver" | "bronze"): string {
  const label = kind === "silver" ? "2" : "3";
  return `<div class="pm-prop pm-prop--medal pm-prop--${kind}" aria-hidden="true"><span>${label}</span></div>`;
}

function sceneCards(kind: PodiumMovieKind): string {
  if (kind === "gold") {
    return `
      <div class="pm-scene pm-scene--a" data-dev-name="movie.scene.a">
        ${podiumBlocks(1)}
        <div class="pm-driver pm-driver--cheer">${driverSvg()}</div>
        ${trophyProp()}
        ${confettiBits(18)}
      </div>
      <div class="pm-scene pm-scene--b" data-dev-name="movie.scene.b">
        <div class="pm-banner pm-banner--check"></div>
        <div class="pm-driver pm-driver--lift">${driverSvg()}</div>
        ${trophyProp()}
        ${confettiBits(22)}
      </div>
      <div class="pm-scene pm-scene--c" data-dev-name="movie.scene.c">
        <div class="pm-starburst" aria-hidden="true"></div>
        <div class="pm-driver pm-driver--cheer">${driverSvg()}</div>
        <p class="pm-endcard">Nr. 1</p>
      </div>`;
  }
  if (kind === "silver") {
    return `
      <div class="pm-scene pm-scene--a" data-dev-name="movie.scene.a">
        ${podiumBlocks(2)}
        <div class="pm-driver pm-driver--wave">${driverSvg()}</div>
        ${medalProp("silver")}
        ${confettiBits(12)}
      </div>
      <div class="pm-scene pm-scene--b" data-dev-name="movie.scene.b">
        <div class="pm-glance" aria-hidden="true">1</div>
        <div class="pm-driver pm-driver--proud">${driverSvg()}</div>
        ${medalProp("silver")}
      </div>
      <div class="pm-scene pm-scene--c" data-dev-name="movie.scene.c">
        <div class="pm-driver pm-driver--wave">${driverSvg()}</div>
        <p class="pm-endcard">Stark!</p>
      </div>`;
  }
  if (kind === "bronze") {
    return `
      <div class="pm-scene pm-scene--a" data-dev-name="movie.scene.a">
        ${podiumBlocks(3)}
        <div class="pm-driver pm-driver--fist">${driverSvg()}</div>
        ${medalProp("bronze")}
        ${confettiBits(10)}
      </div>
      <div class="pm-scene pm-scene--b" data-dev-name="movie.scene.b">
        <div class="pm-driver pm-driver--relieved">${driverSvg()}</div>
        ${medalProp("bronze")}
      </div>
      <div class="pm-scene pm-scene--c" data-dev-name="movie.scene.c">
        <div class="pm-driver pm-driver--fist">${driverSvg()}</div>
        <p class="pm-endcard">Podest!</p>
      </div>`;
  }
  return `
    <div class="pm-scene pm-scene--sad" data-dev-name="movie.scene.sad">
      <div class="pm-stands pm-stands--dim" aria-hidden="true">
        <div class="pm-stand pm-stand--2"><span>2</span></div>
        <div class="pm-stand pm-stand--1"><span>1</span></div>
        <div class="pm-stand pm-stand--3"><span>3</span></div>
      </div>
      <div class="pm-driver pm-driver--sad">${driverSvg()}</div>
      <div class="pm-sweat" aria-hidden="true"></div>
      <p class="pm-endcard pm-endcard--sad">Weiter üben!</p>
    </div>`;
}

/** Full-bleed 2D comic reel HTML for the finish overlay. */
export function podiumMovieHtml(place: number): string {
  const kind = podiumMovieKind(place);
  const title = podiumMovieTitle(place);
  const sub = podiumMovieSub(place);
  const duration = podiumMovieDuration(place);
  return `
    <div
      class="podium-movie podium-movie--${kind}"
      data-dev-name="finish.movie"
      data-place="${place}"
      data-kind="${kind}"
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
