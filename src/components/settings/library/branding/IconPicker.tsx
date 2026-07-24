import { useEffect, useMemo, useState } from "react";
import { DynamicIcon, type IconName } from "@/lib/dynamic-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPickerCard } from "@/components/ColorPickerCard";
import { COLOR_PRIMARY_PRESETS } from "@/lib/branding";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: string; label: string; icons: IconName[] };

export const ICON_CATEGORIES: Category[] = [
  { id: "books", label: "Books", icons: ["book","book-open","book-open-text","book-marked","bookmark","library","library-big","book-copy","notebook","notebook-pen","book-text","book-heart","book-image","book-a","book-check","book-user"] },
  { id: "knowledge", label: "Knowledge", icons: ["graduation-cap","school","lightbulb","brain","glasses","scroll-text","file-text","newspaper","feather","pen-tool","pencil","notebook-text","scroll","sparkles"] },
  { id: "institution", label: "Institution", icons: ["landmark","building","building-2","castle","church","columns-3","warehouse","hotel","store"] },
  { id: "organization", label: "Organization", icons: ["users","user-check","handshake","briefcase","users-round","user","id-card","network"] },
  { id: "community", label: "Community", icons: ["messages-square","heart-handshake","coffee","map-pin","home","hand-heart","message-circle","smile","heart"] },
  { id: "law", label: "Law", icons: ["scale","gavel","shield-check","file-badge","shield","book-lock"] },
  { id: "medical", label: "Medical", icons: ["stethoscope","heart-pulse","cross","pill","syringe","activity","bandage","thermometer"] },
  { id: "science", label: "Science", icons: ["flask-conical","atom","microscope","telescope","dna","beaker","test-tube","test-tubes","orbit"] },
  { id: "music", label: "Music", icons: ["music","music-2","music-3","music-4","guitar","piano","mic","headphones","radio","disc","drum"] },
  { id: "film", label: "Film", icons: ["film","clapperboard","camera","video","popcorn","projector","tv"] },
  { id: "maritime", label: "Maritime", icons: ["ship","anchor","waves","sailboat","life-buoy","compass"] },
  { id: "nature", label: "Nature", icons: ["leaf","trees","tree-palm","tree-pine","flower","flower-2","sprout","sun","cloud","mountain","bird"] },
  { id: "arts", label: "Arts", icons: ["palette","paintbrush","paintbrush-vertical","brush","image","theater","drama","shapes"] },
  { id: "kids", label: "Kids", icons: ["baby","rocket","puzzle","toy-brick","gamepad-2","cake","party-popper","smile","star"] },
  { id: "religion", label: "Religion", icons: ["church","cross","sparkles","star","moon","sun"] },
  { id: "language", label: "Language", icons: ["languages","globe","message-circle","message-square","speech","type","text"] },
];

/**
 * Inline icon picker panel: category chips, search, grid, and color control.
 * Designed to sit inside a slot (e.g. a logo row), not as a standalone card.
 */
export function IconPickerPanel({
  iconName,
  color,
  defaultColor,
  onChange,
}: {
  iconName: string | null | undefined;
  color: string | null | undefined;
  defaultColor: string;
  onChange: (patch: { icon_name?: string | null; icon_color?: string | null }) => void;
}) {
  const activeColor = color || defaultColor;
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [hex, setHex] = useState(activeColor);
  useEffect(() => setHex(activeColor), [activeColor]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = category === "all"
      ? ICON_CATEGORIES.flatMap((c) => c.icons.map((n) => ({ n, cat: c.id })))
      : (ICON_CATEGORIES.find((c) => c.id === category)?.icons ?? []).map((n) => ({ n, cat: category }));
    const seen = new Set<string>();
    const unique = pool.filter(({ n }) => (seen.has(n) ? false : (seen.add(n), true)));
    if (!q) return unique;
    return unique.filter(({ n }) => n.includes(q));
  }, [category, query]);

  const commitHex = (v: string) => {
    setHex(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange({ icon_color: v });
  };

  return (
    <div className="space-y-3">
      {/* Color control */}
      <div className="space-y-1.5">
        <Label className="text-xs">Icon color</Label>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="size-9 shrink-0 rounded-md border border-input"
                style={{ backgroundColor: activeColor }}
                aria-label="Pick icon color"
              />
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0 border-none bg-transparent shadow-none" align="start">
              <ColorPickerCard
                label="Icon color"
                color={activeColor}
                presets={COLOR_PRIMARY_PRESETS}
                onChange={(v) => onChange({ icon_color: v })}
                defaultColor={defaultColor}
              />
            </PopoverContent>
          </Popover>
          <Input
            value={hex}
            onChange={(e) => commitHex(e.target.value)}
            placeholder="#000000"
            className="font-mono h-9 text-sm max-w-[140px]"
          />
          {color && color.toLowerCase() !== defaultColor.toLowerCase() && (
            <button
              type="button"
              onClick={() => onChange({ icon_color: null })}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>All</CategoryChip>
        {ICON_CATEGORIES.map((c) => (
          <CategoryChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.label}
          </CategoryChip>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          className="pl-8 h-9"
        />
      </div>

      {/* Icon grid */}
      <div className="max-h-56 overflow-y-auto rounded-md border p-2 bg-background">
        {visible.length === 0 ? (
          <div className="text-xs text-muted-foreground p-4 text-center">No icons match your search.</div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1">
            {visible.map(({ n }) => {
              const selected = iconName === n;
              return (
                <button
                  key={n}
                  type="button"
                  title={n}
                  onClick={() => onChange({ icon_name: n })}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-md border transition-colors",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:bg-muted",
                  )}
                >
                  <DynamicIcon
                    name={n as IconName}
                    size={18}
                    color={selected ? activeColor : "currentColor"}
                    strokeWidth={1.75}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 text-xs rounded-full border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-input hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export { DynamicIcon };
export type { IconName };
