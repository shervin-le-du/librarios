import type { GradientFill } from "./fill";

/** Matches branding `contrastFg` threshold — text flips above this lightness. */
export const BRANDING_CONTRAST_LIGHTNESS = 60;

export type BrandingLightnessSide = "light" | "dark";

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16) / 255,
    g: parseInt(m[1].slice(2, 4), 16) / 255,
    b: parseInt(m[1].slice(4, 6), 16) / 255,
  };
}

function hexLightness(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return ((max + min) / 2) * 100;
}

function hexHue(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4; break;
  }
  return (h / 6) * 360;
}

function hexSaturation(hex: string): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return (l > 0.5 ? d / (2 - max - min) : d / (max + min)) * 100;
}

export function hexToHslParts(hex: string): { h: number; s: number; l: number } | null {
  const l = hexLightness(hex);
  const h = hexHue(hex);
  const s = hexSaturation(hex);
  if (l == null || h == null || s == null) return null;
  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}

export function hslPartsToHex(h: number, s: number, l: number): string {
  const ss = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function brandingLightnessSide(l: number): BrandingLightnessSide {
  return l > BRANDING_CONTRAST_LIGHTNESS ? "light" : "dark";
}

export function brandingLightnessBounds(side: BrandingLightnessSide): { min: number; max: number } {
  return side === "light" ? { min: 61, max: 100 } : { min: 0, max: 60 };
}

export function clampBrandingLightness(l: number, side: BrandingLightnessSide): number {
  const { min, max } = brandingLightnessBounds(side);
  return Math.max(min, Math.min(max, Math.round(l)));
}

/** Enforce branding custom-gradient rules: linear, 2 stops, shared hue/sat, same contrast side. */
export function normalizeBrandingGradient(fill: GradientFill): GradientFill {
  const sorted = [...fill.stops].sort((a, b) => a.position - b.position);
  const first = sorted[0];
  const last = sorted[sorted.length - 1] ?? first;
  const anchor = hexToHslParts(first.color) ?? { h: 0, s: 0, l: 50 };
  const side = brandingLightnessSide(anchor.l);
  const lastParts = hexToHslParts(last.color) ?? anchor;
  const l0 = clampBrandingLightness(anchor.l, side);
  const l1 = clampBrandingLightness(lastParts.l, side);
  const { h, s } = anchor;

  return {
    type: "gradient",
    mode: "linear",
    angle: fill.angle,
    stops: [
      { color: hslPartsToHex(h, s, l0), position: first.position },
      { color: hslPartsToHex(h, s, l1), position: last.position === first.position ? 100 : last.position },
    ],
  };
}

export const BRANDING_BLEND_DEPTH_DEFAULT = 12;
export const BRANDING_BLEND_DEPTH_MIN = 4;
export const BRANDING_BLEND_DEPTH_MAX = 32;

export function brandingBlendLightness(anchorL: number, depth: number): number {
  const side = brandingLightnessSide(anchorL);
  const l0 = clampBrandingLightness(anchorL, side);
  const clampedDepth = Math.max(
    BRANDING_BLEND_DEPTH_MIN,
    Math.min(BRANDING_BLEND_DEPTH_MAX, Math.round(depth)),
  );
  const signedDelta = side === "light" ? -clampedDepth : clampedDepth;
  return clampBrandingLightness(l0 + signedDelta, side);
}

export function brandingBlendDepthFromStops(stops: { color: string }[]): number {
  const l0 = hexToHslParts(stops[0]?.color ?? "")?.l;
  const l1 = hexToHslParts(stops[1]?.color ?? "")?.l;
  if (l0 == null || l1 == null) return BRANDING_BLEND_DEPTH_DEFAULT;
  const depth = Math.round(Math.abs(l1 - l0));
  return Math.max(BRANDING_BLEND_DEPTH_MIN, Math.min(BRANDING_BLEND_DEPTH_MAX, depth));
}

export function brandingAutoBlendLightness(
  anchorL: number,
  side: BrandingLightnessSide,
): number {
  return brandingBlendLightness(anchorL, BRANDING_BLEND_DEPTH_DEFAULT);
}

export function createBrandingGradientFromHex(baseHex: string, angle = 135): GradientFill {
  const base = hexToHslParts(baseHex) ?? { h: 0, s: 0, l: 50 };
  const side = brandingLightnessSide(base.l);
  const l0 = clampBrandingLightness(base.l, side);
  const l1 = brandingAutoBlendLightness(l0, side);
  return normalizeBrandingGradient({
    type: "gradient",
    mode: "linear",
    angle,
    stops: [
      { color: hslPartsToHex(base.h, base.s, l0), position: 0 },
      { color: hslPartsToHex(base.h, base.s, l1), position: 100 },
    ],
  });
}

function circularHueSpread(hues: number[]): number {
  if (hues.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const d = Math.abs(hues[i] - hues[j]);
      max = Math.max(max, Math.min(d, 360 - d));
    }
  }
  return max;
}

/**
 * Gradients safe for tenant branding: derived text/muted/borders use the first stop only,
 * so we reject radial fills, large lightness swings, and multi-hue ramps.
 */
export function isGradientBrandingSafe(fill: GradientFill): boolean {
  if (fill.mode === "radial") return false;
  if (fill.stops.length < 2) return false;

  const lights: number[] = [];
  const hues: number[] = [];
  for (const stop of fill.stops) {
    const l = hexLightness(stop.color);
    const h = hexHue(stop.color);
    if (l == null || h == null) return false;
    lights.push(l);
    hues.push(h);
  }

  const minL = Math.min(...lights);
  const maxL = Math.max(...lights);
  if (minL <= BRANDING_CONTRAST_LIGHTNESS && maxL > BRANDING_CONTRAST_LIGHTNESS) return false;
  if (maxL - minL > 32) return false;

  const hueDelta = circularHueSpread(hues);
  const maxHue = fill.stops.length > 2 ? 42 : 52;
  if (hueDelta > maxHue) return false;

  return true;
}
