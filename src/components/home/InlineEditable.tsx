import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
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

type MultilineProps = BaseProps & { rows?: number };

function autosizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

/** Multi-line inline textarea (blur commits; Escape reverts). */
export function InlineMultiline({
  value, onCommit, editing, placeholder = "Click to edit", className, style, as = "div", rows = 1, dark = false,
}: MultilineProps) {
  const Tag = as as any;
  const isHeadingTag = as === "h1" || as === "h2";
  const [local, setLocal] = useState(value);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const editableRef = useRef<HTMLElement>(null);
  useEffect(() => setLocal(value), [value]);

  useLayoutEffect(() => {
    if (!editing || !isHeadingTag) return;
    const el = editableRef.current;
    if (!el || document.activeElement === el) return;
    if (el.innerText !== value) el.innerText = value;
  }, [value, editing, isHeadingTag]);

  // Autosize textareas to content — no internal scrollbars.
  useEffect(() => {
    if (!editing || isHeadingTag) return;
    const el = taRef.current;
    if (!el) return;
    autosizeTextarea(el);
    const ro = new ResizeObserver(() => autosizeTextarea(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [local, editing, className, isHeadingTag]);

  if (!editing) {
    return <Tag className={cn("whitespace-pre-line", className)} style={style}>{value}</Tag>;
  }

  const editRing = cn(
    "outline-none rounded-md px-2 -mx-2 py-1 -my-1",
    "ring-1 ring-transparent hover:ring-border focus:ring-primary",
    dark ? "focus:bg-black/70" : "focus:bg-background",
    "transition-shadow",
  );

  if (isHeadingTag) {
    const isEmpty = !local.trim();
    return (
      <Tag
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        className={cn(
          "whitespace-pre-line",
          editRing,
          isEmpty && "ring-dashed ring-border empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60",
          dark && isEmpty && "empty:before:text-white/60",
          className,
        )}
        style={style}
        onInput={(e: FormEvent<HTMLElement>) => setLocal(e.currentTarget.innerText)}
        onBlur={(e: FocusEvent<HTMLElement>) => {
          const next = e.currentTarget.innerText;
          setLocal(next);
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
          if (e.key === "Escape") {
            e.preventDefault();
            const el = e.currentTarget;
            el.innerText = value;
            setLocal(value);
            el.blur();
          }
        }}
      />
    );
  }

  const isEmpty = !local.trim();
  const textarea = (
    <textarea
      ref={taRef}
      rows={rows}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        autosizeTextarea(e.target);
      }}
      onBlur={() => local !== value && onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === "Escape") { setLocal(value); (e.target as HTMLTextAreaElement).blur(); }
      }}
      placeholder={placeholder}
      className={cn(
        "block w-full resize-none overflow-hidden bg-transparent",
        editRing,
        dark ? "placeholder:text-white/60" : "placeholder:text-muted-foreground/60",
        "font-[inherit] text-[inherit] leading-[inherit] tracking-[inherit] whitespace-pre-line [text-align:inherit] [field-sizing:content]",
        isEmpty && "ring-dashed ring-border",
      )}
    />
  );

  return (
    <Tag className={cn("relative group", className)} style={style}>
      {textarea}
    </Tag>
  );
}
