import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSignedLogo, useSignedHeroImage } from "@/lib/use-current-library";
import { useAllStaff, rememberLibrarySlug, roleCan } from "@/lib/use-current-staff";
import { LibrarySwitcher } from "@/components/LibrarySwitcher";
import { PublishButton } from "@/components/publish/PublishButton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InlineMultiline } from "@/components/home/InlineEditable";
import { useHomeEditor } from "@/lib/use-home-editor";
import {
  BookOpen, ArrowRight,
  Pencil, Check, Loader2, X, ImagePlus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BlockList } from "@/components/home/blocks/BlockList";
import { ensureBlocks, type Block } from "@/components/home/blocks/types";
import { DynamicIcon, type IconName } from "@/lib/dynamic-icon";

type HomeConfig = {
  hero_heading?: string;
  hero_subheading?: string;
  hero_image_url?: string | null;
  about_text?: string;
  announcement?: string;
  announcement_visible?: boolean;
  hours?: string;
  published?: boolean;
  blocks?: Block[];
};

type PublicLibrary = {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  brand_color: string | null;
  languages: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  home_page_config: HomeConfig | null;
  status: string;
  patron_portal_enabled: boolean | null;
  visibility: "public" | "private" | null;
};

async function fetchPublicHome(slug: string): Promise<PublicLibrary | null> {
  const { data, error } = await supabase.rpc("get_library_public_home", { p_slug: slug });
  if (error) throw error;
  return ((data ?? [])[0] as PublicLibrary | undefined) ?? null;
}

export const Route = createFileRoute("/$slug/")({
  ssr: false,
  loader: async ({ params }) => {
    const lib = await fetchPublicHome(params.slug);
    if (!lib) throw notFound();
    return lib;
  },
  head: ({ loaderData }) => {
    const lib = loaderData as PublicLibrary | undefined;
    if (!lib) return { meta: [{ title: "Library" }] };
    const cfg = lib.home_page_config ?? {};
    const desc = (cfg.about_text ?? "").slice(0, 155) || `${lib.name} — public library page on LibrariOS.`;
    return {
      meta: [
        { title: `${lib.name}` },
        { name: "description", content: desc },
      ],
    };
  },
  component: PublicHomePage,
});

function PublicHomePage() {
  const { slug } = Route.useParams();
  const initial = Route.useLoaderData() as PublicLibrary;
  const { data: lib } = useQuery({
    queryKey: ["public-home", slug],
    queryFn: () => fetchPublicHome(slug),
    initialData: initial,
    staleTime: 30_000,
  });
  const logo = useSignedLogo(lib?.logo_url);
  const routeCtx = Route.useRouteContext() as any;
  const brandingCtx = (routeCtx?.tenantLibrary?.branding ?? null) as import("@/lib/branding").LibraryBranding | null;
  const all = useAllStaff();
  const staffHere = (all.data ?? []).find((r) => r.library_slug === slug);
  const canEdit = !!staffHere && roleCan(staffHere.role, "manage_settings");

  const [editMode, setEditMode] = useState(false);
  const { save, state: saveState } = useHomeEditor(lib?.id, lib?.home_page_config);

  const heroRef = useRef<HTMLElement>(null);
  // "Over hero" = the navbar area currently overlaps the hero section.
  // Only then should the navbar be transparent so the hero photo shows through.
  const [overHero, setOverHero] = useState(true);

  const hasHeroImage = !!lib?.home_page_config?.hero_image_url;
  useEffect(() => {
    const handleScroll = () => {
      const hero = heroRef.current;
      if (!hero || !hasHeroImage) {
        setOverHero(false);
        return;
      }
      const rect = hero.getBoundingClientRect();
      const headerBottom = 64; // sticky header height (h-16)
      // Transparent as long as the hero is still on/behind the navbar area.
      setOverHero(rect.bottom > headerBottom);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [hasHeroImage]);

  if (!lib) return null;
  const cfg = lib.home_page_config ?? {};
  const published = cfg.published === true;
  const isPrivate = lib.visibility === "private";

  // Non-staff visitors on private libraries see the placeholder.
  if (isPrivate && !staffHere) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header slug={slug} libName={lib.name} logoUrl={logo.data ?? null} branding={brandingCtx} portalEnabled={lib.patron_portal_enabled === true} />
        <UnpublishedState lib={lib} slug={slug} />
        <Footer libName={lib.name} />
      </div>
    );
  }

  // Editors see the editable canvas even when unpublished; anonymous visitors get the placeholder.
  const showEditableCanvas = canEdit || published;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header
        slug={slug}
        libName={lib.name}
        logoUrl={logo.data ?? null}
        branding={brandingCtx}
        portalEnabled={lib.patron_portal_enabled === true}
        scrolledPastHero={!overHero}
      />

      {!showEditableCanvas ? (
        <UnpublishedState lib={lib} slug={slug} />
      ) : (
        <HomeContent
          lib={lib}
          cfg={cfg}
          editMode={editMode && canEdit}
          canEdit={canEdit}
          onSave={save}
          published={published}
          heroRef={heroRef}
        />
      )}

      <Footer libName={lib.name} />

      {canEdit && (
        <EditorOverlay
          slug={slug}
          editMode={editMode}
          onToggle={() => setEditMode((v) => !v)}
          saveState={saveState}
        />
      )}
    </div>
  );
}

function HomeContent({
  lib, cfg, editMode, canEdit, onSave, published, heroRef,
}: {
  lib: PublicLibrary;
  cfg: HomeConfig;
  editMode: boolean;
  canEdit: boolean;
  onSave: (patch: Partial<HomeConfig>, opts?: { debounce?: number }) => void;
  published: boolean;
  heroRef: React.RefObject<HTMLElement | null>;
}) {
  const blocks = ensureBlocks(cfg);

  return (
    <main className="flex-1">
      {canEdit && !published && (
        <div className="border-b bg-amber-50 text-amber-900">
          <div className="max-w-5xl mx-auto px-6 py-2 text-xs flex items-center gap-2">
            <span className="font-medium">Draft preview</span>
            <span className="text-amber-800/80">— visitors can't see this page yet. Publish it from the button in the corner.</span>
          </div>
        </div>
      )}

      {/* Hero (non-negotiable) */}
      <section
        ref={heroRef}
        className={cn(
          "relative w-full overflow-hidden rounded-none group",
          cfg.hero_image_url && "min-h-[384px] md:min-h-[484px] -mt-16",
        )}
      >
        {(editMode || cfg.hero_image_url) && (
          <HeroBackground
            libraryId={lib.id}
            path={cfg.hero_image_url ?? null}
            editMode={editMode}
            onChange={(next) => onSave({ hero_image_url: next }, { debounce: 0 })}
          />
        )}
        <div className={cn("relative z-10 max-w-5xl mx-auto px-6 md:px-10 pb-12 md:pb-16", cfg.hero_image_url ? "pt-32 md:pt-40" : "pt-16 md:pt-24")}>
          <InlineMultiline
            as="h1"
            value={cfg.hero_heading ?? ""}
            onCommit={(v) => onSave({ hero_heading: v })}
            editing={editMode}
            placeholder={`Welcome to ${lib.name}`}
            dark={!!cfg.hero_image_url}
            className={cn("text-4xl md:text-6xl font-semibold tracking-tight", cfg.hero_image_url && "text-white")}
            style={cfg.hero_image_url ? { textShadow: "0 2px 16px rgba(0,0,0,0.6)" } : undefined}
          />
          {(editMode || cfg.hero_subheading?.trim()) && (
            <div className={cn("mt-5 text-lg md:text-xl max-w-2xl", cfg.hero_image_url && "text-white/90")}>
              <InlineMultiline
                value={cfg.hero_subheading ?? ""}
                onCommit={(v) => onSave({ hero_subheading: v })}
                editing={editMode}
                placeholder="Add a subheading to introduce your library…"
                rows={2}
                dark={!!cfg.hero_image_url}
                style={cfg.hero_image_url ? { textShadow: "0 1px 10px rgba(0,0,0,0.6)" } : undefined}
              />
            </div>
          )}
        </div>
      </section>

      {/* Rearrangeable middle */}
      <BlockList
        blocks={blocks}
        onBlocksChange={(next) => onSave({ blocks: next }, { debounce: 0 })}
        ctx={{
          libraryId: lib.id,
          libContact: {
            address: lib.contact_address,
            phone: lib.contact_phone,
            email: lib.contact_email,
            languages: lib.languages,
          },
          editMode,
        }}
      />
    </main>
  );
}

function EditorOverlay({
  slug, editMode, onToggle, saveState,
}: {
  slug: string;
  editMode: boolean;
  onToggle: () => void;
  saveState: "idle" | "saving" | "saved" | "error";
}) {
  const label = useMemo(() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "saved") return "Saved";
    if (saveState === "error") return "Save failed";
    return null;
  }, [saveState]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
      {editMode && label && (
        <div className="rounded-full bg-background/90 backdrop-blur border shadow-sm px-3 py-1.5 text-xs flex items-center gap-1.5">
          {saveState === "saving" && <Loader2 className="size-3 animate-spin" />}
          {saveState === "saved" && <Check className="size-3 text-emerald-600" />}
          {saveState === "error" && <X className="size-3 text-red-600" />}
          {label}
        </div>
      )}
      <Button
        onClick={onToggle}
        size="sm"
        variant={editMode ? "default" : "outline"}
        className="rounded-full shadow-lg gap-2"
      >
        {editMode ? <><Check className="size-3.5" /> Done</> : <><Pencil className="size-3.5" /> Edit page</>}
      </Button>
      {!editMode && <PublishButton slug={slug} variant="navbar" />}
    </div>
  );
}

function Header({
  slug, libName, logoUrl, branding, portalEnabled, scrolledPastHero = true,
}: {
  slug: string;
  libName: string;
  logoUrl: string | null;
  branding?: import("@/lib/branding").LibraryBranding | null;
  portalEnabled: boolean;
  scrolledPastHero?: boolean;
}) {
  const all = useAllStaff();
  const staffRows = all.data ?? [];
  const isStaffHere = staffRows.some((r) => r.library_slug === slug);
  const hasMany = staffRows.length >= 2;
  useEffect(() => { if (isStaffHere) rememberLibrarySlug(slug); }, [isStaffHere, slug]);
  const iconName = (branding?.logo_icon_name ?? branding?.icon_name ?? null) as IconName | null;
  const iconColor = branding?.logo_icon_color ?? branding?.icon_color ?? undefined;
  return (
    <header
      className={cn(
        "sticky top-0 z-30 transition-all duration-300",
        scrolledPastHero
          ? "border-b backdrop-blur"
          : "bg-transparent border-transparent",
      )}
      style={scrolledPastHero ? { backgroundColor: "color-mix(in srgb, var(--navbar, var(--background)) 80%, transparent)", color: "var(--navbar-foreground, var(--foreground))" } : undefined}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/$slug" params={{ slug }} className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "size-9 rounded-md flex items-center justify-center overflow-hidden shrink-0",
              logoUrl || iconName ? "bg-transparent" : "bg-primary text-primary-foreground",
            )}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : iconName ? (
              <DynamicIcon name={iconName} className="size-6" style={{ color: iconColor }} />
            ) : (
              <BookOpen className="size-4.5" />
            )}
          </div>
          <span className="font-semibold truncate">{libName}</span>
        </Link>

        <div className="flex items-center gap-2">
          {hasMany && <LibrarySwitcher currentSlug={slug} />}
          {portalEnabled && !isStaffHere && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$slug/account" params={{ slug }}>My account</Link>
            </Button>
          )}
          <Button asChild variant={isStaffHere ? "default" : "outline"} size="sm">
            <Link to="/$slug/app" params={{ slug }}>
              admin <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function InfoCard({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function UnpublishedState({ lib, slug }: { lib: PublicLibrary; slug: string }) {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold">{lib.name}</h1>
        <p className="mt-3 text-muted-foreground">
          This library's public page is not published yet.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link to="/$slug/app" params={{ slug }}>
              admin <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function HeroBackground({
  libraryId, path, editMode, onChange,
}: {
  libraryId: string;
  path: string | null;
  editMode: boolean;
  onChange: (next: string | null) => void;
}) {
  const signed = useSignedHeroImage(path);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large (max 8 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const next = `${libraryId}/hero-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("library-home-images")
        .upload(next, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      if (path && path !== next) {
        await supabase.storage.from("library-home-images").remove([path]);
      }
      onChange(next);
      toast.success("Hero image updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onRemove() {
    if (path) {
      await supabase.storage.from("library-home-images").remove([path]);
    }
    onChange(null);
  }

  return (
    <div className="absolute inset-0">
      {path ? (
        <>
          {signed.data ? (
            <img
              src={signed.data}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/20" />
        </>
      ) : editMode ? (
        <div className="w-full h-full border-2 border-dashed border-border bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImagePlus className="size-6" />
          <span className="text-sm font-medium">Add a hero image</span>
          <span className="text-xs">Recommended 16:7, up to 8 MB</span>
        </div>
      ) : null}

      {editMode && (
        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
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

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}



function Footer({ libName }: { libName: string }) {
  return (
    <footer className="border-t mt-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>© {new Date().getFullYear()} {libName}</span>
        <span>Powered by LibrariOS</span>
      </div>
    </footer>
  );
}
