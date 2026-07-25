import type { RaceSession } from "../sim/race";
import { stageFromHp } from "../sim/damage";
import { sampleCenterline } from "../track/buildTrack";
import {
  edgePoint,
  projectWorldPoint,
  type ChaseCameraParams,
  type ChasePose,
} from "./chaseCamera";
import { drawComicCarRear } from "./drawComicCar2D";
import { ComicPaletteCss } from "./palette";

/**
 * Asphalt-Comic chase view without WebGL.
 * Matches CONCEPT camera (rear elevated) — not a top-down map.
 */
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

  private cam(): ChaseCameraParams {
    return {
      back: 7.2,
      height: 3.4,
      focal: this.h * 0.72,
      horizonY: this.h * 0.38,
      centerX: this.w / 2,
      near: 1.2,
    };
  }

  renderIdle(): void {
    this.drawSky("harbor");
    this.drawClouds();
    this.drawHorizonProps("harbor");
    drawComicCarRear(this.ctx, this.w / 2, this.h * 0.78, Math.min(this.w, this.h) * 0.11, {
      paint: "#E03131",
      sticker: "flames",
    });
    this.ctx.fillStyle = "rgba(27,27,31,0.7)";
    this.ctx.strokeStyle = ComicPaletteCss.outline;
    this.ctx.lineWidth = 3;
    this.ctx.fillRect(this.w * 0.12, this.h * 0.12, this.w * 0.76, 56);
    this.ctx.strokeRect(this.w * 0.12, this.h * 0.12, this.w * 0.76, 56);
    this.ctx.fillStyle = "#f4f4f5";
    this.ctx.font = "bold 26px Trebuchet MS, sans-serif";
    this.ctx.fillText("Crash Circuit · Asphalt-Comic", this.w * 0.14, this.h * 0.12 + 38);
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
    const pose: ChasePose = { x: player.x, z: player.z, heading: player.heading };
    const cam = this.cam();
    const theme = session.level.theme;
    const track = session.track;
    const ctx = this.ctx;

    this.drawSky(theme);
    this.drawClouds();
    this.drawHorizonProps(theme);

    // Ground fill below horizon
    ctx.fillStyle = theme === "harbor" || theme === "beach" ? "#2f6f9e" : "#2d6a3a";
    ctx.fillRect(0, cam.horizonY, this.w, this.h - cam.horizonY);

    const halfA = track.asphaltHalfWidth;
    const grass = track.grassWidth;
    const samples: Array<{
      dist: number;
      c: ReturnType<typeof sampleCenterline>;
      asphaltL: { x: number; z: number };
      asphaltR: { x: number; z: number };
      grassL: { x: number; z: number };
      grassR: { x: number; z: number };
      wallL: { x: number; z: number };
      wallR: { x: number; z: number };
    }> = [];

    for (let ahead = -4; ahead <= 90; ahead += 2.5) {
      const dist = player.distanceAlong + ahead;
      const c = sampleCenterline(track, dist);
      samples.push({
        dist: ahead,
        c,
        asphaltL: edgePoint(c.position.x, c.position.z, c.tangent.x, c.tangent.z, -halfA),
        asphaltR: edgePoint(c.position.x, c.position.z, c.tangent.x, c.tangent.z, halfA),
        grassL: edgePoint(c.position.x, c.position.z, c.tangent.x, c.tangent.z, -(halfA + grass)),
        grassR: edgePoint(c.position.x, c.position.z, c.tangent.x, c.tangent.z, halfA + grass),
        wallL: edgePoint(c.position.x, c.position.z, c.tangent.x, c.tangent.z, -(halfA + grass + 0.6)),
        wallR: edgePoint(c.position.x, c.position.z, c.tangent.x, c.tangent.z, halfA + grass + 0.6),
      });
    }

    const project = (x: number, z: number, y = 0) => projectWorldPoint(x, y, z, pose, cam);

    // Draw strips far → near
    for (let i = samples.length - 2; i >= 0; i--) {
      const a = samples[i]!;
      const b = samples[i + 1]!;
      const gL0 = project(a.grassL.x, a.grassL.z);
      const gR0 = project(a.grassR.x, a.grassR.z);
      const gL1 = project(b.grassL.x, b.grassL.z);
      const gR1 = project(b.grassR.x, b.grassR.z);
      if (gL0 && gR0 && gL1 && gR1) {
        this.fillQuad(gL0, gR0, gR1, gL1, ComicPaletteCss.grass);
      }

      const aL0 = project(a.asphaltL.x, a.asphaltL.z);
      const aR0 = project(a.asphaltR.x, a.asphaltR.z);
      const aL1 = project(b.asphaltL.x, b.asphaltL.z);
      const aR1 = project(b.asphaltR.x, b.asphaltR.z);
      if (aL0 && aR0 && aL1 && aR1) {
        this.fillQuad(aL0, aR0, aR1, aL1, ComicPaletteCss.asphalt);
        const curb = i % 2 === 0 ? ComicPaletteCss.curbLight : ComicPaletteCss.curbDark;
        const curbL0 = project(
          a.asphaltL.x + (a.grassL.x - a.asphaltL.x) * 0.12,
          a.asphaltL.z + (a.grassL.z - a.asphaltL.z) * 0.12,
        );
        const curbL1 = project(
          b.asphaltL.x + (b.grassL.x - b.asphaltL.x) * 0.12,
          b.asphaltL.z + (b.grassL.z - b.asphaltL.z) * 0.12,
        );
        const curbR0 = project(
          a.asphaltR.x + (a.grassR.x - a.asphaltR.x) * 0.12,
          a.asphaltR.z + (a.grassR.z - a.asphaltR.z) * 0.12,
        );
        const curbR1 = project(
          b.asphaltR.x + (b.grassR.x - b.asphaltR.x) * 0.12,
          b.asphaltR.z + (b.grassR.z - b.asphaltR.z) * 0.12,
        );
        if (curbL0 && curbL1) this.fillQuad(aL0, curbL0, curbL1, aL1, curb);
        if (curbR0 && curbR1) this.fillQuad(aR0, curbR0, curbR1, aR1, curb);
      }

      // Center dashes
      if (i % 2 === 0 && aL0 && aR0 && aL1 && aR1) {
        const c0 = project(a.c.position.x, a.c.position.z);
        const c1 = project(b.c.position.x, b.c.position.z);
        if (c0 && c1) {
          ctx.strokeStyle = ComicPaletteCss.asphaltLine;
          ctx.lineWidth = Math.max(2, c0.scale * 0.12);
          ctx.beginPath();
          ctx.moveTo(c0.sx, c0.sy);
          ctx.lineTo(c1.sx, c1.sy);
          ctx.stroke();
        }
      }

      // Walls
      const wallKind = a.c.wall;
      const wL0 = project(a.wallL.x, a.wallL.z, 0);
      const wL0t = project(a.wallL.x, a.wallL.z, wallKind === "tire" ? 1.2 : 1.5);
      const wL1 = project(b.wallL.x, b.wallL.z, 0);
      const wL1t = project(b.wallL.x, b.wallL.z, wallKind === "tire" ? 1.2 : 1.5);
      if (wL0 && wL0t && wL1 && wL1t) {
        this.fillQuad(wL0, wL0t, wL1t, wL1, wallKind === "tire" ? ComicPaletteCss.tire : ComicPaletteCss.concrete);
        if (wallKind === "tire" && i % 3 === 0) {
          ctx.strokeStyle = ComicPaletteCss.tireAccent;
          ctx.lineWidth = 3;
          ctx.strokeRect(wL0t.sx - 4, wL0t.sy - 4, 8, 8);
        } else if (wallKind === "concrete" && i % 4 === 0) {
          this.drawChevronMark(wL0t.sx, wL0t.sy, wL0.scale);
        }
      }
      const wR0 = project(a.wallR.x, a.wallR.z, 0);
      const wR0t = project(a.wallR.x, a.wallR.z, wallKind === "tire" ? 1.2 : 1.5);
      const wR1 = project(b.wallR.x, b.wallR.z, 0);
      const wR1t = project(b.wallR.x, b.wallR.z, wallKind === "tire" ? 1.2 : 1.5);
      if (wR0 && wR0t && wR1 && wR1t) {
        this.fillQuad(wR0, wR0t, wR1t, wR1, wallKind === "tire" ? ComicPaletteCss.tire : ComicPaletteCss.concrete);
        if (wallKind === "concrete" && i % 4 === 0) {
          this.drawChevronMark(wR0t.sx, wR0t.sy, wR0.scale);
        }
      }
    }

    // Speed streaks
    if (player.speed > 8) {
      ctx.strokeStyle = "rgba(232,226,214,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const sx = this.w * (0.2 + (i / 8) * 0.6);
        const len = 20 + player.speed * 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, this.h * 0.55);
        ctx.lineTo(sx + (i % 2 === 0 ? -8 : 8), this.h * 0.55 + len);
        ctx.stroke();
      }
    }

    // Other cars (depth sorted)
    const others = session.cars
      .filter((c) => !c.isPlayer)
      .map((car) => {
        const p = project(car.x, car.z, 0.4);
        return { car, p };
      })
      .filter((x): x is { car: (typeof session.cars)[0]; p: NonNullable<typeof x.p> } => x.p !== null)
      .sort((a, b) => b.p.depth - a.p.depth);

    for (const { car, p } of others) {
      if (car.koTimer > 0 && car.hp <= 0 && Math.sin(car.koTimer * 20) <= 0) continue;
      const prev = this.lastNitro.get(car.id) ?? car.nitro;
      const boosting = car.nitro < prev - 0.001;
      this.lastNitro.set(car.id, car.nitro);
      drawComicCarRear(this.ctx, p.sx, p.sy, Math.max(8, p.scale * 1.6), {
        paint: car.paint,
        sticker: car.sticker,
        smoke: stageFromHp(car.hp) >= 1 && stageFromHp(car.hp) < 4,
        heal: car.healFx > 0.25,
        nitro: boosting,
      });
    }

    // Player car — lower-center frame (concept camera composition)
    const prev = this.lastNitro.get(player.id) ?? player.nitro;
    const boosting = player.nitro < prev - 0.001;
    this.lastNitro.set(player.id, player.nitro);
    const stage = stageFromHp(player.hp);
    const bounce = stage >= 2 ? Math.sin(this.fxTime * 18) * 4 : Math.sin(this.fxTime * 10) * player.speed * 0.02;
    drawComicCarRear(this.ctx, this.w / 2, this.h * 0.78, Math.min(this.w, this.h) * 0.12, {
      paint: player.paint,
      sticker: player.sticker,
      smoke: stage >= 1 && stage < 4,
      heal: player.healFx > 0.25,
      nitro: boosting,
      lean: Math.sin(this.fxTime * 6) * 0.03 * (stage >= 2 ? 2 : 1),
      bounce,
    });

    ctx.fillStyle = "rgba(27,27,31,0.65)";
    ctx.strokeStyle = ComicPaletteCss.outline;
    ctx.lineWidth = 2;
    ctx.fillRect(12, 12, 200, 30);
    ctx.strokeRect(12, 12, 200, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "14px Trebuchet MS, sans-serif";
    ctx.fillText(`Chase-Comic · Platz ${player.place}`, 20, 32);
  }

  private fillQuad(
    a: { sx: number; sy: number },
    b: { sx: number; sy: number },
    c: { sx: number; sy: number },
    d: { sx: number; sy: number },
    color: string,
  ): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
    ctx.fill();
  }

  private drawChevronMark(x: number, y: number, scale: number): void {
    const ctx = this.ctx;
    const s = Math.max(6, scale * 0.5);
    ctx.fillStyle = "#ffe066";
    ctx.strokeStyle = ComicPaletteCss.outline;
    ctx.lineWidth = 2;
    ctx.fillRect(x - s, y - s * 0.6, s * 2, s * 1.2);
    ctx.strokeRect(x - s, y - s * 0.6, s * 2, s * 1.2);
    ctx.fillStyle = ComicPaletteCss.outline;
    ctx.font = `bold ${Math.max(10, s)}px sans-serif`;
    ctx.fillText(">>>", x - s * 0.7, y + s * 0.25);
  }

  private drawSky(theme: string): void {
    const g = this.ctx.createLinearGradient(0, 0, 0, this.h * 0.5);
    g.addColorStop(0, ComicPaletteCss.sky);
    g.addColorStop(1, theme === "canyon" ? "#7aa8c9" : "#3d7eae");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawClouds(): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#f8f9fa";
    ctx.strokeStyle = ComicPaletteCss.outline;
    ctx.lineWidth = 3;
    const clouds = [
      [0.15, 0.12, 0.12],
      [0.45, 0.08, 0.16],
      [0.75, 0.14, 0.11],
    ];
    for (const [px, py, r] of clouds) {
      const x = this.w * px!;
      const y = this.h * py!;
      const rad = this.w * r!;
      ctx.beginPath();
      ctx.moveTo(x - rad, y);
      ctx.quadraticCurveTo(x - rad * 0.6, y - rad * 0.8, x, y - rad * 0.5);
      ctx.quadraticCurveTo(x + rad * 0.7, y - rad * 0.9, x + rad, y);
      ctx.quadraticCurveTo(x + rad * 0.4, y + rad * 0.35, x - rad * 0.2, y + rad * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawHorizonProps(theme: string): void {
    const ctx = this.ctx;
    const hy = this.h * 0.38;
    if (theme === "harbor" || theme === "beach") {
      ctx.fillStyle = "#2f6f9e";
      ctx.fillRect(0, hy - 4, this.w, 22);

      // Chunky gantry cranes (reference orange)
      for (const cx of [this.w * 0.14, this.w * 0.48, this.w * 0.78]) {
        const mastH = this.h * 0.26;
        ctx.fillStyle = ComicPaletteCss.tireAccent;
        ctx.strokeStyle = ComicPaletteCss.outline;
        ctx.lineWidth = 3;
        ctx.fillRect(cx - 10, hy - mastH, 20, mastH);
        ctx.strokeRect(cx - 10, hy - mastH, 20, mastH);
        ctx.fillRect(cx - 10, hy - mastH - 8, this.w * 0.14, 16);
        ctx.strokeRect(cx - 10, hy - mastH - 8, this.w * 0.14, 16);
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(cx - 14, hy - mastH + 10, 28, 18);
        ctx.strokeRect(cx - 14, hy - mastH + 10, 28, 18);
      }

      // Cargo ship silhouette
      ctx.fillStyle = "#1c7ed6";
      ctx.strokeStyle = ComicPaletteCss.outline;
      ctx.lineWidth = 3;
      const sx = this.w * 0.58;
      ctx.beginPath();
      ctx.moveTo(sx, hy);
      ctx.lineTo(sx + 20, hy - 28);
      ctx.lineTo(sx + this.w * 0.28, hy - 28);
      ctx.lineTo(sx + this.w * 0.32, hy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(sx + this.w * 0.2, hy - 52, 36, 24);
      ctx.strokeRect(sx + this.w * 0.2, hy - 52, 36, 24);

      const colors = ["#339af0", "#e03131", "#f08c00", "#37b24d"];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = colors[i % 4]!;
        const x = this.w * 0.08 + i * 28;
        const y = hy - 36 - (i % 3) * 18;
        ctx.fillRect(x, y, 26, 18);
        ctx.strokeRect(x, y, 26, 18);
      }
    } else if (theme === "city" || theme === "factory") {
      ctx.fillStyle = ComicPaletteCss.concrete;
      ctx.strokeStyle = ComicPaletteCss.outline;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const x = this.w * (0.1 + i * 0.15);
        const h = 40 + (i % 3) * 28;
        ctx.fillRect(x, hy - h, 40, h);
        ctx.strokeRect(x, hy - h, 40, h);
      }
    } else {
      ctx.fillStyle = "#a0785a";
      ctx.strokeStyle = ComicPaletteCss.outline;
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const x = this.w * (0.2 + i * 0.2);
        ctx.beginPath();
        ctx.moveTo(x, hy);
        ctx.lineTo(x + 30, hy - 50 - i * 10);
        ctx.lineTo(x + 70, hy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }
}
