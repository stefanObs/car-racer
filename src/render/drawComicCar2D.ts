import { ComicPaletteCss } from "./palette";

export type ComicCar2DOpts = {
  paint: string;
  sticker?: string;
  smoke?: boolean;
  heal?: boolean;
  nitro?: boolean;
  lean?: number;
  bounce?: number;
};

/** Rear ¾ comic sports car — matches reference silhouette for chase view. */
export function drawComicCarRear(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  opts: ComicCar2DOpts,
): void {
  ctx.save();
  ctx.translate(x, y + (opts.bounce ?? 0));
  ctx.rotate(opts.lean ?? 0);
  ctx.scale(scale, scale);

  const stroke = () => {
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.14;
    ctx.strokeStyle = ComicPaletteCss.outline;
    ctx.stroke();
  };

  if (opts.nitro) {
    ctx.fillStyle = ComicPaletteCss.nitroOrange;
    ctx.beginPath();
    ctx.moveTo(-0.35, 1.1);
    ctx.lineTo(-0.15, 2.2);
    ctx.lineTo(0.15, 2.2);
    ctx.lineTo(0.35, 1.1);
    ctx.fill();
    ctx.fillStyle = ComicPaletteCss.nitroCyan;
    ctx.fillRect(-0.12, 1.5, 0.24, 0.9);
  }

  if (opts.smoke) {
    ctx.fillStyle = ComicPaletteCss.smoke;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-0.4 + i * 0.25, -1.2 - i * 0.35, 0.35 + i * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Rear wheels
  ctx.fillStyle = ComicPaletteCss.tire;
  ctx.beginPath();
  ctx.ellipse(-1.05, 0.55, 0.28, 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  stroke();
  ctx.beginPath();
  ctx.ellipse(1.05, 0.55, 0.28, 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  stroke();

  // Body
  ctx.fillStyle = opts.paint;
  ctx.beginPath();
  ctx.moveTo(-1.15, 0.7);
  ctx.lineTo(-1.2, 0.15);
  ctx.lineTo(-0.95, -0.55);
  ctx.lineTo(-0.55, -0.85);
  ctx.lineTo(0.55, -0.85);
  ctx.lineTo(0.95, -0.55);
  ctx.lineTo(1.2, 0.15);
  ctx.lineTo(1.15, 0.7);
  ctx.lineTo(0.7, 0.95);
  ctx.lineTo(-0.7, 0.95);
  ctx.closePath();
  ctx.fill();
  stroke();

  // Shade step (cel)
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.moveTo(-1.15, 0.55);
  ctx.lineTo(-0.2, 0.55);
  ctx.lineTo(-0.15, 0.95);
  ctx.lineTo(-0.7, 0.95);
  ctx.closePath();
  ctx.fill();

  // Cabin glass
  ctx.fillStyle = "#151820";
  ctx.beginPath();
  ctx.moveTo(-0.7, -0.15);
  ctx.lineTo(-0.55, -0.7);
  ctx.lineTo(0.55, -0.7);
  ctx.lineTo(0.7, -0.15);
  ctx.lineTo(0.45, 0.05);
  ctx.lineTo(-0.45, 0.05);
  ctx.closePath();
  ctx.fill();
  stroke();

  // Spoiler
  ctx.fillStyle = ComicPaletteCss.outline;
  ctx.fillRect(-1.05, -1.05, 2.1, 0.18);
  stroke();
  ctx.beginPath();
  ctx.rect(-1.05, -1.05, 2.1, 0.18);
  stroke();
  ctx.fillRect(-0.95, -0.95, 0.12, 0.35);
  ctx.fillRect(0.83, -0.95, 0.12, 0.35);

  // Quad lights
  ctx.fillStyle = "#ff2d2d";
  for (const lx of [-0.55, -0.32, 0.32, 0.55]) {
    ctx.beginPath();
    ctx.arc(lx, 0.55, 0.11, 0, Math.PI * 2);
    ctx.fill();
    stroke();
  }

  // Diffuser / exhaust
  ctx.fillStyle = "#2a2a2e";
  ctx.fillRect(-0.55, 0.78, 1.1, 0.22);
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.arc(-0.18, 0.95, 0.08, 0, Math.PI * 2);
  ctx.arc(0.18, 0.95, 0.08, 0, Math.PI * 2);
  ctx.fill();

  if (opts.sticker && opts.sticker !== "none") {
    ctx.fillStyle =
      opts.sticker === "flames"
        ? ComicPaletteCss.nitroOrange
        : opts.sticker === "bolt"
          ? ComicPaletteCss.repairSpark
          : ComicPaletteCss.nitroCyan;
    ctx.fillRect(0.95, -0.2, 0.18, 0.7);
  }

  if (opts.heal) {
    ctx.fillStyle = ComicPaletteCss.repairSpark;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * 0.9 - 0.08, Math.sin(a) * 0.7 - 0.3, 0.16, 0.16);
    }
  }

  ctx.restore();
}
