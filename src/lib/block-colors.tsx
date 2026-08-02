import { useState } from "react";
import { Palette, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ColorPickerCard } from "@/components/ColorPickerCard";
import { hexToHsl } from "@/lib/branding";
import { fillSolidHex, fillToCss, parseFill } from "@/lib/fill";
import { cn } from "@/lib/utils";

export type BlockColorRole = "bg" | "fg" | "accent";

export type BlockColorProps = {
  bg?: string;
  fg?: string;
  accent?: string;
};

/** Quick contrast heuristic — pick near-black or near-white foreground for a hex background. */
export function contrastForHex(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "0 0% 100%";
  const m = hsl.match(/([\d.]+)%\s*$/);
  const l = m ? parseFloat(m[1]) : 50;
  return l > 60 ? "222 47% 11%" : "0 0% 100%";
}

/**
 * Returns a style object with CSS custom properties for a block.
 * Sets `--block-bg` (solid HSL) plus `--block-bg-image` (gradient CSS or `none`)
 * so consumers can `background-image: var(--block-bg-image, none)`.
 */
export function resolveBlockColors(p: BlockColorProps): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (p.bg) {
    const parsed = parseFill(p.bg);
    const solidHex = fillSolidHex(p.bg) ?? (typeof p.bg === "string" ? p.bg : null);
    if (solidHex) {
      const h = hexToHsl(solidHex);
      if (h) {
        (style as any)["--block-bg"] = `hsl(${h})`;
        if (!p.fg) (style as any)["--block-fg"] = `hsl(${contrastForHex(solidHex)})`;
      }
    }
    if (parsed?.type === "gradient") {
      (style as any)["--block-bg-image"] = fillToCss(parsed);
    }
  }
  if (p.fg) {
    const solidHex = fillSolidHex(p.fg) ?? p.fg;
    const h = hexToHsl(solidHex);
    if (h) (style as any)["--block-fg"] = `hsl(${h})`;
  }
  if (p.accent) {
    const solidHex = fillSolidHex(p.accent) ?? p.accent;
    const h = hexToHsl(solidHex);
    if (h) {
      (style as any)["--block-accent"] = `hsl(${h})`;
      (style as any)["--block-accent-foreground"] = `hsl(${contrastForHex(solidHex)})`;
    }
  }
  return style;
}


const ROLE_META: Record<
  BlockColorRole,
  { label: string; default: string; presets: { name: string; hex: string }[] }
> = {
  bg: {
    label: "Background",
    default: "#f7f5f0",
    presets: [
      { name: "background", hex: "#f7f5f0" },
      { name: "card", hex: "#e8e4dc" },
      { name: "muted", hex: "#edebe5" },
      { name: "primary", hex: "#0f1419" },
      { name: "sidebar", hex: "#f2f0eb" },
    ],
  },
  fg: {
    label: "Text",
    default: "#0f1419",
    presets: [
      { name: "foreground", hex: "#0f1419" },
      { name: "primary", hex: "#0f1419" },
      { name: "muted", hex: "#5c6670" },
      { name: "background", hex: "#f7f5f0" },
    ],
  },
  accent: {
    label: "Accent",
    default: "#5b6cff",
    presets: [
      { name: "accent", hex: "#5b6cff" },
      { name: "primary", hex: "#0f1419" },
      { name: "cta-accent", hex: "#3b82f6" },
      { name: "success", hex: "#2d9a6a" },
      { name: "warning", hex: "#e8a838" },
      { name: "destructive", hex: "#c53030" },
    ],
  },
};

/**
 * Palette trigger + paged popover with left/right arrows.
 * Renders one ColorPickerCard at a time to keep the surface compact.
 */
export function BlockColorsPopover({
  title = "Block colors",
  roles,
  values,
  onChange,
  className,
}: {
  title?: string;
  roles: BlockColorRole[];
  values: BlockColorProps;
  onChange: (next: BlockColorProps) => void;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, roles.length - 1);
  const role = roles[safeIdx];
  const meta = ROLE_META[role];
  const hasOverride = roles.some((r) => !!values[r]);

  function set(r: BlockColorRole, hex: string) {
    onChange({ ...values, [r]: hex });
  }
  function reset() {
    const next: BlockColorProps = { ...values };
    for (const r of roles) delete (next as any)[r];
    onChange(next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border bg-background/90 backdrop-blur-sm px-2.5 py-1 text-xs shadow-sm transition-colors",
            hasOverride
              ? "border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label="Block colors"
        >
          <Palette className="size-3.5" />
          Colors
          {hasOverride && <span className="ml-0.5 opacity-80">•</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={false}
        className="w-[340px] p-3 space-y-3 max-h-[calc(100svh-6rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >



        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          {hasOverride && (
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Use branding
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          By default this block follows your library branding. Override colors for this block only.
        </p>
        {roles.length > 1 && (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIdx((i) => (i - 1 + roles.length) % roles.length)}
              className="p-1.5 rounded-md border hover:bg-muted transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex-1 text-center text-xs font-medium text-muted-foreground">
              {meta.label} · {safeIdx + 1} / {roles.length}
            </div>
            <button
              type="button"
              onClick={() => setIdx((i) => (i + 1) % roles.length)}
              className="p-1.5 rounded-md border hover:bg-muted transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
        <ColorPickerCard
          label={meta.label}
          color={values[role] ?? meta.default}
          presets={meta.presets}
          onChange={(hex) => set(role, hex)}
          defaultColor={meta.default}
          allowGradient={role === "bg"}
        />

      </PopoverContent>
    </Popover>
  );
}
