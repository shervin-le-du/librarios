import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fillSolidHex, fillToCss, parseFill } from "./fill";


export type LibraryBranding = {
  // Logos
  logo_url?: string | null;
  logo_dark_url?: string | null;
  favicon_url?: string | null;
  social_image_url?: string | null;
  // Per-slot icon fallback (lucide-react). Used when a slot has no uploaded image.
  logo_icon_name?: string | null;
  logo_icon_color?: string | null;
  logo_dark_icon_name?: string | null;
  logo_dark_icon_color?: string | null;
  favicon_icon_name?: string | null;
  favicon_icon_color?: string | null;
  social_icon_name?: string | null;
  social_icon_color?: string | null;
  // Legacy — kept so old data still reads without errors
  icon_name?: string | null;
  icon_color?: string | null;
  // Brand colors
  primary?: string;
  primary_foreground?: string;
  accent?: string;
  accent_foreground?: string;
  secondary?: string;
  // Surface
  background?: string;
  foreground?: string;
  card?: string;
  muted?: string;
  border?: string;
  sidebar?: string;
  navbar?: string;
  // Feedback
  destructive?: string;
  success?: string;
  warning?: string;
  // Typography
  heading_font?: string;
  body_font?: string;
  // Buttons — legacy (kept for back-compat / migration on read)
  button_radius?: "square" | "small" | "medium" | "large" | "pill";
  button_style?: "solid" | "outline" | "soft";
  // Per-button style ("shape") — rounded | pill | sharp | outline | soft | brutalist
  button_primary_style?: ButtonShape;
  button_secondary_style?: ButtonShape;
  button_destructive_style?: ButtonShape;
  // Button colors (independent of primary/secondary/destructive)
  button_bg?: string;
  button_fg?: string;
  button_secondary_bg?: string;
  button_secondary_fg?: string;
  button_destructive_bg?: string;
  button_destructive_fg?: string;
};

export type ButtonShape = "rounded" | "pill" | "sharp" | "outline" | "soft" | "brutalist";

export const BUTTON_SHAPES: { id: ButtonShape; label: string; description: string; radius: string }[] = [
  { id: "rounded", label: "Rounded", description: "Classic subtle rounding", radius: "0.5rem" },
  { id: "pill", label: "Pill", description: "Fully rounded capsule", radius: "9999px" },
  { id: "sharp", label: "Sharp", description: "Crisp square edges", radius: "0px" },
  { id: "outline", label: "Outline", description: "Transparent with border", radius: "0.5rem" },
  { id: "soft", label: "Soft", description: "Gentle, low contrast", radius: "0.75rem" },
  { id: "brutalist", label: "Brutalist", description: "Thick border + offset", radius: "0px" },
];

export const BUTTON_SHAPE_RADIUS: Record<ButtonShape, string> = {
  rounded: "0.5rem",
  pill: "9999px",
  sharp: "0px",
  outline: "0.5rem",
  soft: "0.75rem",
  brutalist: "0px",
};

// Legacy → new shape mapping
export function migrateLegacyButtonShape(
  radius: LibraryBranding["button_radius"],
  style: LibraryBranding["button_style"],
): ButtonShape {
  if (style === "outline") return "outline";
  if (style === "soft") return "soft";
  if (radius === "pill") return "pill";
  if (radius === "square") return "sharp";
  if (radius === "large") return "soft";
  return "rounded";
}



export const FONT_PRESETS: { id: string; label: string; family: string; url: string }[] = [
  { id: "inter", label: "Inter", family: "Inter", url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
  { id: "urbanist", label: "Urbanist", family: "Urbanist", url: "https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap" },
  { id: "epilogue", label: "Epilogue", family: "Epilogue", url: "https://fonts.googleapis.com/css2?family=Epilogue:wght@300;400;500;600;700&display=swap" },
  { id: "playfair", label: "Playfair Display", family: "Playfair Display", url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap" },
  { id: "merriweather", label: "Merriweather", family: "Merriweather", url: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap" },
  { id: "dm-serif", label: "DM Serif Display", family: "DM Serif Display", url: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap" },
  { id: "space-grotesk", label: "Space Grotesk", family: "Space Grotesk", url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" },
  { id: "manrope", label: "Manrope", family: "Manrope", url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" },
  { id: "libre-baskerville", label: "Libre Baskerville", family: "Libre Baskerville", url: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap" },
];

export const RADIUS_MAP: Record<NonNullable<LibraryBranding["button_radius"]>, string> = {
  square: "0px",
  small: "4px",
  medium: "8px",
  large: "12px",
  pill: "9999px",
};

export const COLOR_PRIMARY_PRESETS = [
  { name: "navy", hex: "#0a2540" },
  { name: "blue", hex: "#2563eb" },
  { name: "indigo", hex: "#4f46e5" },
  { name: "violet", hex: "#7c3aed" },
  { name: "emerald", hex: "#059669" },
  { name: "teal", hex: "#0d9488" },
  { name: "slate", hex: "#334155" },
  { name: "black", hex: "#0f172a" },
];

export const COLOR_ACCENT_PRESETS = [
  { name: "amber", hex: "#f59e0b" },
  { name: "coral", hex: "#f97316" },
  { name: "rose", hex: "#e11d48" },
  { name: "pink", hex: "#ec4899" },
  { name: "teal", hex: "#14b8a6" },
  { name: "cyan", hex: "#06b6d4" },
  { name: "lime", hex: "#84cc16" },
  { name: "purple", hex: "#a855f7" },
];

export const COLOR_BACKGROUND_PRESETS = [
  { name: "white", hex: "#ffffff" },
  { name: "paper", hex: "#f7f5f0" },
  { name: "cream", hex: "#faf7f2" },
  { name: "stone", hex: "#f5f5f4" },
  { name: "slate", hex: "#f1f5f9" },
  { name: "ink", hex: "#0f172a" },
  { name: "graphite", hex: "#1e293b" },
  { name: "charcoal", hex: "#111827" },
];

export const COLOR_FOREGROUND_PRESETS = [
  { name: "ink", hex: "#0f172a" },
  { name: "graphite", hex: "#1e293b" },
  { name: "slate", hex: "#334155" },
  { name: "charcoal", hex: "#111827" },
  { name: "black", hex: "#000000" },
  { name: "white", hex: "#ffffff" },
  { name: "paper", hex: "#f7f5f0" },
  { name: "stone", hex: "#e7e5e4" },
];

export const COLOR_SECONDARY_PRESETS = [
  { name: "slate", hex: "#e2e8f0" },
  { name: "stone", hex: "#e7e5e4" },
  { name: "sand", hex: "#eee6d3" },
  { name: "mist", hex: "#e5e7eb" },
  { name: "sky", hex: "#dbeafe" },
  { name: "sage", hex: "#dcfce7" },
  { name: "blush", hex: "#fce7f3" },
  { name: "ink", hex: "#1e293b" },
];

export const COLOR_CARD_PRESETS = [
  { name: "white", hex: "#ffffff" },
  { name: "paper", hex: "#faf9f5" },
  { name: "cream", hex: "#fdfaf3" },
  { name: "stone", hex: "#f5f5f4" },
  { name: "mist", hex: "#f8fafc" },
  { name: "graphite", hex: "#1e293b" },
  { name: "ink", hex: "#0f172a" },
  { name: "charcoal", hex: "#111827" },
];

export const COLOR_MUTED_PRESETS = [
  { name: "stone", hex: "#f1efe9" },
  { name: "slate", hex: "#eef2f6" },
  { name: "mist", hex: "#f1f5f9" },
  { name: "sand", hex: "#efe9db" },
  { name: "graphite", hex: "#1f2937" },
  { name: "shadow", hex: "#111827" },
];

export const COLOR_BORDER_PRESETS = [
  { name: "hairline", hex: "#e5e7eb" },
  { name: "slate", hex: "#cbd5e1" },
  { name: "stone", hex: "#d6d3d1" },
  { name: "ink", hex: "#0f172a" },
  { name: "graphite", hex: "#334155" },
];

export const COLOR_SIDEBAR_PRESETS = [
  { name: "white", hex: "#ffffff" },
  { name: "paper", hex: "#faf9f5" },
  { name: "mist", hex: "#f8fafc" },
  { name: "stone", hex: "#f5f5f4" },
  { name: "slate", hex: "#f1f5f9" },
  { name: "graphite", hex: "#1e293b" },
  { name: "ink", hex: "#0f172a" },
];

export const COLOR_NAVBAR_PRESETS = [
  { name: "white", hex: "#ffffff" },
  { name: "paper", hex: "#faf9f5" },
  { name: "cream", hex: "#fdfaf3" },
  { name: "mist", hex: "#f8fafc" },
  { name: "graphite", hex: "#1e293b" },
  { name: "ink", hex: "#0f172a" },
];

export const COLOR_DESTRUCTIVE_PRESETS = [
  { name: "red", hex: "#dc2626" },
  { name: "rose", hex: "#e11d48" },
  { name: "crimson", hex: "#b91c1c" },
  { name: "coral", hex: "#f97316" },
];

export const COLOR_SUCCESS_PRESETS = [
  { name: "emerald", hex: "#059669" },
  { name: "green", hex: "#16a34a" },
  { name: "teal", hex: "#0d9488" },
  { name: "lime", hex: "#65a30d" },
];

export const COLOR_WARNING_PRESETS = [
  { name: "amber", hex: "#f59e0b" },
  { name: "yellow", hex: "#eab308" },
  { name: "orange", hex: "#ea580c" },
];

export const COLOR_CTA_BG_PRESETS = [
  { name: "navy", hex: "#0f172a" },
  { name: "ink", hex: "#111827" },
  { name: "graphite", hex: "#1e293b" },
  { name: "midnight", hex: "#0a2540" },
  { name: "forest", hex: "#064e3b" },
  { name: "plum", hex: "#3b0764" },
  { name: "primary", hex: "#2563eb" },
];

export const COLOR_CTA_ACCENT_PRESETS = [
  { name: "sky", hex: "#3b82f6" },
  { name: "amber", hex: "#f59e0b" },
  { name: "emerald", hex: "#10b981" },
  { name: "rose", hex: "#f43f5e" },
  { name: "violet", hex: "#8b5cf6" },
  { name: "white", hex: "#ffffff" },
];

export const COLOR_BUTTON_BG_PRESETS = [
  { name: "navy", hex: "#0a2540" },
  { name: "ink", hex: "#0f172a" },
  { name: "blue", hex: "#2563eb" },
  { name: "indigo", hex: "#4f46e5" },
  { name: "emerald", hex: "#059669" },
  { name: "amber", hex: "#f59e0b" },
  { name: "rose", hex: "#e11d48" },
  { name: "black", hex: "#000000" },
];

export const COLOR_BUTTON_FG_PRESETS = [
  { name: "white", hex: "#ffffff" },
  { name: "paper", hex: "#f7f5f0" },
  { name: "ink", hex: "#0f172a" },
  { name: "black", hex: "#000000" },
];

export const COLOR_BUTTON_SECONDARY_BG_PRESETS = [
  { name: "slate", hex: "#e2e8f0" },
  { name: "stone", hex: "#e7e5e4" },
  { name: "mist", hex: "#f1f5f9" },
  { name: "sand", hex: "#eee6d3" },
  { name: "white", hex: "#ffffff" },
  { name: "ink", hex: "#1e293b" },
];

export const COLOR_BUTTON_SECONDARY_FG_PRESETS = [
  { name: "ink", hex: "#0f172a" },
  { name: "graphite", hex: "#1e293b" },
  { name: "slate", hex: "#334155" },
  { name: "white", hex: "#ffffff" },
];

export const COLOR_BUTTON_DESTRUCTIVE_BG_PRESETS = [
  { name: "red", hex: "#dc2626" },
  { name: "rose", hex: "#e11d48" },
  { name: "crimson", hex: "#b91c1c" },
  { name: "coral", hex: "#f97316" },
  { name: "ink", hex: "#0f172a" },
];

export const COLOR_BUTTON_DESTRUCTIVE_FG_PRESETS = [
  { name: "white", hex: "#ffffff" },
  { name: "paper", hex: "#f7f5f0" },
  { name: "ink", hex: "#0f172a" },
];



export function findFontPreset(family: string | undefined) {
  return FONT_PRESETS.find((f) => f.family === family) ?? null;
}

// Convert hex to HSL "h s% l%" string for Tailwind CSS variables
export function hexToHsl(hex: string): string | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const FONT_LINK_ID = "librarios-brand-fonts";
const FAVICON_LINK_ID = "librarios-brand-favicon";

function ensureFontLinks(urls: string[]) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  const href = urls.filter(Boolean).join("|");
  if (existing?.dataset.href === href) return;
  existing?.remove();
  urls.forEach((url, i) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    if (i === 0) { link.id = FONT_LINK_ID; link.dataset.href = href; }
    document.head.appendChild(link);
  });
}

function setFavicon(url: string | null | undefined) {
  if (typeof document === "undefined" || !url) return;
  let link = document.getElementById(FAVICON_LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = FAVICON_LINK_ID;
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

// Lightness (0-100) from an "H S% L%" HSL string, for contrast pairing.
function lightnessOf(hsl: string): number {
  const m = hsl.match(/([\d.]+)%\s*$/);
  return m ? parseFloat(m[1]) : 50;
}
function contrastFg(hsl: string): string {
  // Return an HSL string for readable text on top of the given color.
  return lightnessOf(hsl) > 60 ? "222 47% 11%" : "0 0% 100%";
}

function parseHslParts(hsl: string): { h: number; s: number; l: number } | null {
  const m = hsl.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!m) return null;
  return { h: +m[1], s: +m[2], l: +m[3] };
}
function hslStr(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.round(Math.max(0, Math.min(100, s)))}% ${Math.round(Math.max(0, Math.min(100, l)))}%`;
}

// Tracks which properties we set so cleanup can remove them all.
const BRAND_VARS = [
  "primary", "primary-foreground",
  "accent", "accent-foreground",
  "secondary", "secondary-foreground",
  "background", "foreground",
  "card", "card-foreground",
  "popover", "popover-foreground",
  "muted", "muted-foreground",
  "border", "input", "ring",
  "destructive", "destructive-foreground",
  "success", "success-foreground",
  "warning", "warning-foreground",
  "sidebar", "sidebar-foreground",
  "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground",
  "sidebar-border", "sidebar-ring",
  "navbar", "navbar-foreground",
  "cta-bg", "cta-foreground", "cta-accent", "cta-accent-foreground",
  "button-bg", "button-fg", "button-secondary-bg", "button-secondary-fg",
  "button-destructive-bg", "button-destructive-fg",
  "btn-primary-radius", "btn-secondary-radius", "btn-destructive-radius",
  "font-heading", "font-body", "radius",
  // Gradient image companions (background-image layered over solid HSL)
  "background-image", "card-image", "sidebar-image", "navbar-image",
  "primary-image", "accent-image", "destructive-image",
  "button-bg-image", "button-secondary-bg-image", "button-destructive-bg-image",
] as const;

// Fields that accept a gradient fill (JSON string) in addition to hex.
const GRADIENT_FIELDS: (keyof LibraryBranding)[] = [
  "background", "card", "sidebar", "navbar",
  "primary", "accent", "destructive",
  "button_bg", "button_secondary_bg", "button_destructive_bg",
];

// Map a LibraryBranding field name → the CSS custom-property prefix used for
// the paired `--<prefix>-image` variable.
const GRADIENT_VAR_PREFIX: Partial<Record<keyof LibraryBranding, string>> = {
  background: "background",
  card: "card",
  sidebar: "sidebar",
  navbar: "navbar",
  primary: "primary",
  accent: "accent",
  destructive: "destructive",
  button_bg: "button-bg",
  button_secondary_bg: "button-secondary-bg",
  button_destructive_bg: "button-destructive-bg",
};


export function applyBrandingToDocument(branding: LibraryBranding | null | undefined, favicon?: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const setVar = (name: string, hsl: string | null | undefined, alpha?: number) => {
    if (!hsl) { root.style.removeProperty(`--${name}`); return; }
    root.style.setProperty(`--${name}`, alpha == null ? hsl : `${hsl} / ${alpha}`);
  };
  const setImage = (name: string, css: string | null) => {
    if (!css) root.style.removeProperty(`--${name}-image`);
    else root.style.setProperty(`--${name}-image`, css);
  };

  // Extract gradient CSS per gradient-capable field and normalize each field
  // down to its representative solid hex for the existing HSL derivations.
  const b: LibraryBranding | null = branding ? { ...branding } : null;
  if (b) {
    for (const field of GRADIENT_FIELDS) {
      const raw = (b as any)[field] as string | undefined;
      const parsed = parseFill(raw ?? null);
      const prefix = GRADIENT_VAR_PREFIX[field];
      if (parsed?.type === "gradient" && prefix) {
        setImage(prefix, fillToCss(parsed));
        (b as any)[field] = fillSolidHex(parsed) ?? undefined;
      } else if (prefix) {
        setImage(prefix, null);
      }
    }
  } else {
    // No branding at all — clear every image companion.
    Object.values(GRADIENT_VAR_PREFIX).forEach((p) => p && setImage(p, null));
  }

  const primaryHsl = b?.primary ? hexToHsl(b.primary) : null;
  const accentHsl = b?.accent ? hexToHsl(b.accent) : null;
  const bgHsl = b?.background ? hexToHsl(b.background) : null;
  const fgHsl = b?.foreground
    ? hexToHsl(b.foreground)
    : (bgHsl ? contrastFg(bgHsl) : null);



  // Primary + foreground
  setVar("primary", primaryHsl);
  if (primaryHsl) {
    const pfg = b?.primary_foreground ? hexToHsl(b.primary_foreground) : contrastFg(primaryHsl);
    setVar("primary-foreground", pfg);
  } else setVar("primary-foreground", null);

  // Accent + foreground
  setVar("accent", accentHsl);
  if (accentHsl) {
    const afg = b?.accent_foreground ? hexToHsl(b.accent_foreground) : contrastFg(accentHsl);
    setVar("accent-foreground", afg);
  } else setVar("accent-foreground", null);

  // Background + foreground
  setVar("background", bgHsl);
  setVar("foreground", fgHsl);

  // Derived surfaces when we have both bg and fg
  if (bgHsl && fgHsl) {
    const bgP = parseHslParts(bgHsl)!;
    const fgP = parseHslParts(fgHsl)!;
    const dir = fgP.l > bgP.l ? 1 : -1;
    const shiftL = (amt: number) => bgP.l + dir * amt;

    const cardHsl = b?.card ? hexToHsl(b.card) : hslStr(bgP.h, bgP.s, shiftL(4));
    setVar("card", cardHsl); setVar("card-foreground", fgHsl);
    setVar("popover", cardHsl); setVar("popover-foreground", fgHsl);

    const mutedHsl = b?.muted ? hexToHsl(b.muted) : hslStr(bgP.h, bgP.s, shiftL(7));
    setVar("muted", mutedHsl);
    const mfL = fgP.l + (bgP.l - fgP.l) * 0.45;
    setVar("muted-foreground", hslStr(fgP.h, Math.max(0, fgP.s - 5), mfL));

    const secondaryHsl = b?.secondary ? hexToHsl(b.secondary) : hslStr(bgP.h, bgP.s, shiftL(6));
    setVar("secondary", secondaryHsl);
    if (secondaryHsl) {
      const sfg = contrastFg(secondaryHsl);
      setVar("secondary-foreground", sfg);
    }

    const borderHsl = b?.border ? hexToHsl(b.border) : null;
    if (borderHsl) {
      setVar("border", borderHsl);
      setVar("input", borderHsl);
      setVar("sidebar-border", borderHsl);
    } else {
      setVar("border", `${Math.round(fgP.h)} ${Math.round(fgP.s)}% ${Math.round(fgP.l)}%`, 0.1);
      setVar("input", `${Math.round(fgP.h)} ${Math.round(fgP.s)}% ${Math.round(fgP.l)}%`, 0.14);
      setVar("sidebar-border", `${Math.round(fgP.h)} ${Math.round(fgP.s)}% ${Math.round(fgP.l)}%`, 0.1);
    }

    // Sidebar mirrors — honor explicit override
    const sidebarHsl = b?.sidebar ? hexToHsl(b.sidebar) : hslStr(bgP.h, bgP.s, shiftL(2));
    setVar("sidebar", sidebarHsl);
    setVar("sidebar-foreground", sidebarHsl ? contrastFg(sidebarHsl) : fgHsl);
    setVar("sidebar-accent", mutedHsl);
    setVar("sidebar-accent-foreground", fgHsl);

    // Navbar — honor explicit override, else follows background
    const navbarHsl = b?.navbar ? hexToHsl(b.navbar) : bgHsl;
    setVar("navbar", navbarHsl);
    setVar("navbar-foreground", navbarHsl ? contrastFg(navbarHsl) : fgHsl);
  } else {
    // Clear derived when bg/fg unset
    ["card","card-foreground","popover","popover-foreground","muted","muted-foreground",
     "secondary","secondary-foreground","border","input",
     "sidebar","sidebar-foreground","sidebar-accent","sidebar-accent-foreground","sidebar-border",
     "navbar","navbar-foreground"]
      .forEach((k) => setVar(k, null));
  }

  // Ring — follows primary, else accent
  setVar("ring", primaryHsl ?? accentHsl);
  if (primaryHsl) {
    setVar("sidebar-primary", primaryHsl);
    setVar(
      "sidebar-primary-foreground",
      b?.primary_foreground ? hexToHsl(b.primary_foreground) : contrastFg(primaryHsl),
    );
    setVar("sidebar-ring", primaryHsl);
  } else {
    setVar("sidebar-primary", null);
    setVar("sidebar-primary-foreground", null);
    setVar("sidebar-ring", null);
  }

  // Feedback colors
  const applyFeedback = (key: "destructive" | "success" | "warning", hex?: string) => {
    if (!hex) { setVar(key, null); setVar(`${key}-foreground`, null); return; }
    const h = hexToHsl(hex);
    if (!h) return;
    setVar(key, h);
    setVar(`${key}-foreground`, contrastFg(h));
  };
  applyFeedback("destructive", b?.destructive);
  applyFeedback("success", b?.success);
  applyFeedback("warning", b?.warning);

  // CTA band — always derived from foreground/accent. Per-block overrides
  // are applied inline on the block itself, not here.
  if (fgHsl) {
    setVar("cta-bg", fgHsl);
    setVar("cta-foreground", contrastFg(fgHsl));
  } else {
    setVar("cta-bg", null);
    setVar("cta-foreground", null);
  }
  if (accentHsl) {
    setVar("cta-accent", accentHsl);
    setVar("cta-accent-foreground", contrastFg(accentHsl));
  } else {
    setVar("cta-accent", null);
    setVar("cta-accent-foreground", null);
  }

  // Typography
  const headingPreset = findFontPreset(b?.heading_font);
  const bodyPreset = findFontPreset(b?.body_font);
  const fontUrls = Array.from(new Set([headingPreset?.url, bodyPreset?.url].filter(Boolean) as string[]));
  if (fontUrls.length) ensureFontLinks(fontUrls);
  if (headingPreset) root.style.setProperty("--font-heading", `"${headingPreset.family}", serif`);
  else root.style.removeProperty("--font-heading");
  if (bodyPreset) root.style.setProperty("--font-body", `"${bodyPreset.family}", sans-serif`);
  else root.style.removeProperty("--font-body");

  // Buttons — per-button shape (legacy fields migrate on read)
  const legacyShape = migrateLegacyButtonShape(b?.button_radius, b?.button_style);
  const primaryShape = b?.button_primary_style ?? legacyShape;
  const secondaryShape = b?.button_secondary_style ?? legacyShape;
  const destructiveShape = b?.button_destructive_style ?? legacyShape;

  root.style.setProperty("--btn-primary-radius", BUTTON_SHAPE_RADIUS[primaryShape]);
  root.style.setProperty("--btn-secondary-radius", BUTTON_SHAPE_RADIUS[secondaryShape]);
  root.style.setProperty("--btn-destructive-radius", BUTTON_SHAPE_RADIUS[destructiveShape]);
  root.style.setProperty("--radius", BUTTON_SHAPE_RADIUS[primaryShape]);

  root.dataset.btnPrimaryStyle = primaryShape;
  root.dataset.btnSecondaryStyle = secondaryShape;
  root.dataset.btnDestructiveStyle = destructiveShape;
  delete root.dataset.buttonStyle;

  // Button colors — independent of primary/secondary/destructive.
  const applyBtn = (
    key: "button-bg" | "button-fg" | "button-secondary-bg" | "button-secondary-fg" | "button-destructive-bg" | "button-destructive-fg",
    hex?: string,
  ) => {
    if (!hex) { setVar(key, null); return; }
    const h = hexToHsl(hex);
    setVar(key, h);
  };
  applyBtn("button-bg", b?.button_bg);
  applyBtn("button-fg", b?.button_fg);
  applyBtn("button-secondary-bg", b?.button_secondary_bg);
  applyBtn("button-secondary-fg", b?.button_secondary_fg);
  applyBtn("button-destructive-bg", b?.button_destructive_bg);
  applyBtn("button-destructive-fg", b?.button_destructive_fg);


  // Favicon
  setFavicon(favicon ?? null);
}


// Sign helper for private storage assets (branding bucket).
export function useSignedBrandingAsset(path: string | null | undefined) {
  return useQuery({
    queryKey: ["branding-asset-signed", path],
    enabled: !!path,
    queryFn: async () => {
      if (!path) return null;
      // External URLs pass through unchanged.
      if (/^https?:\/\//i.test(path)) return path;
      const { data, error } = await supabase.storage
        .from("library-branding")
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });
}

export function useApplyBranding(
  branding: LibraryBranding | null | undefined,
  brandColorFallback?: string | null,
) {
  // Sign favicon separately so it survives page loads.
  const favicon = useSignedBrandingAsset(branding?.favicon_url ?? null);

  useEffect(() => {
    const merged: LibraryBranding = {
      ...branding,
      primary: branding?.primary || brandColorFallback || undefined,
    };
    applyBrandingToDocument(merged, favicon.data ?? null);
    return () => {
      const root = document.documentElement;
      BRAND_VARS.forEach((v) => root.style.removeProperty(`--${v}`));
      delete root.dataset.buttonStyle;
      delete root.dataset.btnPrimaryStyle;
      delete root.dataset.btnSecondaryStyle;
      delete root.dataset.btnDestructiveStyle;

    };

  }, [branding, brandColorFallback, favicon.data]);
}
