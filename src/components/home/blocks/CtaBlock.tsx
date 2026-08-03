import { Link } from "@tanstack/react-router";
import { ArrowRight, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText, InlineMultiline } from "@/components/home/InlineEditable";
import { Button } from "@/components/ui/button";
import type { Block } from "./types";

type CtaBlockProps = {
  block: Extract<Block, { type: "cta" }>;
  editMode: boolean;
  onChange: (p: any) => void;
};

export function CtaBlock({ block, editMode, onChange }: CtaBlockProps) {
  const props = block.props;
  const href = props.href ?? "";
  const label = props.label?.trim() || "Learn more";
  const isExternal = /^https?:\/\//i.test(href);
  const align = props.align ?? "center";
  const background = props.background ?? "solid";

  if (!editMode && !props.heading?.trim() && !href.trim()) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden border-t",
        background === "gradient" && "bg-gradient-to-br from-cta-accent/20 via-cta-bg to-cta-bg",
        background === "solid" && "bg-cta-bg",
      )}
    >
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
            align === "right" && "ml-auto text-right",
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
                align === "right" && "ml-auto max-w-2xl",
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
              align === "right" && "flex justify-end",
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
                    align === "left" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground",
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
                    align === "center" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground",
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
                    align === "right" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground",
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
                    background === "solid" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground",
                  )}
                >
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...props, background: "gradient" })}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    background === "gradient" ? "bg-cta-accent text-cta-accent-foreground" : "text-cta-foreground/60 hover:text-cta-foreground",
                  )}
                >
                  Gradient
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
