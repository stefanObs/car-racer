import type { RaceSession } from "../sim/race";
import { sampleCenterline } from "../track/buildTrack";

/** Minimal 2D fallback when WebGL is unavailable (VMs, locked-down GPUs). */
export class Canvas2DRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
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
    g.addColorStop(0, "#5ba3d9");
    g.addColorStop(1, "#3d7eae");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.ctx.fillStyle = "rgba(27,27,31,0.55)";
    this.ctx.fillRect(this.w * 0.1, this.h * 0.35, this.w * 0.8, 64);
    this.ctx.fillStyle = "#f4f4f5";
    this.ctx.font = "bold 28px Trebuchet MS, sans-serif";
    this.ctx.fillText("Crash Circuit", this.w * 0.12, this.h * 0.35 + 42);
  }

  buildTrack(_session: RaceSession): void {
    void _session;
  }

  clearCars(): void {
    /* no persistent meshes */
  }

  sync(session: RaceSession): void {
    const player = session.player();
    const ctx = this.ctx;
    ctx.fillStyle = "#5ba3d9";
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

    // Track ribbon
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

    drawRibbon(track.asphaltHalfWidth + track.grassWidth, "#3f8f3a");
    drawRibbon(track.asphaltHalfWidth, "#4a4f57");

    // Cars
    for (const car of session.cars) {
      if (car.koTimer > 0 && car.hp <= 0 && Math.sin(car.koTimer * 20) <= 0) continue;
      const s = worldToScreen(car.x, car.z);
      ctx.save();
      ctx.translate(s.sx, s.sy);
      ctx.rotate(car.heading - player.heading);
      ctx.fillStyle = car.paint;
      ctx.fillRect(-6, -10, 12, 20);
      ctx.strokeStyle = "#1b1b1f";
      ctx.lineWidth = 2;
      ctx.strokeRect(-6, -10, 12, 20);
      ctx.restore();
    }

    // Mini progress hint
    const look = sampleCenterline(session.track, player.distanceAlong + 20);
    void look;
    ctx.fillStyle = "rgba(27,27,31,0.65)";
    ctx.fillRect(12, 12, 160, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "14px Trebuchet MS, sans-serif";
    ctx.fillText(`2D-Modus · Platz ${player.place}`, 20, 32);
  }
}
