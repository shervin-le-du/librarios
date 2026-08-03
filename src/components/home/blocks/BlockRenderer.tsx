import { Clock, MapPin, Phone, Mail, Languages, Megaphone, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InlineText, InlineMultiline } from "@/components/home/InlineEditable";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSignedHeroImage } from "@/lib/use-current-library";
import { toast } from "sonner";
import { CtaBlock } from "./CtaBlock";
import { FeaturedBookBlock } from "./FeaturedBookBlock";
import type { Block } from "./types";

type Ctx = {
  libraryId: string;
  libContact: {
    address: string | null;
    phone: string | null;
    email: string | null;
    languages: string[] | null;
  };
  editMode: boolean;
  onChange: (nextProps: any) => void;
};

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-transparent", className)}>
      <div className="max-w-5xl mx-auto px-6 py-14">{children}</div>
    </section>
  );
}

function AnnouncementBlock({ block, editMode, onChange }: { block: Extract<Block, { type: "announcement" }>; editMode: boolean; onChange: (p: any) => void }) {
  const visible = block.props.visible !== false;
  if (!editMode && (!visible || !block.props.text?.trim())) return null;
  return (
    <div className="relative bg-transparent text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-start gap-3 text-sm">
        <Megaphone className="size-4 mt-0.5 shrink-0 text-primary" />
        {editMode ? (
          <div className="flex-1 flex items-start gap-3">
            <InlineText
              value={block.props.text ?? ""}
              onCommit={(v) => onChange({ ...block.props, text: v })}
              editing
              placeholder="Add an announcement…"
              className="flex-1 text-foreground/90"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 pt-0.5">
              <span>Show</span>
              <Switch checked={visible} onCheckedChange={(v) => onChange({ ...block.props, visible: v })} />
            </label>
          </div>
        ) : (
          <span className="text-foreground/90">{block.props.text}</span>
        )}
      </div>
    </div>
  );
}

function AboutBlock({ block, editMode, onChange }: { block: Extract<Block, { type: "about" }>; editMode: boolean; onChange: (p: any) => void }) {
  if (!editMode && !block.props.text?.trim()) return null;
  return (
    <Section className="relative text-foreground">
      <div className="grid md:grid-cols-3 gap-10">
        <InlineText
          as="h2"
          value={block.props.heading ?? "About"}
          onCommit={(v) => onChange({ ...block.props, heading: v })}
          editing={editMode}
          placeholder="About"
          className="text-2xl font-semibold md:col-span-1"
        />
        <div className="md:col-span-2 text-base leading-relaxed text-foreground/80">
          <InlineMultiline
            value={block.props.text ?? ""}
            onCommit={(v) => onChange({ ...block.props, text: v })}
            editing={editMode}
            placeholder="Write a short introduction to your library…"
            rows={5}
          />
        </div>
      </div>
    </Section>
  );
}

function InfoCard({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function VisitBlock({ block, ctx }: { block: Extract<Block, { type: "visit" }>; ctx: Ctx }) {
  const { libContact, editMode, onChange } = ctx;
  const hasAny =
    !!block.props.hours?.trim() || !!libContact.address || !!libContact.phone || !!libContact.email || (libContact.languages?.length ?? 0) > 0;
  if (!editMode && !hasAny) return null;
  return (
    <Section className="relative text-foreground">
      <InlineText
        as="h2"
        value={block.props.heading ?? "Visit us"}
        onCommit={(v) => onChange({ ...block.props, heading: v })}
        editing={editMode}
        placeholder="Visit us"
        className="text-2xl font-semibold mb-8"
      />
      <div className="grid sm:grid-cols-2 gap-6">
        {(editMode || block.props.hours?.trim()) && (
          <InfoCard icon={Clock} label="Opening hours">
            <InlineMultiline
              value={block.props.hours ?? ""}
              onCommit={(v) => onChange({ ...block.props, hours: v })}
              editing={editMode}
              placeholder={"Mon–Fri  9:00 – 18:00\nSat       10:00 – 16:00\nSun       Closed"}
              rows={4}
            />
          </InfoCard>
        )}
        {libContact.address && (
          <InfoCard icon={MapPin} label="Address">
            <p className="whitespace-pre-line">{libContact.address}</p>
          </InfoCard>
        )}
        {libContact.phone && (
          <InfoCard icon={Phone} label="Phone">
            <a href={`tel:${libContact.phone}`} className="hover:underline">{libContact.phone}</a>
          </InfoCard>
        )}
        {libContact.email && (
          <InfoCard icon={Mail} label="Email">
            <a href={`mailto:${libContact.email}`} className="hover:underline break-all">{libContact.email}</a>
          </InfoCard>
        )}
        {(libContact.languages?.length ?? 0) > 0 && (
          <InfoCard icon={Languages} label="Languages">
            <p>{libContact.languages!.join(", ")}</p>
          </InfoCard>
        )}
      </div>
      {editMode && (
        <p className="text-xs text-muted-foreground mt-6">
          Address, phone, email, and languages come from Settings → General.
        </p>
      )}
    </Section>
  );
}

function RichTextBlock({ block, editMode, onChange }: { block: Extract<Block, { type: "rich_text" }>; editMode: boolean; onChange: (p: any) => void }) {
  if (!editMode && !block.props.heading?.trim() && !block.props.text?.trim()) return null;
  return (
    <Section className="relative text-foreground">
      {(editMode || block.props.heading?.trim()) && (
        <InlineText
          as="h2"
          value={block.props.heading ?? ""}
          onCommit={(v) => onChange({ ...block.props, heading: v })}
          editing={editMode}
          placeholder="Section heading"
          className="text-2xl font-semibold mb-6"
        />
      )}
      <div className="text-base leading-relaxed max-w-3xl text-foreground/80">
        <InlineMultiline
          value={block.props.text ?? ""}
          onCommit={(v) => onChange({ ...block.props, text: v })}
          editing={editMode}
          placeholder="Write something…"
          rows={4}
        />
      </div>
    </Section>
  );
}

function ImageBlock({ block, ctx }: { block: Extract<Block, { type: "image" }>; ctx: Ctx }) {
  const { libraryId, editMode, onChange } = ctx;
  const path = block.props.path ?? null;
  const signed = useSignedHeroImage(path);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image is too large (max 8 MB)."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const next = `${libraryId}/block-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("library-home-images").upload(next, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      if (path && path !== next) await supabase.storage.from("library-home-images").remove([path]);
      onChange({ ...block.props, path: next });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  async function onRemove() {
    if (path) await supabase.storage.from("library-home-images").remove([path]);
    onChange({ ...block.props, path: null });
  }

  if (!editMode && !path) return null;
  return (
    <section className="relative bg-transparent text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="relative rounded-lg overflow-hidden bg-muted aspect-[16/7]">
          {path ? (
            signed.data ? (
              <img src={signed.data} alt={block.props.caption ?? ""} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Loader2 className="size-4 animate-spin" /></div>
            )
          ) : editMode ? (
            <div className="w-full h-full border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImagePlus className="size-6" />
              <span className="text-sm font-medium">Add an image</span>
            </div>
          ) : null}
          {editMode && (
            <div className="absolute top-3 right-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <ImagePlus className="size-3.5" /> {path ? "Replace" : "Add image"}
              </Button>
              {path && (
                <Button size="sm" variant="destructive" onClick={onRemove}>
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
        </div>
        {(editMode || block.props.caption?.trim()) && (
          <div className="mt-3 text-sm text-center text-muted-foreground">
            <InlineText
              value={block.props.caption ?? ""}
              onCommit={(v) => onChange({ ...block.props, caption: v })}
              editing={editMode}
              placeholder="Add a caption (optional)…"
            />
          </div>
        )}
      </div>
    </section>
  );
}

export function BlockRenderer({ block, ctx }: { block: Block; ctx: Ctx }) {
  const onChange = (nextProps: any) => ctx.onChange(nextProps);
  switch (block.type) {
    case "announcement":
      return <AnnouncementBlock block={block} editMode={ctx.editMode} onChange={onChange} />;
    case "about":
      return <AboutBlock block={block} editMode={ctx.editMode} onChange={onChange} />;
    case "visit":
      return <VisitBlock block={block} ctx={ctx} />;
    case "rich_text":
      return <RichTextBlock block={block} editMode={ctx.editMode} onChange={onChange} />;
    case "image":
      return <ImageBlock block={block} ctx={ctx} />;
    case "cta":
      return <CtaBlock block={block} editMode={ctx.editMode} onChange={onChange} />;
    case "featured_book":
      return <FeaturedBookBlock block={block} editMode={ctx.editMode} libraryId={ctx.libraryId} onChange={onChange} />;
    default:
      return null;
  }
}
