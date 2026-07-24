import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, AlignLeft, AlignCenter, AlignRight, Palette, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText, InlineMultiline } from "@/components/home/InlineEditable";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPickerCard } from "@/components/ColorPickerCard";
import { hexToHsl } from "@/lib/branding";
import { fillSolidHex, fillToCss, parseFill } from "@/lib/fill";
import type { Block } from "./types";


type CtaBlockProps = {
  block: Extract<Block, { type: "cta" }>;
  editMode: boolean;
  onChange: (p: any) => void;
};

// Foreground pair for a background hex — quick contrast heuristic.
function contrastForHex(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "0 0% 100%";
  const m = hsl.match(/([\d.]+)%\s*$/);
  const l = m ? parseFloat(m[1]) : 50;
  return l > 60 ? "222 47% 11%" : "0 0% 100%";
}

export function CtaBlock({ block, editMode, onChange }: CtaBlockProps) {
  const props = block.props;
  const [colorTab, setColorTab] = useState<0 | 1 | 2>(0);
  const href = props.href ?? "";
  const label = props.label?.trim() || "Learn more";
  const isExternal = /^https?:\/\//i.test(href);
  const align = props.align ?? "center";
  const background = props.background ?? "solid";
  const bgOverride = props.bg;
  const fgOverride = props.fg;
  const accentOverride = props.accent;
  const hasOverride = !!(bgOverride || fgOverride || accentOverride);

  if (!editMode && !props.heading?.trim() && !href.trim()) return null;

  // Build inline CSS variables that override the inherited CTA tokens
  // for just this block. When none are set, the block inherits branding.
  const overrideStyle: React.CSSProperties = {};
  let bgGradientCss: string | null = null;
  if (bgOverride) {
    const parsed = parseFill(bgOverride);
    const solidHex = fillSolidHex(bgOverride) ?? bgOverride;
    const h = hexToHsl(solidHex);
    if (h) {
      (overrideStyle as any)["--cta-bg"] = `hsl(${h})`;
      if (!fgOverride) (overrideStyle as any)["--cta-foreground"] = `hsl(${contrastForHex(solidHex)})`;
    }
    if (parsed?.type === "gradient") bgGradientCss = fillToCss(parsed);
  }
  if (fgOverride) {
    const h = hexToHsl(fillSolidHex(fgOverride) ?? fgOverride);
    if (h) (overrideStyle as any)["--cta-foreground"] = `hsl(${h})`;
  }
  if (accentOverride) {
    const solidHex = fillSolidHex(accentOverride) ?? accentOverride;
    const h = hexToHsl(solidHex);
    if (h) {
      (overrideStyle as any)["--cta-accent"] = `hsl(${h})`;
      (overrideStyle as any)["--cta-accent-foreground"] = `hsl(${contrastForHex(solidHex)})`;
    }
  }


  return (
    <section
      className={cn(
        "relative overflow-hidden",
        background === "gradient" && !bgGradientCss && "bg-gradient-to-br from-cta-accent/20 via-cta-bg to-cta-bg"
      )}
      style={{
        ...overrideStyle,
        backgroundColor: background === "solid" ? "var(--cta-bg)" : undefined,
        backgroundImage: bgGradientCss ?? undefined,
      }}
    >


      {/* Soft radial glows to add depth without breaking the dark palette */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle at 50% 0%, var(--cta-accent), transparent 35%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{ background: "radial-gradient(circle at 50% 100%, var(--cta-accent), transparent 25%)" }}
      />

      <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28">
        <div
          className={cn(
            "max-w-4xl",
            align === "center" && "mx-auto text-center",
            align === "left" && "text-left",
            align === "right" && "ml-auto text-right"
          )}
        >
          <InlineText
            as="h2"
            value={props.heading ?? ""}
            onCommit={(v) => onChange({ ...props, heading: v })}
            editing={editMode}
            dark
            placeholder="Compelling headline"
            className="text-4xl md:text-5xl font-bold leading-tight text-cta-foreground"
          />

          {(editMode || props.subtext?.trim()) && (
            <div
              className={cn(
                "mt-5 text-lg md:text-xl text-cta-foreground/80",
                align === "center" && "max-w-2xl mx-auto",
                align === "right" && "ml-auto max-w-2xl"
              )}
            >
              <InlineMultiline
                value={props.subtext ?? ""}
                onCommit={(v) => onChange({ ...props, subtext: v })}
                editing={editMode}
                dark
                placeholder="Short supporting text…"
                rows={2}
              />
            </div>
          )}

          <div
            className={cn(
              "mt-8",
              align === "center" && "flex justify-center",
              align === "left" && "flex justify-start",
              align === "right" && "flex justify-end"
            )}
          >
            {editMode ? (
              <div className="w-full max-w-md space-y-3 text-left">
                <label className="block text-xs font-medium text-cta-foreground/70">Button label</label>
                <InlineText
                  value={props.label ?? ""}
                  onCommit={(v) => onChange({ ...props, label: v })}
                  editing
                  dark
                  placeholder="Learn more"
                  className="block border border-cta-foreground/20 rounded-md px-3 py-2 text-cta-foreground"
                />
                <label className="block text-xs font-medium text-cta-foreground/70">Link (URL or /path)</label>
                <InlineText
                  value={props.href ?? ""}
                  onCommit={(v) => onChange({ ...props, href: v })}
                  editing
                  dark
                  placeholder="https://… or /contact"
                  className="block border border-cta-foreground/20 rounded-md px-3 py-2 text-cta-foreground"
                />
                <div>
                  <Button disabled className="mt-3 h-12 px-8 text-base gap-2 bg-cta-accent text-cta-accent-foreground shadow-lg shadow-cta-accent/25">
                    {label} <ArrowRight className="size-5" />
                  </Button>
                </div>
              </div>
            ) : href ? (
              isExternal ? (
                <Button
                  asChild
                  className="h-12 px-8 text-base gap-2 bg-cta-accent text-cta-accent-foreground shadow-lg shadow-cta-accent/25 transition-transform hover:-translate-y-0.5"
                >
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {label} <ArrowRight className="size-5" />
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  className="h-12 px-8 text-base gap-2 bg-cta-accent text-cta-accent-foreground shadow-lg shadow-cta-accent/25 transition-transform hover:-translate-y-0.5"
                >
                  <Link to={href}>
                    {label} <ArrowRight className="size-5" />
                  </Link>
                </Button>
              )
            ) : null}
          </div>

          {editMode && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 rounded-lg border border-cta-foreground/20 p-1">
                <button
                  type="button"
                  onClick={() => onChange({ ...props, align: "left" })}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    align === "left" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground"
                  )}
                  aria-label="Align left"
                >
                  <AlignLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...props, align: "center" })}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    align === "center" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground"
                  )}
                  aria-label="Align center"
                >
                  <AlignCenter className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...props, align: "right" })}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    align === "right" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground"
                  )}
                  aria-label="Align right"
                >
                  <AlignRight className="size-4" />
                </button>
              </div>

              <div className="inline-flex items-center gap-1 rounded-lg border border-cta-foreground/20 p-1">
                <button
                  type="button"
                  onClick={() => onChange({ ...props, background: "solid" })}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    background === "solid" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground"
                  )}
                >
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...props, background: "gradient" })}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    background === "gradient" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground"
                  )}
                >
                  Gradient
                </button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border border-cta-foreground/20 px-2.5 py-1.5 text-xs transition-colors",
                      hasOverride
                        ? "bg-cta-accent text-cta-accent-foreground"
                        : "text-cta-foreground/70 hover:text-cta-foreground"
                    )}
                  >
                    <Palette className="size-3.5" />
                    Colors
                    {hasOverride && <span className="ml-1 opacity-80">•</span>}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[340px] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Block colors</div>
                    {hasOverride && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = { ...props };
                          delete (next as any).bg;
                          delete (next as any).fg;
                          delete (next as any).accent;
                          onChange(next);
                        }}
                      >
                        Use branding
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    By default this block follows your library branding. Override the background, text, or accent for this CTA only.
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setColorTab((t) => ((t + 2) % 3) as 0 | 1 | 2)}
                      className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <div className="flex-1 text-center text-xs font-medium text-muted-foreground">
                      {colorTab === 0 ? "Background" : colorTab === 1 ? "Text" : "Accent"} · {colorTab + 1} / 3
                    </div>
                    <button
                      type="button"
                      onClick={() => setColorTab((t) => ((t + 1) % 3) as 0 | 1 | 2)}
                      className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                      aria-label="Next"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                  {colorTab === 0 ? (
                    <ColorPickerCard
                      label="Background"
                      color={bgOverride ?? "#0f172a"}
                      presets={[
                        { name: "navy", hex: "#0f172a" },
                        { name: "ink", hex: "#111827" },
                        { name: "graphite", hex: "#1e293b" },
                        { name: "midnight", hex: "#0a2540" },
                        { name: "forest", hex: "#064e3b" },
                        { name: "plum", hex: "#3b0764" },
                        { name: "cream", hex: "#faf7f2" },
                        { name: "white", hex: "#ffffff" },
                      ]}
                      onChange={(hex) => onChange({ ...props, bg: hex })}
                      defaultColor="#0f172a"
                      allowGradient
                    />

                  ) : colorTab === 1 ? (
                    <ColorPickerCard
                      label="Text"
                      color={fgOverride ?? "#ffffff"}
                      presets={[
                        { name: "white", hex: "#ffffff" },
                        { name: "cream", hex: "#faf7f2" },
                        { name: "ink", hex: "#111827" },
                        { name: "graphite", hex: "#1f2937" },
                        { name: "slate", hex: "#334155" },
                        { name: "mute", hex: "#64748b" },
                      ]}
                      onChange={(hex) => onChange({ ...props, fg: hex })}
                      defaultColor="#ffffff"
                    />
                  ) : (
                    <ColorPickerCard
                      label="Accent"
                      color={accentOverride ?? "#3b82f6"}
                      presets={[
                        { name: "sky", hex: "#3b82f6" },
                        { name: "amber", hex: "#f59e0b" },
                        { name: "emerald", hex: "#10b981" },
                        { name: "rose", hex: "#f43f5e" },
                        { name: "violet", hex: "#8b5cf6" },
                        { name: "white", hex: "#ffffff" },
                      ]}
                      onChange={(hex) => onChange({ ...props, accent: hex })}
                      defaultColor="#3b82f6"
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
