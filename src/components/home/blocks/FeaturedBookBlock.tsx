import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InlineText, InlineMultiline } from "@/components/home/InlineEditable";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSignedHeroImage } from "@/lib/use-current-library";
import { toast } from "sonner";
import type { Block } from "./types";

type Props = {
  block: Extract<Block, { type: "featured_book" }>;
  editMode: boolean;
  libraryId: string;
  onChange: (p: any) => void;
};

export function FeaturedBookBlock({ block, editMode, libraryId, onChange }: Props) {
  const p = block.props;
  const signed = useSignedHeroImage(p.image_path ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const hasContent =
    !!p.title?.trim() || !!p.author?.trim() || !!p.description?.trim() || !!p.image_path;

  const books = useQuery({
    queryKey: ["home-featured-book-picker", libraryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("id,title,author")
        .eq("library_id", libraryId)
        .order("title", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: editMode,
    staleTime: 60_000,
  });

  if (!editMode && !hasContent) return null;

  async function onPickBook(id: string) {
    if (!id) {
      onChange({ ...p, book_id: null });
      return;
    }
    const { data, error } = await supabase
      .from("books")
      .select("id,title,author")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Could not load book");
      return;
    }
    onChange({
      ...p,
      book_id: data.id,
      title: p.title?.trim() ? p.title : data.title ?? "",
      author: p.author?.trim() ? p.author : data.author ?? "",
    });
  }

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image is too large (max 8 MB)."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const next = `${libraryId}/book-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("library-home-images")
        .upload(next, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      if (p.image_path && p.image_path !== next) {
        await supabase.storage.from("library-home-images").remove([p.image_path]);
      }
      onChange({ ...p, image_path: next });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  async function onRemoveImage() {
    if (p.image_path) await supabase.storage.from("library-home-images").remove([p.image_path]);
    onChange({ ...p, image_path: null });
  }

  const ctaLabel = p.cta_label?.trim() || "See more";
  const href = (p.cta_href ?? "").trim();
  const isExternal = /^https?:\/\//i.test(href);

  return (
    <section className="relative bg-transparent text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {(editMode || p.intro?.trim()) && (
          <div className="uppercase tracking-widest text-xs font-medium mb-6 text-muted-foreground">
            <InlineText
              value={p.intro ?? ""}
              onCommit={(v) => onChange({ ...p, intro: v })}
              editing={editMode}
              placeholder="Featured this month"
            />
          </div>
        )}

        <div className="grid md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-2">
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-[2/3] shadow-lg mx-auto max-w-xs">
              {p.image_path ? (
                signed.data ? (
                  <img src={signed.data} alt={p.title ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Loader2 className="size-4 animate-spin" /></div>
                )
              ) : editMode ? (
                <div className="w-full h-full border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <BookOpen className="size-8" />
                  <span className="text-xs font-medium">Add a book cover</span>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <BookOpen className="size-10" />
                </div>
              )}
              {editMode && (
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <ImagePlus className="size-3.5" /> {p.image_path ? "Replace" : "Add cover"}
                  </Button>
                  {p.image_path && (
                    <Button size="sm" variant="destructive" onClick={onRemoveImage}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }}
              />
            </div>
          </div>

          <div className="md:col-span-3 space-y-4">
            {editMode && (
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <label className="text-xs text-muted-foreground shrink-0">
                  Prefill from library:
                </label>
                <select
                  value={p.book_id ?? ""}
                  onChange={(e) => onPickBook(e.target.value)}
                  className="flex-1 bg-transparent border border-input rounded-md px-2 py-1 text-sm text-foreground"
                >
                  <option value="">— Custom book —</option>
                  {(books.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}{b.author ? ` — ${b.author}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <InlineText
              as="h2"
              value={p.title ?? ""}
              onCommit={(v) => onChange({ ...p, title: v })}
              editing={editMode}
              placeholder="Book title"
              className="text-3xl md:text-4xl font-semibold leading-tight"
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {(editMode || p.author?.trim()) && (
                <InlineText
                  value={p.author ?? ""}
                  onCommit={(v) => onChange({ ...p, author: v })}
                  editing={editMode}
                  placeholder="Author"
                  className="font-medium"
                />
              )}
              {(editMode || p.year?.trim()) && (
                <>
                  {(p.author?.trim() || editMode) && <span className="opacity-40">·</span>}
                  <InlineText
                    value={p.year ?? ""}
                    onCommit={(v) => onChange({ ...p, year: v })}
                    editing={editMode}
                    placeholder="Year"
                  />
                </>
              )}
            </div>

            <div className="text-base leading-relaxed text-foreground/80">
              <InlineMultiline
                value={p.description ?? ""}
                onCommit={(v) => onChange({ ...p, description: v })}
                editing={editMode}
                placeholder="A short description of the book…"
                rows={4}
              />
            </div>

            {editMode ? (
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Button label</label>
                  <InlineText
                    value={p.cta_label ?? ""}
                    onCommit={(v) => onChange({ ...p, cta_label: v })}
                    editing
                    placeholder="See more"
                    className="block border border-input rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Link (URL or /path)</label>
                  <InlineText
                    value={p.cta_href ?? ""}
                    onCommit={(v) => onChange({ ...p, cta_href: v })}
                    editing
                    placeholder="https://… or /path"
                    className="block border border-input rounded-md px-3 py-2"
                  />
                </div>
              </div>
            ) : href ? (
              <div className="pt-2">
                {isExternal ? (
                  <Button asChild className="gap-2">
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {ctaLabel} <ArrowRight className="size-4" />
                    </a>
                  </Button>
                ) : (
                  <Button asChild className="gap-2">
                    <Link to={href}>
                      {ctaLabel} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
