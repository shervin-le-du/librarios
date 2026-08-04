import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HslColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, Plus, Minus, ChevronDown } from "lucide-react";
import { EyedropperButton } from "@/components/EyedropperButton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  fillToCss,
  parseFill,
  serializeFill,
  toEditableFill,
  createBrandingGradientFromHex,
  normalizeBrandingGradient,
  GRADIENT_SAFE_PRESET_GROUPS,
  GRADIENT_PRESET_DEFAULTS,
  type Fill,
  type GradientFill,
  type GradientPreset,
  type GradientStop,
} from "@/lib/fill";
import {
  brandingBlendDepthFromStops,
  brandingBlendLightness,
  brandingLightnessBounds,
  brandingLightnessSide,
  BRANDING_BLEND_DEPTH_MAX,
  BRANDING_BLEND_DEPTH_MIN,
  hexToHslParts,
} from "@/lib/gradient-safety";
import { cn } from "@/lib/utils";

/* ── Color conversion helpers ─────────────────────────────────────────── */

export const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  hex = hex.replace("#", "");
  if (hex.length !== 6) return { h: 0, s: 0, l: 50 };
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const hslToHex = (hsl: { h: number; s: number; l: number }): string => {
  const { h, l } = hsl;
  const s = hsl.s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * s;
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
};

const hslToRgbStr = (hsl: { h: number; s: number; l: number }): string => {
  const hex = hslToHex(hsl).replace("#", "");
  return `${parseInt(hex.substring(0, 2), 16)}, ${parseInt(hex.substring(2, 4), 16)}, ${parseInt(hex.substring(4, 6), 16)}`;
};

/* ── Types ────────────────────────────────────────────────────────────── */

export interface ColorPreset {
  name: string;
  hex: string;
}

export type ColorViewMode = "picker" | "presets" | "manual";

/** Landscape golden rectangle — width : height = φ */
const PRESET_SWATCH_CLASS = "aspect-[1.618/1] w-full rounded";

interface ColorPickerCardProps {
  label: string;
  /** Stored value: hex ("#rrggbb") for solid, or JSON string for gradient. */
  color: string;
  presets: ColorPreset[];
  /** Called with the new stored string value (hex or JSON gradient). */
  onChange: (value: string) => void;
  defaultColor: string;
  /** Show the Solid / Gradient toggle. Default: false (solid-only). */
  allowGradient?: boolean;
  /** Restrict custom gradient editing (page background). */
  gradientConstraints?: "branding";
  /** Live document preview while dragging (no React state update). */
  onPreviewChange?: (value: string) => void;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function ColorPickerCard({
  label,
  color,
  presets,
  onChange,
  defaultColor,
  allowGradient = false,
  gradientConstraints,
  onPreviewChange,
}: ColorPickerCardProps) {
  const brandingGradient = gradientConstraints === "branding";
  const parsed = useMemo(() => parseFill(color), [color]);
  const isGradient = allowGradient && parsed?.type === "gradient";
  const [fillMode, setFillMode] = useState<"solid" | "gradient">(isGradient ? "gradient" : "solid");

  useEffect(() => {
    setFillMode(parsed?.type === "gradient" ? "gradient" : "solid");
  }, [parsed?.type]);

  const isDefault = color === defaultColor;
  const handleReset = () => onChange(defaultColor);
  const eyedropperPickRef = useRef<(hex: string) => void>(() => {});
  const bindEyedropper = useCallback((pick: (hex: string) => void) => {
    eyedropperPickRef.current = pick;
  }, []);

  useEffect(() => {
    if (fillMode === "solid") {
      eyedropperPickRef.current = (hex) => onChange(hex);
    }
  }, [fillMode, onChange]);

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-bold">{label}</Label>
        {allowGradient && (
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-sm transition-colors",
                fillMode === "solid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setFillMode("solid");
                if (parsed?.type === "gradient") {
                  onChange(parsed.stops[0]?.color ?? defaultColor);
                }
              }}
            >
              Solid
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-sm transition-colors",
                fillMode === "gradient" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setFillMode("gradient");
                if (parsed?.type !== "gradient") {
                  const base = parsed?.type === "solid" ? parsed.color : defaultColor;
                  const grad = brandingGradient
                    ? createBrandingGradientFromHex(base)
                    : {
                        type: "gradient" as const,
                        mode: "linear" as const,
                        angle: 135,
                        stops: [
                          { color: base, position: 0 },
                          { color: defaultColor, position: 100 },
                        ],
                      };
                  onChange(serializeFill(grad));
                }
              }}
            >
              Gradient
            </button>
          </div>
        )}
      </div>

      {fillMode === "solid" ? (
        <SolidEditor
          hex={parsed?.type === "solid" ? parsed.color : defaultColor}
          presets={presets}
          onChange={onChange}
        />
      ) : (
        <GradientEditor
          fill={
            parsed?.type === "gradient"
              ? (brandingGradient ? normalizeBrandingGradient(parsed) : parsed)
              : brandingGradient
                ? createBrandingGradientFromHex(
                    parsed?.type === "solid" ? parsed.color : defaultColor,
                  )
                : {
                    type: "gradient",
                    mode: "linear",
                    angle: 135,
                    stops: [
                      { color: parsed?.type === "solid" ? parsed.color : defaultColor, position: 0 },
                      { color: defaultColor, position: 100 },
                    ],
                  }
          }
          brandingConstraints={brandingGradient}
          onBindEyedropper={bindEyedropper}
          onChange={(f) =>
            onChange(serializeFill(brandingGradient ? normalizeBrandingGradient(f) : f))
          }
          onPreviewChange={
            brandingGradient && onPreviewChange
              ? (f) => onPreviewChange(serializeFill(normalizeBrandingGradient(f)))
              : undefined
          }
        />

      )}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={isDefault} title="Reset to default">
          <RotateCcw className="mr-1 size-3" />
          Reset
        </Button>
        <EyedropperButton onPick={(hex) => eyedropperPickRef.current(hex)} />
      </div>
    </div>
  );
}

/* ── Solid editor (existing UI) ───────────────────────────────────────── */

function SolidEditor({
  hex,
  presets,
  onChange,
}: {
  hex: string;
  presets: ColorPreset[];
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<ColorViewMode>("picker");
  const hslObj = hexToHsl(hex);
  const [hexInput, setHexInput] = useState(hex);
  const [rgbInput, setRgbInput] = useState(hslToRgbStr(hslObj));

  useEffect(() => {
    const h = hexToHsl(hex);
    setHexInput(hex);
    setRgbInput(hslToRgbStr(h));
  }, [hex]);

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as ColorViewMode)} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="picker">Picker</TabsTrigger>
        <TabsTrigger value="presets">Presets</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
      </TabsList>

      <TabsContent value="picker" className="space-y-3 pt-2">
        <div className="flex justify-center rounded-lg border border-border bg-background/50 p-3">
          <HslColorPicker color={hslObj} onChange={(c) => onChange(hslToHex(c))} />
        </div>
      </TabsContent>

      <TabsContent value="presets" className="pt-2">
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onChange(preset.hex)}
              className="flex flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-accent group"
              title={preset.name}
              type="button"
            >
              <div
                className={`${PRESET_SWATCH_CLASS} border-2 transition-transform group-hover:scale-105 ${
                  hex.toLowerCase() === preset.hex.toLowerCase() ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
                style={{ backgroundColor: preset.hex }}
              />
              <span className="text-xs capitalize text-muted-foreground">{preset.name}</span>
            </button>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="manual" className="space-y-4 pt-2">
        <div className="space-y-2">
          <Label className="text-xs">HEX</Label>
          <Input
            value={hexInput}
            onChange={(e) => {
              const v = e.target.value;
              setHexInput(v);
              if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
            }}
            placeholder="#000000"
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">RGB</Label>
          <Input
            value={rgbInput}
            onChange={(e) => {
              const v = e.target.value;
              setRgbInput(v);
              if (/^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(v)) {
                const parts = v.split(",").map((p) => parseInt(p.trim()));
                if (parts.every((p) => p >= 0 && p <= 255)) {
                  const hexV = `#${parts.map((p) => p.toString(16).padStart(2, "0")).join("")}`;
                  onChange(hexV);
                }
              }
            }}
            placeholder="255, 255, 255"
            className="font-mono"
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}

/* ── Gradient editor ──────────────────────────────────────────────────── */

type BrandingCommit = boolean | "sample";

/** Throttle expensive parent commits while keeping a trailing flush on release. */
function useSampledCommit(fn: () => void, intervalMs = 120) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const lastRunRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const sample = useCallback(() => {
    dirtyRef.current = true;
    const now = Date.now();
    const elapsed = now - lastRunRef.current;
    if (elapsed >= intervalMs) {
      lastRunRef.current = now;
      dirtyRef.current = false;
      fnRef.current();
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!dirtyRef.current) return;
        lastRunRef.current = Date.now();
        dirtyRef.current = false;
        fnRef.current();
      }, intervalMs - elapsed);
    }
  }, [intervalMs]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
    lastRunRef.current = Date.now();
    fnRef.current();
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { sample, flush, cancel };
}

/** Range input with local live value; optional sampled commits while dragging. */
function LiveRangeSlider({
  value,
  min,
  max,
  onLiveChange,
  onSample,
  onCommit,
  onInteractionStart,
  onInteractionEnd,
  className,
}: {
  value: number;
  min: number;
  max: number;
  onLiveChange: (v: number) => void;
  onSample?: () => void;
  onCommit: (v: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  className?: string;
}) {
  const draggingRef = useRef(false);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const onInteractionEndRef = useRef(onInteractionEnd);
  const [local, setLocal] = useState(value);

  valueRef.current = value;
  onCommitRef.current = onCommit;
  onInteractionEndRef.current = onInteractionEnd;

  useEffect(() => {
    if (!draggingRef.current) setLocal(value);
  }, [value]);

  useEffect(() => {
    const end = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      onCommitRef.current(valueRef.current);
      onInteractionEndRef.current?.();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={local}
      className={className}
      onPointerDown={() => {
        draggingRef.current = true;
        onInteractionStart?.();
      }}
      onChange={(e) => {
        const v = Number(e.target.value);
        valueRef.current = v;
        setLocal(v);
        onLiveChange(v);
        if (draggingRef.current) onSample?.();
      }}
    />
  );
}

function GradientEditor({
  fill,
  onChange,
  onPreviewChange,
  onBindEyedropper,
  brandingConstraints = false,
}: {
  fill: GradientFill;
  onChange: (f: GradientFill) => void;
  onPreviewChange?: (f: GradientFill) => void;
  onBindEyedropper?: (pick: (hex: string) => void) => void;
  brandingConstraints?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [viewMode, setViewMode] = useState<ColorViewMode>("picker");
  const [morePresetsOpen, setMorePresetsOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [draftFill, setDraftFill] = useState(() =>
    brandingConstraints ? normalizeBrandingGradient(fill) : fill,
  );
  const draftRef = useRef(draftFill);
  draftRef.current = draftFill;
  const interactingRef = useRef(false);

  useEffect(() => {
    if (!brandingConstraints || interactingRef.current) return;
    const next = normalizeBrandingGradient(fill);
    draftRef.current = next;
    setDraftFill(next);
  }, [fill, brandingConstraints]);

  const workingFill = brandingConstraints ? draftFill : fill;
  const stops = brandingConstraints ? workingFill.stops : fill.stops;
  const activeFill = brandingConstraints ? { ...workingFill, mode: "linear" as const } : fill;
  const activeStop = stops[Math.min(selected, stops.length - 1)] ?? stops[0];
  const baseStop = stops[0];
  const pickerHsl = brandingConstraints ? hexToHsl(baseStop.color) : hexToHsl(activeStop.color);
  const blendDepth = brandingConstraints ? brandingBlendDepthFromStops(stops) : 0;

  const previewCss = fillToCss(activeFill);

  const previewDraft = useCallback(() => {
    if (!brandingConstraints || !onPreviewChange) return;
    onPreviewChange(normalizeBrandingGradient(draftRef.current));
  }, [brandingConstraints, onPreviewChange]);

  const commitDraft = useCallback(() => {
    if (!brandingConstraints) return;
    const next = normalizeBrandingGradient(draftRef.current);
    draftRef.current = next;
    setDraftFill(next);
    onChange(next);
  }, [brandingConstraints, onChange]);

  const { sample: samplePreview, cancel: cancelPreview } = useSampledCommit(previewDraft, 120);

  const startInteraction = useCallback(() => {
    interactingRef.current = true;
  }, []);

  const endInteraction = useCallback(() => {
    interactingRef.current = false;
    if (!brandingConstraints) return;
    cancelPreview();
    commitDraft();
  }, [brandingConstraints, cancelPreview, commitDraft]);

  const applyFill = (next: GradientFill, commit: BrandingCommit = true) => {
    const normalized = brandingConstraints ? normalizeBrandingGradient(next) : next;
    if (brandingConstraints) {
      draftRef.current = normalized;
      setDraftFill(normalized);
      if (commit === false) return;
      if (commit === "sample") {
        samplePreview();
        return;
      }
    }
    onChange(normalized);
  };

  const emitChange = (next: GradientFill) => applyFill(next, true);

  const setStops = (nextStops: GradientStop[], commit: BrandingCommit = true) => {
    const sorted = [...nextStops].sort((a, b) => a.position - b.position);
    applyFill({ ...workingFill, stops: sorted }, commit);
  };

  const updateStop = (idx: number, patch: Partial<GradientStop>, commit: BrandingCommit = true) => {
    const next = stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setStops(next, commit);
  };

  const updateBaseColor = (
    hsl: { h: number; s: number; l: number },
    commit: BrandingCommit = true,
  ) => {
    const side = brandingLightnessSide(hsl.l);
    const l0 = Math.max(
      brandingLightnessBounds(side).min,
      Math.min(brandingLightnessBounds(side).max, hsl.l),
    );
    const anchor = { h: hsl.h, s: hsl.s, l: l0 };
    const depth = brandingBlendDepthFromStops(stops);
    const l1 = brandingBlendLightness(l0, depth);
    const end = stops[1] ?? { color: stops[0].color, position: 100 };
    applyFill({
      ...workingFill,
      mode: "linear",
      stops: [
        { ...stops[0], color: hslToHex(anchor) },
        { ...end, color: hslToHex({ h: anchor.h, s: anchor.s, l: l1 }) },
      ],
    }, commit);
  };

  const updateBlendDepth = (depth: number, commit: BrandingCommit = true) => {
    const anchor = hexToHslParts(stops[0].color);
    if (!anchor) return;
    const side = brandingLightnessSide(anchor.l);
    const l0 = Math.max(
      brandingLightnessBounds(side).min,
      Math.min(brandingLightnessBounds(side).max, anchor.l),
    );
    const l1 = brandingBlendLightness(l0, depth);
    const end = stops[1] ?? { color: stops[0].color, position: 100 };
    applyFill({
      ...workingFill,
      mode: "linear",
      stops: [
        stops[0],
        { ...end, color: hslToHex({ h: anchor.h, s: anchor.s, l: l1 }) },
      ],
    }, commit);
  };

  useEffect(() => {
    onBindEyedropper?.((hex) => {
      if (brandingConstraints) {
        const picked = hexToHslParts(hex);
        if (!picked) return;
        const side = brandingLightnessSide(picked.l);
        const l0 = Math.max(
          brandingLightnessBounds(side).min,
          Math.min(brandingLightnessBounds(side).max, picked.l),
        );
        updateBaseColor({ h: picked.h, s: picked.s, l: l0 }, true);
        return;
      }
      emitChange({
        ...workingFill,
        stops: stops.map((s, i) => (i === selected ? { ...s, color: hex } : s)),
      });
    });
  }, [workingFill, selected, onBindEyedropper, brandingConstraints, stops]);

  const updateBrandingStopPosition = (idx: number, position: number, commit: BrandingCommit = true) => {
    const clamped = Math.max(0, Math.min(100, Math.round(position)));
    if (stops.length !== 2) {
      updateStop(idx, { position: clamped }, commit);
      return;
    }
    const otherPos = stops[idx === 0 ? 1 : 0].position;
    const minGap = 4;
    const nextPos =
      idx === 0
        ? Math.min(clamped, otherPos - minGap)
        : Math.max(clamped, otherPos + minGap);
    updateStop(idx, { position: Math.max(0, Math.min(100, nextPos)) }, commit);
  };

  const addStopAt = (position: number) => {
    if (brandingConstraints) return;
    const color = interpolateColor(stops, position);
    const next = [...stops, { color, position }];
    emitChange({ ...workingFill, stops: next.sort((a, b) => a.position - b.position) });
    setSelected(
      next.sort((a, b) => a.position - b.position)
        .findIndex((s) => s.position === position && s.color === color),
    );
  };

  const removeStop = (idx: number) => {
    if (brandingConstraints || stops.length <= 2) return;
    const next = stops.filter((_, i) => i !== idx);
    emitChange({ ...workingFill, stops: next });
    setSelected(Math.max(0, idx - 1));
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    if ((e.target as HTMLElement).closest("[data-stop-handle]")) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    if (brandingConstraints) {
      setSelected(0);
      updateBrandingStopPosition(0, pos, true);
      return;
    }
    addStopAt(pos);
  };

  const applyPreset = (preset: GradientPreset) => {
    setSelected(0);
    emitChange(preset.fill);
  };

  const setBaseHex = (hex: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    if (brandingConstraints) {
      const parts = hexToHslParts(hex);
      if (parts) updateBaseColor(parts, true);
      return;
    }
    updateStop(0, { color: hex });
  };

  const setBlendEndHex = (hex: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    const end = stops[1] ?? { color: hex, position: 100 };
    emitChange({
      ...workingFill,
      stops: [stops[0], { ...end, color: hex }],
    });
  };

  return (
    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ColorViewMode)} className="w-full min-w-0">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="picker">Picker</TabsTrigger>
        <TabsTrigger value="presets">Presets</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
      </TabsList>

      <TabsContent value="picker" className="space-y-3 min-w-0 pt-2">
        {/* Base color */}
        <div className="space-y-2">
          {brandingConstraints && (
            <>
              <Label className="text-xs">Base color</Label>
              <p className="text-[10px] text-muted-foreground">
                Pick the base color below.
              </p>
            </>
          )}
          <div
            className="rounded-md border border-border bg-background/50 p-2 flex justify-center"
            onPointerDown={() => {
              if (!brandingConstraints) return;
              startInteraction();
              const end = () => {
                endInteraction();
                window.removeEventListener("pointerup", end);
                window.removeEventListener("pointercancel", end);
              };
              window.addEventListener("pointerup", end);
              window.addEventListener("pointercancel", end);
            }}
          >
            <HslColorPicker
              color={pickerHsl}
              onChange={(c) =>
                brandingConstraints
                  ? updateBaseColor(c, "sample")
                  : updateStop(selected, { color: hslToHex(c) })
              }
            />
          </div>
        </div>

        {/* Stops */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Stops</Label>
            {!brandingConstraints && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={stops.length <= 2}
                  onClick={() => removeStop(selected)}
                  title="Remove selected stop"
                >
                  <Minus className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => addStopAt(50)}
                  title="Add stop at 50%"
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            )}
          </div>
          {brandingConstraints && (
            <p className="text-[10px] text-muted-foreground">
              Drag stops to set where the blend starts and ends.
            </p>
          )}
          <div
            ref={trackRef}
            onPointerDown={onTrackPointerDown}
            className={cn(
              "relative h-8 rounded-md border border-border touch-none",
              brandingConstraints ? "" : "cursor-crosshair",
            )}
            style={{ background: previewCss }}
          >
            {stops.map((s, i) => (
              <StopHandle
                key={i}
                trackRef={trackRef}
                index={i}
                selected={i === selected}
                stop={s}
                label={brandingConstraints ? (i === 0 ? "Base color" : "Blend end") : `Stop ${i + 1}`}
                onSelect={() => setSelected(i)}
                onDrag={(nextPos, drop) => {
                  if (drop) removeStop(i);
                  else if (brandingConstraints) updateBrandingStopPosition(i, nextPos, "sample");
                  else updateStop(i, { position: nextPos });
                }}
                onDragStart={brandingConstraints ? startInteraction : undefined}
                onDragEnd={brandingConstraints ? endInteraction : undefined}
                canRemove={!brandingConstraints && stops.length > 2}
              />
            ))}
          </div>
          {!brandingConstraints && (
            <p className="text-[10px] text-muted-foreground">
              Click the track to add. Drag a stop up/down to remove (min 2).
            </p>
          )}
        </div>

        {/* Blend depth */}
        {brandingConstraints && (
          <div className="space-y-1.5">
            <Label className="text-xs">Blend depth</Label>
            <p className="text-[10px] text-muted-foreground">
              How strong the fade is between stops.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground">Subtle</span>
              <LiveRangeSlider
                min={BRANDING_BLEND_DEPTH_MIN}
                max={BRANDING_BLEND_DEPTH_MAX}
                value={blendDepth}
                onLiveChange={(d) => updateBlendDepth(d, false)}
                onSample={onPreviewChange ? samplePreview : undefined}
                onCommit={(d) => updateBlendDepth(d, false)}
                onInteractionStart={startInteraction}
                onInteractionEnd={endInteraction}
                className="min-w-0 flex-1 w-full accent-foreground"
              />
              <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">Strong</span>
            </div>
          </div>
        )}

        {/* Angle */}
        <div className="space-y-2 min-w-0">
          {!brandingConstraints && (
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              <button
                type="button"
                className={cn(
                  "px-2 py-1 rounded-sm",
                  fill.mode === "linear" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => emitChange({ ...fill, mode: "linear" })}
              >
                Linear
              </button>
              <button
                type="button"
                className={cn(
                  "px-2 py-1 rounded-sm",
                  fill.mode === "radial" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => emitChange({ ...fill, mode: "radial" })}
              >
                Radial
              </button>
            </div>
          )}
          {(brandingConstraints || workingFill.mode === "linear") && (
            <div className="space-y-1">
              {brandingConstraints && <Label className="text-xs">Angle</Label>}
              <div className="flex items-center gap-2 min-w-0 w-full">
                {brandingConstraints ? (
                  <LiveRangeSlider
                    min={0}
                    max={360}
                    value={workingFill.angle}
                    onLiveChange={(v) => applyFill({ ...workingFill, angle: v }, false)}
                    onSample={onPreviewChange ? samplePreview : undefined}
                    onCommit={(v) => applyFill({ ...workingFill, angle: v }, false)}
                    onInteractionStart={startInteraction}
                    onInteractionEnd={endInteraction}
                    className="min-w-0 flex-1 w-full accent-foreground"
                  />
                ) : (
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={fill.angle}
                    onChange={(e) => emitChange({ ...fill, angle: Number(e.target.value) })}
                    className="min-w-0 flex-1 w-full accent-foreground"
                  />
                )}
                <div className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round(workingFill.angle)}°
                </div>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="presets" className="pt-2">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {GRADIENT_PRESET_DEFAULTS.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.name}
                onClick={() => applyPreset(p)}
                className={`${PRESET_SWATCH_CLASS} border border-border transition-transform hover:scale-105`}
                style={{ background: fillToCss(p.fill) }}
              />
            ))}
          </div>

          <Collapsible open={morePresetsOpen} onOpenChange={setMorePresetsOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              <span>Browse more</span>
              <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", morePresetsOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
              {GRADIENT_SAFE_PRESET_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.presets.map((p) => (
                      <button
                        key={`${group.label}-${p.name}`}
                        type="button"
                        title={p.name}
                        onClick={() => applyPreset(p)}
                        className={`${PRESET_SWATCH_CLASS} border border-border transition-transform hover:scale-105`}
                        style={{ background: fillToCss(p.fill) }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </TabsContent>

      <TabsContent value="manual" className="space-y-4 pt-2">
        {brandingConstraints ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Base</Label>
              <Input
                value={baseStop.color}
                onChange={(e) => setBaseHex(e.target.value)}
                placeholder="#000000"
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Blend end</Label>
              <Input
                value={stops[1]?.color ?? baseStop.color}
                onChange={(e) => setBlendEndHex(e.target.value)}
                placeholder="#000000"
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Depth</Label>
              <Input
                type="number"
                min={BRANDING_BLEND_DEPTH_MIN}
                max={BRANDING_BLEND_DEPTH_MAX}
                value={blendDepth}
                onChange={(e) => {
                  const d = Math.max(
                    BRANDING_BLEND_DEPTH_MIN,
                    Math.min(BRANDING_BLEND_DEPTH_MAX, Number(e.target.value) || BRANDING_BLEND_DEPTH_MIN),
                  );
                  updateBlendDepth(d, true);
                }}
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Stops</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={stops[0].position}
                  onChange={(e) => updateBrandingStopPosition(0, Number(e.target.value) || 0, true)}
                  className="font-mono text-xs h-8"
                  placeholder="Start %"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={stops[1]?.position ?? 100}
                  onChange={(e) => updateBrandingStopPosition(1, Number(e.target.value) || 100, true)}
                  className="font-mono text-xs h-8"
                  placeholder="End %"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Angle</Label>
              <Input
                type="number"
                min={0}
                max={360}
                value={Math.round(workingFill.angle)}
                onChange={(e) => {
                  const angle = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                  applyFill({ ...workingFill, angle }, true);
                }}
                className="font-mono text-xs h-8"
              />
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              <button
                type="button"
                className={cn(
                  "px-2 py-1 rounded-sm",
                  fill.mode === "linear" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => emitChange({ ...fill, mode: "linear" })}
              >
                Linear
              </button>
              <button
                type="button"
                className={cn(
                  "px-2 py-1 rounded-sm",
                  fill.mode === "radial" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => emitChange({ ...fill, mode: "radial" })}
              >
                Radial
              </button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Angle</Label>
              <Input
                type="number"
                min={0}
                max={360}
                value={Math.round(fill.angle)}
                onChange={(e) => {
                  const angle = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                  emitChange({ ...fill, angle });
                }}
                className="font-mono text-xs h-8"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs">Stops</Label>
              {stops.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem] gap-2">
                  <Input
                    value={s.color}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return;
                      updateStop(i, { color: v });
                    }}
                    placeholder="#000000"
                    className="font-mono text-xs h-8"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={s.position}
                    onChange={(e) => updateStop(i, { position: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className="font-mono text-xs h-8"
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

function StopHandle({
  trackRef,
  index,
  selected,
  stop,
  label,
  onSelect,
  onDrag,
  onDragStart,
  onDragEnd,
  canRemove,
}: {
  trackRef: React.RefObject<HTMLDivElement | null>;
  index: number;
  selected: boolean;
  stop: GradientStop;
  label: string;
  onSelect: () => void;
  onDrag: (nextPosition: number, drop: boolean) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  canRemove: boolean;
}) {
  const onDragRef = useRef(onDrag);
  const onDragEndRef = useRef(onDragEnd);
  onDragRef.current = onDrag;
  onDragEndRef.current = onDragEnd;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    onDragStart?.();
    const startY = e.clientY;
    const pointerId = e.pointerId;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const parent = trackRef.current?.getBoundingClientRect();
      if (!parent) return;
      const pos = Math.round(((ev.clientX - parent.left) / parent.width) * 100);
      onDragRef.current(Math.max(0, Math.min(100, pos)), false);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const dy = Math.abs(ev.clientY - startY);
      if (canRemove && dy > 30) onDragRef.current(stop.position, true);
      else onDragEndRef.current?.();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    e.currentTarget.setPointerCapture(pointerId);
  };

  return (
    <button
      type="button"
      data-stop-handle="1"
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2 -translate-x-1/2 size-4 rounded-full border-2 shadow-sm touch-none cursor-grab active:cursor-grabbing",
        selected ? "border-foreground ring-2 ring-foreground/30" : "border-white",
      )}
      style={{ left: `${stop.position}%`, background: stop.color }}
      title={label}
      aria-label={label}
    />
  );
}

function interpolateColor(stops: GradientStop[], position: number): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  if (position <= sorted[0].position) return sorted[0].color;
  if (position >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (position >= a.position && position <= b.position) {
      const t = (position - a.position) / (b.position - a.position);
      return lerpHex(a.color, b.color, t);
    }
  }
  return sorted[0].color;
}
function lerpHex(a: string, b: string, t: number): string {
  const pa = parseHex(a), pb = parseHex(b);
  const to = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${to(pa.r + (pb.r - pa.r) * t)}${to(pa.g + (pb.g - pa.g) * t)}${to(pa.b + (pb.b - pa.b) * t)}`;
}
function parseHex(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export default ColorPickerCard;
