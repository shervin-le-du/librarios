import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, Palette, Type as TypeIcon, Square, ChevronDown } from "lucide-react";
import { useCurrentLibrary, useSignedLogo } from "@/lib/use-current-library";
import {
  FONT_PRESETS,
  BUTTON_SHAPES,
  BUTTON_SHAPE_RADIUS,
  migrateLegacyButtonShape,
  useSignedBrandingAsset,
  COLOR_PRIMARY_PRESETS,
  COLOR_ACCENT_PRESETS,
  COLOR_BACKGROUND_PRESETS,
  COLOR_FOREGROUND_PRESETS,
  COLOR_CARD_PRESETS,
  COLOR_MUTED_PRESETS,
  COLOR_BORDER_PRESETS,
  COLOR_SIDEBAR_PRESETS,
  COLOR_NAVBAR_PRESETS,
  COLOR_DESTRUCTIVE_PRESETS,
  COLOR_SUCCESS_PRESETS,
  COLOR_WARNING_PRESETS,
  COLOR_BUTTON_BG_PRESETS,
  COLOR_BUTTON_FG_PRESETS,
  COLOR_BUTTON_SECONDARY_BG_PRESETS,
  COLOR_BUTTON_SECONDARY_FG_PRESETS,
  COLOR_BUTTON_DESTRUCTIVE_BG_PRESETS,
  COLOR_BUTTON_DESTRUCTIVE_FG_PRESETS,
  applyBrandingToDocument,
  type ButtonShape,
  type LibraryBranding,
} from "@/lib/branding";
import { ColorPickerCard } from "@/components/ColorPickerCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IconPickerPanel } from "./IconPicker";
import { DynamicIcon, type IconName } from "@/lib/dynamic-icon";



import { cn } from "@/lib/utils";

const TABS = [
  { id: "logos", label: "Logos", icon: ImageIcon },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "typography", label: "Typography", icon: TypeIcon },
  { id: "buttons", label: "Buttons", icon: Square },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function LibraryBrandingSection() {
  const lib = useCurrentLibrary();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("logos");

  const branding: LibraryBranding = useMemo(
    () => ((lib.data as any)?.branding as LibraryBranding) ?? {},
    [lib.data],
  );

  const save = useMutation({
    mutationFn: async (patch: Partial<LibraryBranding>) => {
      if (!lib.data) throw new Error("No library");
      const next = { ...branding, ...patch };
      const { error } = await supabase
        .from("libraries")
        .update({ branding: next as any })
        .eq("id", lib.data.id);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-library"] });
      qc.invalidateQueries({ queryKey: ["tenant-library"] });
      qc.invalidateQueries({ queryKey: ["public-home"] });
      qc.invalidateQueries({ queryKey: ["branding-asset-signed"] });
      toast.success("Branding saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!lib.data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Branding</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Logos, colors, typography, and button styling for your public library pages.
        </p>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors",
                tab === t.id
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "logos" && (
        <LogosTab
          libraryId={lib.data.id}
          legacyLogoPath={lib.data.logo_url}
          branding={branding}
          onSave={(patch) => save.mutate(patch)}
        />
      )}
      {tab === "colors" && (
        <ColorsTab
          branding={branding}
          fallbackPrimary={lib.data.brand_color ?? undefined}
          onSave={(patch) => save.mutate(patch)}
          isSaving={save.isPending}
        />
      )}
      {tab === "typography" && (
        <TypographyTab
          branding={branding}
          onSave={(patch) => save.mutate(patch)}
          isSaving={save.isPending}
        />
      )}
      {tab === "buttons" && (
        <ButtonsTab
          branding={branding}
          onSave={(patch) => save.mutate(patch)}
          isSaving={save.isPending}
        />
      )}
    </section>
  );
}

/* ---------------- Logos ---------------- */

function LogosTab({
  libraryId,
  legacyLogoPath,
  branding,
  onSave,
}: {
  libraryId: string;
  legacyLogoPath: string | null | undefined;
  branding: LibraryBranding;
  onSave: (patch: Partial<LibraryBranding>) => void;
}) {
  const qc = useQueryClient();
  const legacyLogo = useSignedLogo(legacyLogoPath);
  const favicon = useSignedBrandingAsset(branding.favicon_url ?? null);
  const social = useSignedBrandingAsset(branding.social_image_url ?? null);

  async function uploadLegacyLogo(file: File) {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${libraryId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("library-logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    if (legacyLogoPath && legacyLogoPath !== path) {
      await supabase.storage.from("library-logos").remove([legacyLogoPath]);
    }
    const { error } = await supabase.from("libraries").update({ logo_url: path }).eq("id", libraryId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["current-library"] });
    qc.invalidateQueries({ queryKey: ["tenant-library"] });
    qc.invalidateQueries({ queryKey: ["public-home"] });
    qc.invalidateQueries({ queryKey: ["logo-signed"] });
    toast.success("Logo updated");
  }

  async function removeLegacyLogo() {
    if (!legacyLogoPath) return;
    await supabase.storage.from("library-logos").remove([legacyLogoPath]);
    await supabase.from("libraries").update({ logo_url: null }).eq("id", libraryId);
    qc.invalidateQueries({ queryKey: ["current-library"] });
    qc.invalidateQueries({ queryKey: ["tenant-library"] });
    qc.invalidateQueries({ queryKey: ["public-home"] });
    toast.success("Logo removed");
  }

  async function uploadBrandingAsset(kind: "favicon_url" | "social_image_url", file: File) {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${libraryId}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("library-branding")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    const prev = branding[kind];
    if (prev && !/^https?:\/\//i.test(prev)) {
      await supabase.storage.from("library-branding").remove([prev]);
    }
    onSave({ [kind]: path } as Partial<LibraryBranding>);
    qc.invalidateQueries({ queryKey: ["branding-asset-signed"] });
  }

  async function clearBrandingAsset(kind: "favicon_url" | "social_image_url") {
    const prev = branding[kind];
    if (prev && !/^https?:\/\//i.test(prev)) {
      await supabase.storage.from("library-branding").remove([prev]);
    }
    onSave({ [kind]: null } as Partial<LibraryBranding>);
  }

  const brandPrimary = branding.primary || "#0a2540";

  return (
    <div className="space-y-6">
      <LogoRow
        title="Primary logo"
        description="Shown on your public homepage header and emails."
        previewUrl={legacyLogo.data ?? null}
        onUpload={uploadLegacyLogo}
        onRemove={legacyLogoPath ? removeLegacyLogo : undefined}
        iconName={branding.logo_icon_name ?? null}
        iconColor={branding.logo_icon_color ?? null}
        defaultIconColor={brandPrimary}
        onIconChange={(patch) => onSave({
          ...(patch.icon_name !== undefined ? { logo_icon_name: patch.icon_name } : {}),
          ...(patch.icon_color !== undefined ? { logo_icon_color: patch.icon_color } : {}),
        })}
      />
      <LogoRow
        title="Favicon"
        description="Small icon shown in browser tabs. Square PNG works best."
        previewUrl={favicon.data ?? null}
        onUpload={(f) => uploadBrandingAsset("favicon_url", f)}
        onRemove={branding.favicon_url ? () => clearBrandingAsset("favicon_url") : undefined}
        thumbClass="size-14"
        iconName={branding.favicon_icon_name ?? null}
        iconColor={branding.favicon_icon_color ?? null}
        defaultIconColor={brandPrimary}
        onIconChange={(patch) => onSave({
          ...(patch.icon_name !== undefined ? { favicon_icon_name: patch.icon_name } : {}),
          ...(patch.icon_color !== undefined ? { favicon_icon_color: patch.icon_color } : {}),
        })}
      />
      <LogoRow
        title="Social preview image"
        description="Shown when your library link is shared. 1200×630 recommended."
        previewUrl={social.data ?? null}
        onUpload={(f) => uploadBrandingAsset("social_image_url", f)}
        onRemove={branding.social_image_url ? () => clearBrandingAsset("social_image_url") : undefined}
        thumbClass="w-40 h-24"
        iconName={branding.social_icon_name ?? null}
        iconColor={branding.social_icon_color ?? null}
        defaultIconColor={brandPrimary}
        onIconChange={(patch) => onSave({
          ...(patch.icon_name !== undefined ? { social_icon_name: patch.icon_name } : {}),
          ...(patch.icon_color !== undefined ? { social_icon_color: patch.icon_color } : {}),
        })}
      />
    </div>
  );
}

function LogoRow({
  title, description, previewUrl, onUpload, onRemove, thumbClass = "size-20",
  iconName, iconColor, defaultIconColor, onIconChange, iconBgClass,
}: {
  title: string;
  description: string;
  previewUrl: string | null;
  onUpload: (file: File) => void;
  onRemove?: () => void;
  thumbClass?: string;
  iconName: string | null;
  iconColor: string | null;
  defaultIconColor: string;
  onIconChange: (patch: { icon_name?: string | null; icon_color?: string | null }) => void;
  iconBgClass?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const initialMode: "image" | "icon" = iconName && !previewUrl ? "icon" : "image";
  const [mode, setMode] = useState<"image" | "icon">(initialMode);
  useEffect(() => {
    // Sync mode when the underlying data changes (e.g. after upload/clear)
    if (iconName && !previewUrl) setMode("icon");
    else if (previewUrl && !iconName) setMode("image");
  }, [iconName, previewUrl]);

  const activeIconColor = iconColor || defaultIconColor;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-5 flex-wrap">
        <div className={cn("rounded-md border overflow-hidden flex items-center justify-center shrink-0", iconBgClass ?? "bg-muted", thumbClass)}>
          {mode === "icon" && iconName ? (
            <DynamicIcon name={iconName as IconName} color={activeIconColor} strokeWidth={1.75} className="w-1/2 h-1/2" />
          ) : previewUrl ? (
            <img src={previewUrl} alt={title} className="object-contain w-full h-full" />
          ) : (
            <span className="text-xs text-muted-foreground px-2 text-center">None</span>
          )}
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className="font-medium">{title}</div>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>

          {/* Mode tabs */}
          <div className="mt-3 inline-flex rounded-md border p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => setMode("image")}
              className={cn(
                "px-3 py-1 text-xs rounded-[5px] transition-colors",
                mode === "image" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Upload image
            </button>
            <button
              type="button"
              onClick={() => setMode("icon")}
              className={cn(
                "px-3 py-1 text-xs rounded-[5px] transition-colors",
                mode === "icon" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Choose icon
            </button>
          </div>

          {mode === "image" ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                ref={ref}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = ""; } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
                <Upload className="size-4" /> Upload
              </Button>
              {onRemove && (
                <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                  <X className="size-4" /> Remove
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <IconPickerPanel
                iconName={iconName}
                color={iconColor}
                defaultColor={defaultIconColor}
                onChange={onIconChange}
              />
              {iconName && (
                <div className="mt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onIconChange({ icon_name: null })}>
                    <X className="size-4" /> Clear icon
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Colors ---------------- */

type BrandField = "primary" | "accent";

type AdvancedColorField = "card" | "muted" | "border" | "sidebar" | "navbar";

type FeedbackField = "destructive" | "success" | "warning";

const BRAND_DEFAULTS: Record<BrandField, string> = {
  primary: "#0a2540",
  accent: "#f59e0b",
};

const ADVANCED_DEFAULTS: Record<AdvancedColorField, string> = {
  card: "#ffffff",
  muted: "#f1efe9",
  border: "#e5e7eb",
  sidebar: "#ffffff",
  navbar: "#ffffff",
};

const BACKGROUND_DEFAULT = "#ffffff";
const FOREGROUND_DEFAULT = "#0f172a";

const FEEDBACK_DEFAULTS: Record<FeedbackField, string> = {
  destructive: "#dc2626",
  success: "#059669",
  warning: "#f59e0b",
};

/** Omit picker placeholder defaults so applyBrandingToDocument can derive from background. */
function optionalBrandingColor(
  saved: string | undefined | null,
  current: string,
  defaultColor: string,
): string | undefined {
  if (saved) return current || undefined;
  if (current !== defaultColor) return current || undefined;
  return undefined;
}

function ColorsTab({
  branding, fallbackPrimary, onSave, isSaving,
}: {
  branding: LibraryBranding;
  fallbackPrimary?: string;
  onSave: (patch: Partial<LibraryBranding>) => void;
  isSaving: boolean;
}) {
  const brandDefaults = useMemo<Record<BrandField, string>>(
    () => ({ ...BRAND_DEFAULTS, primary: fallbackPrimary || BRAND_DEFAULTS.primary }),
    [fallbackPrimary],
  );

  const [brand, setBrand] = useState<Record<BrandField, string>>(() => ({
    primary: branding.primary ?? brandDefaults.primary,
    accent: branding.accent ?? brandDefaults.accent,
  }));
  const [background, setBackground] = useState(branding.background ?? BACKGROUND_DEFAULT);
  const [feedback, setFeedback] = useState<Record<FeedbackField, string>>(() => ({
    destructive: branding.destructive ?? FEEDBACK_DEFAULTS.destructive,
    success: branding.success ?? FEEDBACK_DEFAULTS.success,
    warning: branding.warning ?? FEEDBACK_DEFAULTS.warning,
  }));
  const [advanced, setAdvanced] = useState({
    card: branding.card ?? ADVANCED_DEFAULTS.card,
    muted: branding.muted ?? ADVANCED_DEFAULTS.muted,
    border: branding.border ?? ADVANCED_DEFAULTS.border,
    sidebar: branding.sidebar ?? ADVANCED_DEFAULTS.sidebar,
    navbar: branding.navbar ?? ADVANCED_DEFAULTS.navbar,
    foreground: branding.foreground ?? FOREGROUND_DEFAULT,
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setBrand({
      primary: branding.primary ?? brandDefaults.primary,
      accent: branding.accent ?? brandDefaults.accent,
    });
    setBackground(branding.background ?? BACKGROUND_DEFAULT);
    setFeedback({
      destructive: branding.destructive ?? FEEDBACK_DEFAULTS.destructive,
      success: branding.success ?? FEEDBACK_DEFAULTS.success,
      warning: branding.warning ?? FEEDBACK_DEFAULTS.warning,
    });
    setAdvanced({
      card: branding.card ?? ADVANCED_DEFAULTS.card,
      muted: branding.muted ?? ADVANCED_DEFAULTS.muted,
      border: branding.border ?? ADVANCED_DEFAULTS.border,
      sidebar: branding.sidebar ?? ADVANCED_DEFAULTS.sidebar,
      navbar: branding.navbar ?? ADVANCED_DEFAULTS.navbar,
      foreground: branding.foreground ?? FOREGROUND_DEFAULT,
    });
  }, [branding, brandDefaults]);

  const setBrandField = (k: BrandField) => (v: string) => setBrand((prev) => ({ ...prev, [k]: v }));
  const setAdvancedField = (k: keyof typeof advanced) => (v: string) =>
    setAdvanced((prev) => ({ ...prev, [k]: v }));
  const setFb = (k: FeedbackField) => (v: string) => setFeedback((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    applyBrandingToDocument({
      ...branding,
      ...brand,
      background,
      ...feedback,
      card: optionalBrandingColor(branding.card, advanced.card, ADVANCED_DEFAULTS.card),
      muted: optionalBrandingColor(branding.muted, advanced.muted, ADVANCED_DEFAULTS.muted),
      border: optionalBrandingColor(branding.border, advanced.border, ADVANCED_DEFAULTS.border),
      sidebar: optionalBrandingColor(branding.sidebar, advanced.sidebar, ADVANCED_DEFAULTS.sidebar),
      navbar: optionalBrandingColor(branding.navbar, advanced.navbar, ADVANCED_DEFAULTS.navbar),
      foreground: optionalBrandingColor(branding.foreground, advanced.foreground, FOREGROUND_DEFAULT),
    });
    return () => { applyBrandingToDocument(branding); };
  }, [brand, background, feedback, advanced, branding]);

  const Section = ({ title, description, children }: {
    title: string; description: string; children: React.ReactNode;
  }) => (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );

  return (
    <div className="space-y-8">
      <Section title="Brand" description="Primary brand color and secondary accent for highlights, CTAs, focus rings, and chips.">
        <ColorPickerCard label="Primary" color={brand.primary} presets={COLOR_PRIMARY_PRESETS}
          onChange={setBrandField("primary")} defaultColor={brandDefaults.primary} allowGradient />
        {/* UI label "Secondary" maps to stored key accent — intentional; drives highlights/CTA/ring */}
        <ColorPickerCard label="Secondary" color={brand.accent} presets={COLOR_ACCENT_PRESETS}
          onChange={setBrandField("accent")} defaultColor={brandDefaults.accent} allowGradient />
      </Section>

      <Section title="Background" description="Page background. Card, muted, border, and chrome derive from this when unset.">
        <ColorPickerCard label="Page background" color={background} presets={COLOR_BACKGROUND_PRESETS}
          onChange={setBackground} defaultColor={BACKGROUND_DEFAULT} allowGradient />
      </Section>

      <Section title="Feedback" description="Status colors for alerts, badges, and banners. Optional overrides.">
        <ColorPickerCard label="Destructive" color={feedback.destructive} presets={COLOR_DESTRUCTIVE_PRESETS}
          onChange={setFb("destructive")} defaultColor={FEEDBACK_DEFAULTS.destructive} />
        <ColorPickerCard label="Warning" color={feedback.warning} presets={COLOR_WARNING_PRESETS}
          onChange={setFb("warning")} defaultColor={FEEDBACK_DEFAULTS.warning} />
        <ColorPickerCard label="Success" color={feedback.success} presets={COLOR_SUCCESS_PRESETS}
          onChange={setFb("success")} defaultColor={FEEDBACK_DEFAULTS.success} />
      </Section>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
          <span>Advanced</span>
          <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-6">
          <Section title="Surfaces" description="Override derived card, muted, and border colors.">
            <ColorPickerCard label="Card / Surface" color={advanced.card} presets={COLOR_CARD_PRESETS}
              onChange={setAdvancedField("card")} defaultColor={ADVANCED_DEFAULTS.card} allowGradient />
            <ColorPickerCard label="Muted" color={advanced.muted} presets={COLOR_MUTED_PRESETS}
              onChange={setAdvancedField("muted")} defaultColor={ADVANCED_DEFAULTS.muted} />
            <ColorPickerCard label="Border" color={advanced.border} presets={COLOR_BORDER_PRESETS}
              onChange={setAdvancedField("border")} defaultColor={ADVANCED_DEFAULTS.border} />
          </Section>
          <Section title="Chrome" description="Sidebar and navbar follow background when unset.">
            <ColorPickerCard label="Sidebar" color={advanced.sidebar} presets={COLOR_SIDEBAR_PRESETS}
              onChange={setAdvancedField("sidebar")} defaultColor={ADVANCED_DEFAULTS.sidebar} allowGradient />
            <ColorPickerCard label="Top navbar" color={advanced.navbar} presets={COLOR_NAVBAR_PRESETS}
              onChange={setAdvancedField("navbar")} defaultColor={ADVANCED_DEFAULTS.navbar} allowGradient />
          </Section>
          <Section title="Text" description="Body text derives from background contrast when unset.">
            <ColorPickerCard label="Foreground (neutral)" color={advanced.foreground} presets={COLOR_FOREGROUND_PRESETS}
              onChange={setAdvancedField("foreground")} defaultColor={FOREGROUND_DEFAULT} />
          </Section>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end sticky bottom-0 bg-background/80 backdrop-blur py-2">
        <Button
          disabled={isSaving}
          onClick={() =>
            onSave({
              primary: brand.primary || undefined,
              accent: brand.accent || undefined,
              background: background || undefined,
              destructive: feedback.destructive || undefined,
              success: feedback.success || undefined,
              warning: feedback.warning || undefined,
              card: optionalBrandingColor(branding.card, advanced.card, ADVANCED_DEFAULTS.card),
              muted: optionalBrandingColor(branding.muted, advanced.muted, ADVANCED_DEFAULTS.muted),
              border: optionalBrandingColor(branding.border, advanced.border, ADVANCED_DEFAULTS.border),
              sidebar: optionalBrandingColor(branding.sidebar, advanced.sidebar, ADVANCED_DEFAULTS.sidebar),
              navbar: optionalBrandingColor(branding.navbar, advanced.navbar, ADVANCED_DEFAULTS.navbar),
              foreground: optionalBrandingColor(branding.foreground, advanced.foreground, FOREGROUND_DEFAULT),
            })
          }
        >
          {isSaving ? "Saving…" : "Save colors"}
        </Button>
      </div>
    </div>
  );
}


/* ---------------- Typography ---------------- */

function TypographyTab({
  branding, onSave, isSaving,
}: {
  branding: LibraryBranding;
  onSave: (patch: Partial<LibraryBranding>) => void;
  isSaving: boolean;
}) {
  const [heading, setHeading] = useState(branding.heading_font ?? "");
  const [body, setBody] = useState(branding.body_font ?? "");

  useEffect(() => {
    setHeading(branding.heading_font ?? "");
    setBody(branding.body_font ?? "");
  }, [branding]);

  useEffect(() => {
    applyBrandingToDocument({
      ...branding,
      heading_font: heading || undefined,
      body_font: body || undefined,
    });
    return () => { applyBrandingToDocument(branding); };
  }, [heading, body, branding]);

  return (
    <Card className="p-6 space-y-6">
      <FontPicker label="Heading font" value={heading} onChange={setHeading} sample="The quick brown fox" isHeading />
      <FontPicker label="Body font" value={body} onChange={setBody} sample="The quick brown fox jumps over the lazy dog." />
      <div className="flex justify-end">
        <Button
          disabled={isSaving}
          onClick={() => onSave({
            heading_font: heading || undefined,
            body_font: body || undefined,
          })}
        >
          {isSaving ? "Saving…" : "Save typography"}
        </Button>
      </div>
    </Card>
  );
}

function FontPicker({ label, value, onChange, sample, isHeading = false }: {
  label: string; value: string; onChange: (v: string) => void; sample: string; isHeading?: boolean;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {FONT_PRESETS.map((preset) => {
          const active = value === preset.family;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(active ? "" : preset.family)}
              className={cn(
                "text-left rounded-md border p-3 hover:border-primary/60 transition-colors",
                active && "border-primary bg-primary/5",
              )}
            >
              <link rel="stylesheet" href={preset.url} />
              <div className="text-xs text-muted-foreground">{preset.label}</div>
              <div
                className={cn("mt-1", isHeading ? "text-lg font-semibold" : "text-sm")}
                style={{ fontFamily: `"${preset.family}", sans-serif` }}
              >
                {sample}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Buttons ---------------- */

const BUTTON_COLOR_DEFAULTS = {
  primary: { bg: "#0a2540", fg: "#ffffff" },
  secondary: { bg: "#e2e8f0", fg: "#0f172a" },
  destructive: { bg: "#dc2626", fg: "#ffffff" },
} as const;

function MiniButtonPreview({
  label, bg, fg, shape, size = "md",
}: { label: string; bg: string; fg: string; shape: ButtonShape; size?: "sm" | "md" }) {
  const radius = BUTTON_SHAPE_RADIUS[shape];
  const base: React.CSSProperties = {
    borderRadius: radius,
    padding: size === "sm" ? "0.25rem 0.6rem" : "0.5rem 1rem",
    fontSize: size === "sm" ? "0.7rem" : "0.85rem",
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    cursor: "default",
    whiteSpace: "nowrap",
  };
  let style: React.CSSProperties;
  if (shape === "outline") {
    style = { ...base, background: "transparent", color: bg, border: `2px solid ${bg}` };
  } else if (shape === "soft") {
    style = { ...base, background: bg, color: fg, opacity: 0.85 };
  } else if (shape === "brutalist") {
    style = { ...base, background: bg, color: fg, border: `2px solid ${fg}`, boxShadow: `3px 3px 0 0 ${fg}` };
  } else {
    style = { ...base, background: bg, color: fg };
  }
  return <span style={style}>{label}</span>;
}

function ShapePicker({
  value, onChange, bg, fg,
}: { value: ButtonShape; onChange: (s: ButtonShape) => void; bg: string; fg: string }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {BUTTON_SHAPES.map((s) => {
        const selected = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-md border py-3 px-2 transition-colors",
              selected ? "border-foreground bg-muted" : "border-input hover:bg-muted/60",
            )}
          >
            {selected && (
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-foreground" />
            )}
            <MiniButtonPreview label="Button" bg={bg} fg={fg} shape={s.id} size="sm" />
            <span className="text-[11px] font-medium">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CompactColorField({
  label, color, onChange, defaultColor, presets, allowGradient,
}: {
  label: string;
  color: string;
  onChange: (v: string) => void;
  defaultColor: string;
  presets: typeof COLOR_BUTTON_BG_PRESETS;
  allowGradient?: boolean;
}) {
  const [hex, setHex] = useState(color);
  useEffect(() => setHex(color), [color]);
  const commit = (v: string) => {
    setHex(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
  };
  const isDefault = color.toLowerCase() === defaultColor.toLowerCase();
  const isGradient = typeof color === "string" && color.trim().startsWith("{");
  // For the swatch and text input we need a solid hex preview.
  let swatch = color;
  let inputVal = hex;
  if (isGradient) {
    try {
      const g = JSON.parse(color);
      const stops = g.stops ?? [];
      const parts = stops.map((s: any) => `${s.color} ${Math.round(s.position)}%`).join(", ");
      swatch = g.mode === "radial" ? `radial-gradient(circle, ${parts})` : `linear-gradient(${g.angle}deg, ${parts})`;
      inputVal = "gradient";
    } catch { /* noop */ }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(defaultColor)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="size-9 shrink-0 rounded-md border border-input"
              style={{ background: swatch }}
              aria-label={`Pick ${label} color`}
            />
          </PopoverTrigger>
          <PopoverContent className="w-[340px] p-0 border-none bg-transparent shadow-none" align="start">
            <ColorPickerCard
              label={label}
              color={color}
              presets={presets}
              onChange={onChange}
              defaultColor={defaultColor}
              allowGradient={allowGradient}
            />
          </PopoverContent>
        </Popover>
        <Input
          value={inputVal}
          disabled={isGradient}
          onChange={(e) => commit(e.target.value)}
          placeholder="#000000"
          className="font-mono h-9 text-sm"
        />
      </div>
    </div>
  );
}


function ButtonKindCard({
  title, shape, bg, fg, onShape,
}: {
  title: string;
  shape: ButtonShape;
  bg: string;
  fg: string;
  onShape: (s: ButtonShape) => void;
}) {
  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <MiniButtonPreview label={title} bg={bg} fg={fg} shape={shape} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Shape</Label>
        <ShapePicker value={shape} onChange={onShape} bg={bg} fg={fg} />
      </div>
    </Card>
  );
}

function ButtonsTab({
  branding, onSave, isSaving,
}: {
  branding: LibraryBranding;
  onSave: (patch: Partial<LibraryBranding>) => void;
  isSaving: boolean;
}) {
  const legacyShape = migrateLegacyButtonShape(branding.button_radius, branding.button_style);

  const [primaryShape, setPrimaryShape] = useState<ButtonShape>(branding.button_primary_style ?? legacyShape);
  const [secondaryShape, setSecondaryShape] = useState<ButtonShape>(branding.button_secondary_style ?? legacyShape);
  const [destructiveShape, setDestructiveShape] = useState<ButtonShape>(branding.button_destructive_style ?? legacyShape);

  const [primaryBg, setPrimaryBg] = useState(branding.button_bg ?? branding.primary ?? BUTTON_COLOR_DEFAULTS.primary.bg);
  const [primaryFg, setPrimaryFg] = useState(branding.button_fg ?? BUTTON_COLOR_DEFAULTS.primary.fg);
  const [secondaryBg, setSecondaryBg] = useState(branding.button_secondary_bg ?? BUTTON_COLOR_DEFAULTS.secondary.bg);
  const [secondaryFg, setSecondaryFg] = useState(branding.button_secondary_fg ?? BUTTON_COLOR_DEFAULTS.secondary.fg);
  const [destructiveBg, setDestructiveBg] = useState(
    branding.button_destructive_bg ?? branding.destructive ?? BUTTON_COLOR_DEFAULTS.destructive.bg,
  );
  const [destructiveFg, setDestructiveFg] = useState(branding.button_destructive_fg ?? BUTTON_COLOR_DEFAULTS.destructive.fg);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const previewPrimary = branding.button_bg ?? branding.primary ?? BUTTON_COLOR_DEFAULTS.primary.bg;
  const previewSecondary = branding.button_secondary_bg ?? BUTTON_COLOR_DEFAULTS.secondary.bg;
  const previewDestructive = branding.button_destructive_bg ?? branding.destructive ?? BUTTON_COLOR_DEFAULTS.destructive.bg;
  const previewPrimaryFg = branding.button_fg ?? BUTTON_COLOR_DEFAULTS.primary.fg;
  const previewSecondaryFg = branding.button_secondary_fg ?? BUTTON_COLOR_DEFAULTS.secondary.fg;
  const previewDestructiveFg = branding.button_destructive_fg ?? BUTTON_COLOR_DEFAULTS.destructive.fg;

  useEffect(() => {
    const l = migrateLegacyButtonShape(branding.button_radius, branding.button_style);
    setPrimaryShape(branding.button_primary_style ?? l);
    setSecondaryShape(branding.button_secondary_style ?? l);
    setDestructiveShape(branding.button_destructive_style ?? l);
    setPrimaryBg(branding.button_bg ?? branding.primary ?? BUTTON_COLOR_DEFAULTS.primary.bg);
    setPrimaryFg(branding.button_fg ?? BUTTON_COLOR_DEFAULTS.primary.fg);
    setSecondaryBg(branding.button_secondary_bg ?? BUTTON_COLOR_DEFAULTS.secondary.bg);
    setSecondaryFg(branding.button_secondary_fg ?? BUTTON_COLOR_DEFAULTS.secondary.fg);
    setDestructiveBg(branding.button_destructive_bg ?? branding.destructive ?? BUTTON_COLOR_DEFAULTS.destructive.bg);
    setDestructiveFg(branding.button_destructive_fg ?? BUTTON_COLOR_DEFAULTS.destructive.fg);
  }, [branding]);

  useEffect(() => {
    applyBrandingToDocument({
      ...branding,
      button_primary_style: primaryShape,
      button_secondary_style: secondaryShape,
      button_destructive_style: destructiveShape,
      button_bg: primaryBg,
      button_fg: primaryFg,
      button_secondary_bg: secondaryBg,
      button_secondary_fg: secondaryFg,
      button_destructive_bg: destructiveBg,
      button_destructive_fg: destructiveFg,
    });
    return () => { applyBrandingToDocument(branding); };
  }, [
    branding, primaryShape, secondaryShape, destructiveShape,
    primaryBg, primaryFg, secondaryBg, secondaryFg, destructiveBg, destructiveFg,
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ButtonKindCard
          title="Primary" shape={primaryShape} bg={previewPrimary} fg={previewPrimaryFg}
          onShape={setPrimaryShape}
        />
        <ButtonKindCard
          title="Secondary" shape={secondaryShape} bg={previewSecondary} fg={previewSecondaryFg}
          onShape={setSecondaryShape}
        />
        <ButtonKindCard
          title="Destructive" shape={destructiveShape} bg={previewDestructive} fg={previewDestructiveFg}
          onShape={setDestructiveShape}
        />
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
          <span>Advanced — button color overrides</span>
          <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              Override derived button colors. Leave at defaults to inherit from brand and feedback tokens.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <CompactColorField label="Primary background" color={primaryBg} onChange={setPrimaryBg}
                defaultColor={BUTTON_COLOR_DEFAULTS.primary.bg} presets={COLOR_BUTTON_BG_PRESETS} allowGradient />
              <CompactColorField label="Primary text" color={primaryFg} onChange={setPrimaryFg}
                defaultColor={BUTTON_COLOR_DEFAULTS.primary.fg} presets={COLOR_BUTTON_FG_PRESETS} />
              <CompactColorField label="Secondary background" color={secondaryBg} onChange={setSecondaryBg}
                defaultColor={BUTTON_COLOR_DEFAULTS.secondary.bg} presets={COLOR_BUTTON_SECONDARY_BG_PRESETS} allowGradient />
              <CompactColorField label="Secondary text" color={secondaryFg} onChange={setSecondaryFg}
                defaultColor={BUTTON_COLOR_DEFAULTS.secondary.fg} presets={COLOR_BUTTON_SECONDARY_FG_PRESETS} />
              <CompactColorField label="Destructive background" color={destructiveBg} onChange={setDestructiveBg}
                defaultColor={BUTTON_COLOR_DEFAULTS.destructive.bg} presets={COLOR_BUTTON_DESTRUCTIVE_BG_PRESETS} allowGradient />
              <CompactColorField label="Destructive text" color={destructiveFg} onChange={setDestructiveFg}
                defaultColor={BUTTON_COLOR_DEFAULTS.destructive.fg} presets={COLOR_BUTTON_DESTRUCTIVE_FG_PRESETS} />
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-end">
        <Button
          disabled={isSaving}
          onClick={() => {
            const derivedPrimaryBg = branding.primary ?? BUTTON_COLOR_DEFAULTS.primary.bg;
            const derivedDestructiveBg = branding.destructive ?? BUTTON_COLOR_DEFAULTS.destructive.bg;
            onSave({
              button_primary_style: primaryShape,
              button_secondary_style: secondaryShape,
              button_destructive_style: destructiveShape,
              button_bg: primaryBg !== derivedPrimaryBg ? primaryBg || undefined : undefined,
              button_fg: primaryFg !== BUTTON_COLOR_DEFAULTS.primary.fg ? primaryFg || undefined : undefined,
              button_secondary_bg: secondaryBg !== BUTTON_COLOR_DEFAULTS.secondary.bg ? secondaryBg || undefined : undefined,
              button_secondary_fg: secondaryFg !== BUTTON_COLOR_DEFAULTS.secondary.fg ? secondaryFg || undefined : undefined,
              button_destructive_bg: destructiveBg !== derivedDestructiveBg ? destructiveBg || undefined : undefined,
              button_destructive_fg: destructiveFg !== BUTTON_COLOR_DEFAULTS.destructive.fg ? destructiveFg || undefined : undefined,
              button_radius: undefined,
              button_style: undefined,
            });
          }}
        >
          {isSaving ? "Saving…" : "Save buttons"}
        </Button>
      </div>
    </div>
  );
}
