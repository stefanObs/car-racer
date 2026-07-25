export type StylePopup = {
  id: number;
  amount: number;
  label: string;
  bornAt: number;
  expiresAt: number;
};

/** Floating +CHF style callouts for the race HUD (CONCEPT §9). */
export class StylePopupQueue {
  private nextId = 1;
  private pops: StylePopup[] = [];
  private readonly lifetimeMs: number;

  constructor(lifetimeMs = 1600) {
    this.lifetimeMs = lifetimeMs;
  }

  clear(): void {
    this.pops = [];
  }

  push(amount: number, label: string, nowMs: number): void {
    if (amount <= 0) return;
    this.pops.push({
      id: this.nextId++,
      amount,
      label,
      bornAt: nowMs,
      expiresAt: nowMs + this.lifetimeMs,
    });
    if (this.pops.length > 4) this.pops.shift();
  }

  active(nowMs: number): StylePopup[] {
    this.pops = this.pops.filter((p) => p.expiresAt > nowMs);
    return this.pops;
  }

  renderHtml(nowMs: number): string {
    const list = this.active(nowMs);
    if (!list.length) return "";
    return list
      .map((p) => {
        const life = Math.max(0.001, p.expiresAt - p.bornAt);
        const t = (nowMs - p.bornAt) / life; // 0..1
        const opacity = t < 0.12 ? t / 0.12 : t > 0.7 ? (1 - t) / 0.3 : 1;
        const rise = t * 36;
        const scale = 0.92 + Math.min(t, 0.15) * (0.08 / 0.15);
        return `<div class="style-pop" data-dev-name="hud.style-pop" data-id="${p.id}" style="opacity:${opacity.toFixed(3)};transform:translateY(${(-rise).toFixed(1)}px) scale(${scale.toFixed(3)})">
            <strong>+${p.amount} CHF</strong>
            <span>${p.label}</span>
          </div>`;
      })
      .join("");
  }
}
