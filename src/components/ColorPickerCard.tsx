import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HslColorPicker } from "react-colorful";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, Plus, Minus } from "lucide-react";
import { EyedropperButton } from "@/components/EyedropperButton";
import {
  fillToCss,
  parseFill,
  serializeFill,
  toEditableFill,
  GRADIENT_PRESETS,
  type Fill,
  type GradientFill,
  type GradientStop,
} from "@/lib/fill";
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
}

/* ── Component ────────────────────────────────────────────────────────── */

export function ColorPickerCard({
  label,
  color,
  presets,
  onChange,
  defaultColor,
  allowGradient = false,
}: ColorPickerCardProps) {
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
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
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
                  const grad: GradientFill = {
                    type: "gradient",
                    mode: "linear",
                    angle: 135,
                    stops: [
                      { color: base, position: 0 },
                      { color: "#ffffff", position: 100 },
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
              ? parsed
              : {
                  type: "gradient",
                  mode: "linear",
                  angle: 135,
                  stops: [
                    { color: parsed?.type === "solid" ? parsed.color : defaultColor, position: 0 },
                    { color: "#ffffff", position: 100 },
                  ],
                }
          }
          onBindEyedropper={bindEyedropper}
          onChange={(f) => onChange(serializeFill(f))}
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
        <div className="grid grid-cols-4 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onChange(preset.hex)}
              className="flex flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-accent group"
              title={preset.name}
              type="button"
            >
              <div
                className={`size-8 rounded border-2 transition-transform group-hover:scale-110 ${
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

function GradientEditor({
  fill,
  onChange,
  onBindEyedropper,
}: {
  fill: GradientFill;
  onChange: (f: GradientFill) => void;
  onBindEyedropper?: (pick: (hex: string) => void) => void;
}) {
  const [selected, setSelected] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const stops = fill.stops;
  const activeStop = stops[Math.min(selected, stops.length - 1)] ?? stops[0];
  const activeHsl = hexToHsl(activeStop.color);

  const previewCss = fillToCss(fill);

  useEffect(() => {
    onBindEyedropper?.((hex) => {
      onChange({
        ...fill,
        stops: fill.stops.map((s, i) => (i === selected ? { ...s, color: hex } : s)),
      });
    });
  }, [fill, selected, onChange, onBindEyedropper]);

  const setStops = (nextStops: GradientStop[]) => {
    const sorted = [...nextStops].sort((a, b) => a.position - b.position);
    onChange({ ...fill, stops: sorted });
  };

  const updateStop = (idx: number, patch: Partial<GradientStop>) => {
    const next = stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setStops(next);
  };

  const addStopAt = (position: number) => {
    const color = interpolateColor(stops, position);
    const next = [...stops, { color, position }];
    onChange({ ...fill, stops: next.sort((a, b) => a.position - b.position) });
    // Select the freshly added stop
    setSelected(next.sort((a, b) => a.position - b.position).findIndex((s) => s.position === position && s.color === color));
  };

  const removeStop = (idx: number) => {
    if (stops.length <= 2) return;
    const next = stops.filter((_, i) => i !== idx);
    onChange({ ...fill, stops: next });
    setSelected(Math.max(0, idx - 1));
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    if ((e.target as HTMLElement).dataset.stopHandle) return; // stop handle handles its own
    const rect = trackRef.current.getBoundingClientRect();
    const pos = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    addStopAt(Math.max(0, Math.min(100, pos)));
  };

  return (
    <div className="space-y-3">
      {/* Preview bar */}
      <div
        className="h-12 rounded-lg border-2 border-border"
        style={{ background: previewCss }}
      />

      {/* Stop track */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Stops</Label>
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
        </div>
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          className="relative h-8 rounded-md border border-border cursor-crosshair"
          style={{ background: previewCss }}
        >
          {stops.map((s, i) => (
            <StopHandle
              key={i}
              index={i}
              selected={i === selected}
              stop={s}
              onSelect={() => setSelected(i)}
              onDrag={(nextPos, drop) => {
                if (drop) removeStop(i);
                else updateStop(i, { position: nextPos });
              }}
              canRemove={stops.length > 2}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Click the track to add. Drag a stop up/down to remove (min 2).
        </p>
      </div>

      {/* Color picker for selected stop */}
      <div className="rounded-md border border-border bg-background/50 p-2 flex justify-center">
        <HslColorPicker color={activeHsl} onChange={(c) => updateStop(selected, { color: hslToHex(c) })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={activeStop.color}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) updateStop(selected, { color: v });
          }}
          placeholder="#000000"
          className="font-mono text-xs h-8"
        />
        <Input
          type="number"
          min={0}
          max={100}
          value={activeStop.position}
          onChange={(e) => updateStop(selected, { position: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
          className="font-mono text-xs h-8"
        />
      </div>

      {/* Mode + angle */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              "px-2 py-1 rounded-sm",
              fill.mode === "linear" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange({ ...fill, mode: "linear" })}
          >
            Linear
          </button>
          <button
            type="button"
            className={cn(
              "px-2 py-1 rounded-sm",
              fill.mode === "radial" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange({ ...fill, mode: "radial" })}
          >
            Radial
          </button>
        </div>
        {fill.mode === "linear" && (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={360}
              value={fill.angle}
              onChange={(e) => onChange({ ...fill, angle: Number(e.target.value) })}
              className="flex-1 accent-foreground"
            />
            <div className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(fill.angle)}°</div>
          </div>
        )}
      </div>

      {/* Presets */}
      <div>
        <Label className="text-xs mb-1.5 block">Presets</Label>
        <div className="grid grid-cols-6 gap-1.5">
          {GRADIENT_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.name}
              onClick={() => {
                setSelected(0);
                onChange({ ...p.fill });
              }}
              className="h-8 rounded border border-border transition-transform hover:scale-105"
              style={{ background: fillToCss(p.fill) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StopHandle({
  index,
  selected,
  stop,
  onSelect,
  onDrag,
  canRemove,
}: {
  index: number;
  selected: boolean;
  stop: GradientStop;
  onSelect: () => void;
  onDrag: (nextPosition: number, drop: boolean) => void;
  canRemove: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef<{ startX: number; startY: number; parent: DOMRect } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onSelect();
    const parent = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    draggingRef.current = { startX: e.clientX, startY: e.clientY, parent };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = draggingRef.current;
    if (!d) return;
    const pos = Math.round(((e.clientX - d.parent.left) / d.parent.width) * 100);
    onDrag(Math.max(0, Math.min(100, pos)), false);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = draggingRef.current;
    if (!d) return;
    const dy = Math.abs(e.clientY - d.startY);
    draggingRef.current = null;
    if (canRemove && dy > 30) {
      onDrag(stop.position, true);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      data-stop-handle="1"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-4 rounded-full border-2 shadow-sm cursor-grab active:cursor-grabbing",
        selected ? "border-foreground ring-2 ring-foreground/30" : "border-white",
      )}
      style={{ left: `${stop.position}%`, background: stop.color }}
      aria-label={`Stop ${index + 1}`}
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
