import { isGradientBrandingSafe } from "./gradient-safety";
import type { GradientFill } from "./fill";

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

export type GradientPreset = { name: string; fill: GradientFill; safe?: boolean };

export type GradientPresetGroup = { label: string; presets: GradientPreset[] };

const EXCLUDED_GROUP_LABELS = new Set(["Bold & neon", "Radial & glow"]);

function isPresetSafe(preset: GradientPreset): boolean {
  if (preset.safe === false) return false;
  if (preset.safe === true) return true;
  return isGradientBrandingSafe(preset.fill);
}

/** Featured safe presets — shown by default in the gradient picker. */
const DEFAULT_PRESET_NAMES = [
  "Peach",
  "Coral",
  "Ocean",
  "Sky",
  "Arctic",
  "Glacier",
  "Moss",
  "Rose",
  "Graphite",
  "Cloud",
  "Cotton",
  "Linen",
] as const;

export const GRADIENT_PRESET_GROUPS: GradientPresetGroup[] = [
  {
    label: "Warm & sunset",
    presets: [
      { name: "Sunset", fill: g("linear", 30, ["#ff9966", 0], ["#ff5e62", 100]) },
      { name: "Peach", fill: g("linear", 45, ["#ffecd2", 0], ["#fcb69f", 100]) },
      { name: "Coral", fill: g("linear", 60, ["#f6d365", 0], ["#fda085", 100]) },
      { name: "Mango", fill: g("linear", 90, ["#f7971e", 0], ["#ffd200", 100]) },
      { name: "Flame", fill: g("linear", 45, ["#f12711", 0], ["#f5af19", 100]) },
      { name: "Ember", fill: g("linear", 160, ["#93291e", 0], ["#ed213a", 100]) },
      { name: "Saffron", fill: g("linear", 120, ["#f7971e", 0], ["#ffd200", 50], ["#ff6b6b", 100]) },
      { name: "Apricot", fill: g("linear", 135, ["#ff9a9e", 0], ["#fecfef", 50], ["#fecfef", 100]) },
      { name: "Honey", fill: g("linear", 180, ["#fceabb", 0], ["#f8b500", 100]) },
      { name: "Tangerine", fill: g("linear", 70, ["#ff8008", 0], ["#ffc837", 100]) },
      { name: "Blush dawn", fill: g("linear", 20, ["#ff758c", 0], ["#ff7eb3", 100]) },
      { name: "Desert", fill: g("linear", 150, ["#c79081", 0], ["#dfa579", 100]) },
    ],
  },
  {
    label: "Cool & ocean",
    presets: [
      { name: "Ocean", fill: g("linear", 135, ["#2193b0", 0], ["#6dd5ed", 100]) },
      { name: "Sky", fill: g("linear", 180, ["#a1c4fd", 0], ["#c2e9fb", 100]) },
      { name: "Arctic", fill: g("linear", 160, ["#e0f7fa", 0], ["#80deea", 100]) },
      { name: "Glacier", fill: g("linear", 200, ["#89f7fe", 0], ["#66a6ff", 100]) },
      { name: "Deep sea", fill: g("linear", 170, ["#0f4c75", 0], ["#3282b8", 100]) },
      { name: "Lagoon", fill: g("linear", 120, ["#43cea2", 0], ["#185a9d", 100]) },
      { name: "Aqua", fill: g("linear", 90, ["#50c9c3", 0], ["#96deda", 100]) },
      { name: "Ice", fill: g("linear", 0, ["#e6f0ff", 0], ["#b3d4ff", 100]) },
      { name: "Teal wave", fill: g("linear", 145, ["#11998e", 0], ["#38ef7d", 100]) },
      { name: "Horizon", fill: g("linear", 0, ["#56ccf2", 0], ["#2f80ed", 100]) },
      { name: "Cyan burst", fill: g("linear", 60, ["#00d2ff", 0], ["#3a7bd5", 100]) },
      { name: "Polar", fill: g("linear", 220, ["#cfd9df", 0], ["#e2ebf0", 100]) },
    ],
  },
  {
    label: "Nature & earth",
    presets: [
      { name: "Forest", fill: g("linear", 160, ["#134e5e", 0], ["#71b280", 100]) },
      { name: "Moss", fill: g("linear", 140, ["#56ab2f", 0], ["#a8e063", 100]) },
      { name: "Pine", fill: g("linear", 180, ["#0b3d2e", 0], ["#1a5c40", 100]) },
      { name: "Olive", fill: g("linear", 120, ["#3d4e17", 0], ["#6b7c3a", 100]) },
      { name: "Sage", fill: g("linear", 90, ["#dce35b", 0], ["#45b649", 100]) },
      { name: "Earth", fill: g("linear", 160, ["#603813", 0], ["#b29f94", 100]) },
      { name: "Clay", fill: g("linear", 45, ["#c79081", 0], ["#dfd1c7", 100]) },
      { name: "Sandstone", fill: g("linear", 180, ["#d4a574", 0], ["#f5e6d3", 100]) },
      { name: "Autumn", fill: g("linear", 30, ["#d38312", 0], ["#a83279", 100]) },
      { name: "Fern", fill: g("linear", 150, ["#2c5364", 0], ["#0f9b0f", 100]) },
      { name: "Canopy", fill: g("linear", 170, ["#004d40", 0], ["#1b5e20", 50], ["#66bb6a", 100]) },
      { name: "Stone", fill: g("linear", 180, ["#757f9a", 0], ["#d7dde8", 100]) },
      { name: "Bark", fill: g("linear", 160, ["#3e2723", 0], ["#5d4037", 100]) },
      { name: "Meadow", fill: g("linear", 140, ["#e8f5e9", 0], ["#a5d6a7", 100]) },
    ],
  },
  {
    label: "Purple & pink",
    presets: [
      { name: "Plum", fill: g("linear", 135, ["#3b0764", 0], ["#a855f7", 100]) },
      { name: "Rose", fill: g("linear", 45, ["#ee9ca7", 0], ["#ffdde1", 100]) },
      { name: "Lavender", fill: g("linear", 120, ["#e0c3fc", 0], ["#8ec5fc", 100]) },
      { name: "Orchid", fill: g("linear", 160, ["#cc2b5e", 0], ["#753a88", 100]) },
      { name: "Berry", fill: g("linear", 90, ["#8e2de2", 0], ["#4a00e0", 100]) },
      { name: "Magenta", fill: g("linear", 45, ["#f953c6", 0], ["#b91d73", 100]) },
      { name: "Violet dusk", fill: g("linear", 200, ["#654ea3", 0], ["#eaafc8", 100]) },
      { name: "Grape", fill: g("linear", 150, ["#41295a", 0], ["#2f0743", 100]) },
      { name: "Fuchsia", fill: g("linear", 60, ["#ff6fd8", 0], ["#3813c2", 100]) },
      { name: "Candy", fill: g("linear", 30, ["#ff9a9e", 0], ["#fad0c4", 50], ["#fad0c4", 100]) },
      { name: "Lilac", fill: g("linear", 180, ["#c471f5", 0], ["#fa71cd", 100]) },
      { name: "Twilight", fill: g("linear", 170, ["#2b1055", 0], ["#7597de", 100]) },
      { name: "Heather", fill: g("linear", 150, ["#ede7f6", 0], ["#d1c4e9", 100]) },
    ],
  },
  {
    label: "Dark & moody",
    presets: [
      { name: "Midnight", fill: g("linear", 160, ["#0f172a", 0], ["#1e3a8a", 100]) },
      { name: "Graphite", fill: g("linear", 180, ["#232526", 0], ["#414345", 100]) },
      { name: "Charcoal", fill: g("linear", 200, ["#141e30", 0], ["#243b55", 100]) },
      { name: "Ink", fill: g("linear", 180, ["#0f0c29", 0], ["#302b63", 50], ["#24243e", 100]) },
      { name: "Obsidian", fill: g("linear", 150, ["#000000", 0], ["#434343", 100]) },
      { name: "Storm", fill: g("linear", 120, ["#373b44", 0], ["#4286f4", 100]) },
      { name: "Noir", fill: g("linear", 90, ["#1a1a2e", 0], ["#16213e", 50], ["#0f3460", 100]) },
      { name: "Slate night", fill: g("linear", 170, ["#0f2027", 0], ["#203a43", 50], ["#2c5364", 100]) },
      { name: "Wine", fill: g("linear", 140, ["#200122", 0], ["#6f0000", 100]) },
      { name: "Abyss", fill: g("linear", 180, ["#000428", 0], ["#004e92", 100]) },
      { name: "Carbon", fill: g("linear", 0, ["#283048", 0], ["#859398", 100]) },
      { name: "Eclipse", fill: g("linear", 45, ["#141e30", 0], ["#0f0c29", 100]) },
    ],
  },
  {
    label: "Soft & pastel",
    presets: [
      { name: "Cloud", fill: g("linear", 180, ["#fdfbfb", 0], ["#ebedee", 100]) },
      { name: "Cotton", fill: g("linear", 160, ["#f5f7fa", 0], ["#c3cfe2", 100]) },
      { name: "Mist", fill: g("linear", 120, ["#e3fdf5", 0], ["#ffe6fa", 100]) },
      { name: "Powder", fill: g("linear", 90, ["#ffecd2", 0], ["#fcb69f", 50], ["#ffecd2", 100]) },
      { name: "Blush", fill: g("linear", 45, ["#ffafbd", 0], ["#ffc3a0", 100]) },
      { name: "Mint cream", fill: g("linear", 180, ["#d4fc79", 0], ["#96e6a1", 100]) },
      { name: "Periwinkle", fill: g("linear", 150, ["#a8edea", 0], ["#fed6e3", 100]) },
      { name: "Linen", fill: g("linear", 0, ["#f9f6f0", 0], ["#ede0d4", 100]) },
      { name: "Seafoam", fill: g("linear", 200, ["#e0f7fa", 0], ["#b2ebf2", 100]) },
      { name: "Vanilla", fill: g("linear", 180, ["#fff1eb", 0], ["#ace0f9", 100]) },
      { name: "Petal", fill: g("linear", 60, ["#fbc2eb", 0], ["#a6c1ee", 100]) },
      { name: "Dew", fill: g("linear", 170, ["#f0fff4", 0], ["#c6f6d5", 100]) },
      { name: "Ivory", fill: g("linear", 180, ["#fffef9", 0], ["#f0ebe3", 100]) },
      { name: "Pearl", fill: g("linear", 160, ["#fefefe", 0], ["#f3f0eb", 100]) },
    ],
  },
  {
    label: "Bold & neon",
    presets: [
      { name: "Aurora", fill: g("linear", 120, ["#00c9ff", 0], ["#92fe9d", 100]) },
      { name: "Electric", fill: g("linear", 90, ["#fc466b", 0], ["#3f5efb", 100]) },
      { name: "Neon lime", fill: g("linear", 45, ["#a8ff78", 0], ["#78ffd6", 100]) },
      { name: "Synthwave", fill: g("linear", 180, ["#ff00cc", 0], ["#333399", 100]) },
      { name: "Laser", fill: g("linear", 60, ["#12c2e9", 0], ["#c471ed", 50], ["#f64f59", 100]) },
      { name: "Hyper", fill: g("linear", 135, ["#f83600", 0], ["#f9d423", 100]) },
      { name: "Voltage", fill: g("linear", 200, ["#00f260", 0], ["#0575e6", 100]) },
      { name: "Pulse", fill: g("linear", 30, ["#ff0844", 0], ["#ffb199", 100]) },
      { name: "Prism", fill: g("linear", 120, ["#4776e6", 0], ["#8e54e9", 100]) },
      { name: "Cosmic", fill: g("linear", 160, ["#ff6a00", 0], ["#ee0979", 100]) },
      { name: "Rave", fill: g("linear", 90, ["#834d9b", 0], ["#d04ed6", 100]) },
      { name: "Chrome", fill: g("linear", 180, ["#e6e9f0", 0], ["#eef1f5", 50], ["#c3cfe2", 100]) },
    ],
  },
  {
    label: "Radial & glow",
    presets: [
      { name: "Radial glow", fill: g("radial", 0, ["#5b6cff", 0], ["#0f172a", 100]) },
      { name: "Spotlight", fill: g("radial", 0, ["#ffffff", 0], ["#1e293b", 100]) },
      { name: "Halo", fill: g("radial", 0, ["#fbbf24", 0], ["#7c2d12", 100]) },
      { name: "Orb", fill: g("radial", 0, ["#818cf8", 0], ["#312e81", 100]) },
      { name: "Sun core", fill: g("radial", 0, ["#fef08a", 0], ["#ea580c", 100]) },
      { name: "Moon", fill: g("radial", 0, ["#e2e8f0", 0], ["#0f172a", 100]) },
      { name: "Nebula", fill: g("radial", 0, ["#c084fc", 0], ["#1e1b4b", 100]) },
      { name: "Ember glow", fill: g("radial", 0, ["#fb7185", 0], ["#450a0a", 100]) },
      { name: "Aqua orb", fill: g("radial", 0, ["#67e8f9", 0], ["#0e7490", 100]) },
      { name: "Forest glow", fill: g("radial", 0, ["#86efac", 0], ["#14532d", 100]) },
      { name: "Rose halo", fill: g("radial", 0, ["#fda4af", 0], ["#881337", 100]) },
      { name: "Void", fill: g("radial", 0, ["#334155", 0], ["#020617", 100]) },
    ],
  },
];

/** Flat list of every preset (including unsafe), for search or tooling. */
export const GRADIENT_PRESETS: GradientPreset[] = GRADIENT_PRESET_GROUPS.flatMap(
  (group) => group.presets,
);

/** Branding-safe groups only — used in the color picker browse view. */
export const GRADIENT_SAFE_PRESET_GROUPS: GradientPresetGroup[] = GRADIENT_PRESET_GROUPS
  .filter((group) => !EXCLUDED_GROUP_LABELS.has(group.label))
  .map((group) => ({
    label: group.label,
    presets: group.presets.filter(isPresetSafe),
  }))
  .filter((group) => group.presets.length > 0);

const safePresetByName = new Map(
  GRADIENT_SAFE_PRESET_GROUPS.flatMap((group) => group.presets).map((p) => [p.name, p] as const),
);

/** Default gradient swatches — tonal presets that work with derived colors. */
export const GRADIENT_PRESET_DEFAULTS: GradientPreset[] = DEFAULT_PRESET_NAMES
  .map((name) => safePresetByName.get(name))
  .filter((p): p is GradientPreset => !!p);
