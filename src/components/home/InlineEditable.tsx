import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type BaseProps = {
  value: string;
  onCommit: (next: string) => void;
  editing: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  as?: "h1" | "h2" | "p" | "span" | "div";
  dark?: boolean;
};

/** Single-line inline text (blur or Enter commits). */
export function InlineText({
  value, onCommit, editing, placeholder = "Click to edit", className, style, as = "span", dark = false,
}: BaseProps) {
  const Tag = as as any;
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => setLocal(value), [value]);

  if (!editing) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }

  const isEmpty = !local.trim();
  return (
    <Tag className={cn("relative group", className)} style={style}>
      <input
        ref={inputRef}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== value && onCommit(local)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setLocal(value); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full bg-transparent outline-none rounded-md px-2 -mx-2 py-1 -my-1",
          "ring-1 ring-transparent hover:ring-border focus:ring-primary",
          dark ? "focus:bg-black/70 placeholder:text-white/60" : "focus:bg-background placeholder:text-muted-foreground/60",
          "transition-shadow font-[inherit] text-[inherit] leading-[inherit] tracking-[inherit] [text-align:inherit]",
          isEmpty && "ring-dashed ring-border",
        )}
      />
    </Tag>
  );
}

type MultilineProps = Omit<BaseProps, "as"> & { rows?: number };

/** Multi-line inline textarea (blur commits; Escape reverts). */
export function InlineMultiline({
  value, onCommit, editing, placeholder = "Click to edit", className, style, rows = 3, dark = false,
}: MultilineProps) {
  const [local, setLocal] = useState(value);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setLocal(value), [value]);

  // Autosize
  useEffect(() => {
    if (!editing) return;
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [local, editing]);

  if (!editing) {
    return <div className={cn("whitespace-pre-line", className)} style={style}>{value}</div>;
  }

  const isEmpty = !local.trim();
  return (
    <textarea
      ref={taRef}
      rows={rows}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === "Escape") { setLocal(value); (e.target as HTMLTextAreaElement).blur(); }
      }}
      placeholder={placeholder}
      className={cn(
        "block w-full resize-none bg-transparent outline-none rounded-md px-2 -mx-2 py-1 -my-1",
        "ring-1 ring-transparent hover:ring-border focus:ring-primary",
        dark ? "focus:bg-black/70 placeholder:text-white/60" : "focus:bg-background placeholder:text-muted-foreground/60",
        "transition-shadow font-[inherit] text-[inherit] leading-[inherit] whitespace-pre-line [text-align:inherit]",
        isEmpty && "ring-dashed ring-border",
        className,
      )}
      style={style}
    />
  );
}
