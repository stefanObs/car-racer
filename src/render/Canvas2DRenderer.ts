import type { RaceSession } from "../sim/race";
import { stageFromHp } from "../sim/damage";
import { ComicPaletteCss } from "./palette";

/** Asphalt-Comic 2D fallback when WebGL is unavailable. */
export class Canvas2DRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private w = 1;
  private h = 1;
  private readonly lastNitro = new Map<string, number>();
  private fxTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Weder WebGL noch Canvas2D verfügbar.");
    this.ctx = ctx;
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderIdle();
  }

  private resize(): void {
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(this.w * Math.min(window.devicePixelRatio, 2));
    this.canvas.height = Math.floor(this.h * Math.min(window.devicePixelRatio, 2));
    this.ctx.setTransform(this.canvas.width / this.w, 0, 0, this.canvas.height / this.h, 0, 0);
  }

  renderIdle(): void {
    const g = this.ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, ComicPaletteCss.sky);
    g.addColorStop(1, "#3d7eae");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.fillStyle = "rgba(27,27,31,0.55)";
    this.ctx.fillRect(this.w * 0.1, this.h * 0.35, this.w * 0.8, 64);
    this.ctx.strokeStyle = ComicPaletteCss.outline;
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(this.w * 0.1, this.h * 0.35, this.w * 0.8, 64);
    this.ctx.fillStyle = "#f4f4f5";
    this.ctx.font = "bold 28px Trebuchet MS, sans-serif";
    this.ctx.fillText("Crash Circuit", this.w * 0.12, this.h * 0.35 + 42);
  }

  buildTrack(_session: RaceSession): void {
    void _session;
    this.lastNitro.clear();
  }

  clearCars(): void {
    this.lastNitro.clear();
  }

  sync(session: RaceSession): void {
    this.fxTime += 1 / 60;
    const player = session.player();
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, ComicPaletteCss.sky);
    sky.addColorStop(0.55, "#3d7eae");
    sky.addColorStop(1, "#2d6a3a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.w, this.h);

    const scale = 4.2;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const ang = -player.heading;

    const worldToScreen = (x: number, z: number): { sx: number; sy: number } => {
      const dx = x - player.x;
      const dz = z - player.z;
      const rx = dx * Math.cos(ang) - dz * Math.sin(ang);
      const rz = dx * Math.sin(ang) + dz * Math.cos(ang);
      return { sx: cx + rx * scale, sy: cy + rz * scale };
    };

    const track = session.track;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const drawRibbon = (halfWidth: number, color: string): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = halfWidth * 2 * scale;
      ctx.beginPath();
      for (let i = 0; i < track.centerline.length; i++) {
        const p = track.centerline[i]!;
        const s = worldToScreen(p.x, p.z);
        if (i === 0) ctx.moveTo(s.sx, s.sy);
        else ctx.lineTo(s.sx, s.sy);
      }
      ctx.stroke();
    };

    drawRibbon(track.asphaltHalfWidth + track.grassWidth + 0.9, ComicPaletteCss.concrete);
    drawRibbon(track.asphaltHalfWidth + track.grassWidth, ComicPaletteCss.grass);
    drawRibbon(track.asphaltHalfWidth + 0.2, ComicPaletteCss.curbDark);
    drawRibbon(track.asphaltHalfWidth, ComicPaletteCss.asphalt);

    // Center dashes
    ctx.strokeStyle = ComicPaletteCss.asphaltLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    for (let i = 0; i < track.centerline.length; i++) {
      const p = track.centerline[i]!;
      const s = worldToScreen(p.x, p.z);
      if (i === 0) ctx.moveTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Tire / concrete wall markers
    for (let i = 0; i < track.centerline.length - 1; i += 3) {
      const a = track.centerline[i]!;
      const b = track.centerline[i + 1]!;
      const angle = Math.atan2(b.z - a.z, b.x - a.x);
      const wallOff = track.asphaltHalfWidth + track.grassWidth + 0.55;
      const kind = track.wallKind[i] ?? "concrete";
      for (const side of [-1, 1] as const) {
        const px = a.x + Math.sin(angle) * wallOff * side;
        const pz = a.z - Math.cos(angle) * wallOff * side;
        const s = worldToScreen(px, pz);
        if (kind === "tire") {
          ctx.fillStyle = ComicPaletteCss.tire;
          ctx.strokeStyle = ComicPaletteCss.tireAccent;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.sx, s.sy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = ComicPaletteCss.concrete;
          ctx.strokeStyle = ComicPaletteCss.outline;
          ctx.lineWidth = 2;
          ctx.fillRect(s.sx - 4, s.sy - 6, 8, 12);
          ctx.strokeRect(s.sx - 4, s.sy - 6, 8, 12);
        }
      }
    }

    for (const car of session.cars) {
      if (car.koTimer > 0 && car.hp <= 0 && Math.sin(car.koTimer * 20) <= 0) continue;
      const s = worldToScreen(car.x, car.z);
      const stage = stageFromHp(car.hp);
      const prev = this.lastNitro.get(car.id) ?? car.nitro;
      const boosting = car.nitro < prev - 0.001;
      this.lastNitro.set(car.id, car.nitro);

      ctx.save();
      ctx.translate(s.sx, s.sy);
      ctx.rotate(car.heading - player.heading);

      if (boosting) {
        ctx.fillStyle = ComicPaletteCss.nitroOrange;
        ctx.fillRect(-3, 12, 6, 10);
        ctx.fillStyle = ComicPaletteCss.nitroCyan;
        ctx.fillRect(-2, 18, 4, 8);
      }
      if (stage >= 1 && stage < 4) {
        ctx.fillStyle = ComicPaletteCss.smoke;
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < stage + 1; i++) {
          const t = this.fxTime * 2 + i;
          ctx.beginPath();
          ctx.arc(Math.sin(t) * 3, -8 - (t % 1) * 10 - i * 3, 4 + i, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (car.healFx > 0.25) {
        ctx.fillStyle = ComicPaletteCss.repairSpark;
        for (let i = 0; i < 4; i++) {
          const t = this.fxTime * 8 + i;
          ctx.fillRect(Math.cos(t) * 8 - 2, Math.sin(t * 1.3) * 8 - 2, 4, 4);
        }
      }

      // Comic car silhouette (readable at chase-map scale)
      ctx.fillStyle = car.paint;
      ctx.strokeStyle = ComicPaletteCss.outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, 12);
      ctx.lineTo(-8, -5);
      ctx.lineTo(-5, -14);
      ctx.lineTo(5, -14);
      ctx.lineTo(8, -5);
      ctx.lineTo(8, 12);
      ctx.lineTo(5, 14);
      ctx.lineTo(-5, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ComicPaletteCss.outline;
      ctx.fillRect(-5.5, -5, 11, 7);
      if (car.sticker && car.sticker !== "none") {
        ctx.fillStyle =
          car.sticker === "flames"
            ? ComicPaletteCss.nitroOrange
            : car.sticker === "bolt"
              ? ComicPaletteCss.repairSpark
              : ComicPaletteCss.nitroCyan;
        ctx.fillRect(6, -3, 3.5, 10);
      }
      ctx.restore();
    }

    ctx.fillStyle = "rgba(27,27,31,0.65)";
    ctx.strokeStyle = ComicPaletteCss.outline;
    ctx.lineWidth = 2;
    ctx.fillRect(12, 12, 168, 30);
    ctx.strokeRect(12, 12, 168, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "14px Trebuchet MS, sans-serif";
    ctx.fillText(`2D-Modus · Platz ${player.place}`, 20, 32);
  }
}
