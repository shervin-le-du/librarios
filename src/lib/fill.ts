/**
 * Fill: a color value that can be a solid hex or a gradient.
 *
 * Storage form is always a string so it can flow through the existing
 * branding/hex-string plumbing:
 *   - Solid  → "#rrggbb"
 *   - Gradient → JSON.stringify(GradientFill)  (starts with "{")
 *
 * Use `parseFill` on read and `serializeFill` / raw hex on write.
 * Use `fillToCss` at every render site (buttons, backgrounds, headers).
 */

export type SolidFill = { type: "solid"; color: string };
export type GradientStop = { color: string; position: number }; // 0..100
export type GradientFill = {
  type: "gradient";
  mode: "linear" | "radial";
  angle: number;
  stops: GradientStop[];
};
export type Fill = SolidFill | GradientFill;

export function parseFill(v: unknown): Fill | null {
  if (v == null) return null;
  if (typeof v === "object") {
    const f = v as any;
    if (f?.type === "solid" && typeof f.color === "string") return f as SolidFill;
    if (f?.type === "gradient" && Array.isArray(f.stops)) return normalizeGradient(f);
    return null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s);
      if (o?.type === "gradient" && Array.isArray(o.stops)) return normalizeGradient(o);
      if (o?.type === "solid" && typeof o.color === "string") return o;
    } catch {
      return null;
    }
    return null;
  }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
    const hex = s.length === 4
      ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase()
      : s.toLowerCase();
    return { type: "solid", color: hex };
  }
  return null;
}

function normalizeGradient(g: any): GradientFill {
  const stops: GradientStop[] = (g.stops ?? [])
    .filter((s: any) => s && typeof s.color === "string")
    .map((s: any) => ({ color: s.color, position: clamp(Number(s.position) || 0, 0, 100) }));
  while (stops.length < 2) stops.push({ color: "#ffffff", position: stops.length === 0 ? 0 : 100 });
  stops.sort((a, b) => a.position - b.position);
  return {
    type: "gradient",
    mode: g.mode === "radial" ? "radial" : "linear",
    angle: clamp(Number(g.angle) || 0, 0, 360),
    stops,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function serializeFill(f: Fill): string {
  if (f.type === "solid") return f.color;
  return JSON.stringify(f);
}

export function isGradient(f: Fill | null | undefined): f is GradientFill {
  return !!f && f.type === "gradient";
}

export function isGradientString(v: unknown): boolean {
  return typeof v === "string" && v.trim().startsWith("{");
}

/** CSS value suitable for `background` (color OR gradient). */
export function fillToCss(v: Fill | string | null | undefined): string {
  const f = typeof v === "string" || v == null ? parseFill(v) : v;
  if (!f) return "transparent";
  if (f.type === "solid") return f.color;
  const stops = [...f.stops].sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${Math.round(s.position)}%`).join(", ");
  return f.mode === "linear"
    ? `linear-gradient(${Math.round(f.angle)}deg, ${stops})`
    : `radial-gradient(circle, ${stops})`;
}

/** Representative solid hex — first stop for a gradient, the color for a solid. */
export function fillSolidHex(v: Fill | string | null | undefined): string | null {
  const f = typeof v === "string" || v == null ? parseFill(v) : v;
  if (!f) return null;
  return f.type === "solid" ? f.color : (f.stops[0]?.color ?? null);
}

/** Convert any stored value into a Fill for editing. Falls back to a solid default. */
export function toEditableFill(v: unknown, fallback: string = "#000000"): Fill {
  return parseFill(v) ?? { type: "solid", color: fallback };
}

/* ── Curated gradient presets ───────────────────────────────────────── */

const g = (
  mode: "linear" | "radial",
  angle: number,
  ...stops: [string, number][]
): GradientFill => ({
  type: "gradient",
  mode,
  angle,
  stops: stops.map(([color, position]) => ({ color, position })),
});

export const GRADIENT_PRESETS: { name: string; fill: GradientFill }[] = [
  { name: "Sunset",     fill: g("linear",  30,  ["#ff9966", 0], ["#ff5e62", 100]) },
  { name: "Peach",      fill: g("linear",  45,  ["#ffecd2", 0], ["#fcb69f", 100]) },
  { name: "Coral",      fill: g("linear",  60,  ["#f6d365", 0], ["#fda085", 100]) },
  { name: "Ocean",      fill: g("linear", 135,  ["#2193b0", 0], ["#6dd5ed", 100]) },
  { name: "Sky",        fill: g("linear", 180,  ["#a1c4fd", 0], ["#c2e9fb", 100]) },
  { name: "Midnight",   fill: g("linear", 160,  ["#0f172a", 0], ["#1e3a8a", 100]) },
  { name: "Aurora",     fill: g("linear", 120,  ["#00c9ff", 0], ["#92fe9d", 100]) },
  { name: "Forest",     fill: g("linear", 160,  ["#134e5e", 0], ["#71b280", 100]) },
  { name: "Plum",       fill: g("linear", 135,  ["#3b0764", 0], ["#a855f7", 100]) },
  { name: "Rose",       fill: g("linear",  45,  ["#ee9ca7", 0], ["#ffdde1", 100]) },
  { name: "Graphite",   fill: g("linear", 180,  ["#232526", 0], ["#414345", 100]) },
  { name: "Radial glow",fill: g("radial",  0,   ["#5b6cff", 0], ["#0f172a", 100]) },
];
