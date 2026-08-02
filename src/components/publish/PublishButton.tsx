import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown, Copy, Globe, Link2, Lock, BarChart3, Settings as SettingsIcon, AlertTriangle, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentLibrary } from "@/lib/use-current-library";

type PublishMeta = {
  visibility: "public" | "private";
  published_at: string | null;
};

function usePublishMeta(libraryId: string | undefined) {
  return useQuery({
    queryKey: ["library-publish-meta", libraryId],
    enabled: !!libraryId,
    queryFn: async (): Promise<PublishMeta | null> => {
      if (!libraryId) return null;
      const { data, error } = await supabase
        .from("libraries")
        .select("visibility, published_at")
        .eq("id", libraryId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PublishMeta) ?? null;
    },
    staleTime: 30_000,
  });
}

function siteUrl(slug: string) {
  if (typeof window === "undefined") return `/${slug}`;
  return `${window.location.origin}/${slug}`;
}

function computeIssues(lib: ReturnType<typeof useCurrentLibrary>["data"]): string[] {
  if (!lib) return [];
  const issues: string[] = [];
  if (!lib.logo_url) issues.push("Add a library logo");
  if (!lib.contact_email && !lib.contact_phone && !lib.contact_address) issues.push("Add contact info");
  const cfg = lib.home_page_config ?? {};
  if (!cfg.hero_heading?.trim()) issues.push("Set a hero heading");
  if (!cfg.about_text?.trim()) issues.push("Write an About section");
  if (!cfg.hours?.trim()) issues.push("Add opening hours");
  return issues;
}

export function PublishButton({ slug, variant = "navbar" }: { slug: string; variant?: "navbar" | "overlay" }) {
  const lib = useCurrentLibrary();
  const meta = usePublishMeta(lib.data?.id);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const published = (lib.data?.home_page_config?.published === true) && !!meta.data?.published_at;
  const visibility: "public" | "private" = meta.data?.visibility ?? "public";
  const issues = useMemo(() => computeIssues(lib.data), [lib.data]);

  const publish = useMutation({
    mutationFn: async () => {
      if (!lib.data) throw new Error("No library");
      const { error } = await supabase.rpc("publish_library" as any, { p_library_id: lib.data.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Library published");
      qc.invalidateQueries({ queryKey: ["library-publish-meta"] });
      qc.invalidateQueries({ queryKey: ["current-library"] });
      qc.invalidateQueries({ queryKey: ["public-home"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not publish"),
  });

  const setVis = useMutation({
    mutationFn: async (v: "public" | "private") => {
      if (!lib.data) throw new Error("No library");
      const { error } = await supabase.rpc("set_library_visibility" as any, { p_library_id: lib.data.id, p_visibility: v });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-publish-meta"] });
      qc.invalidateQueries({ queryKey: ["public-home"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update visibility"),
  });

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(siteUrl(slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  }

  const triggerClasses =
    variant === "overlay"
      ? "fixed bottom-4 right-4 z-50 shadow-lg"
      : "";

  const dotColor = !published ? "bg-muted-foreground" : "bg-success";
  const statusText = !published ? "Draft" : "Published";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 rounded-full pl-3 pr-2 ${triggerClasses}`}
        >
          <span className={`size-2 rounded-full ${dotColor}`} />
          <span className="text-sm">{statusText}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="font-semibold">{published ? "Published" : "Draft"}</div>
          <Badge variant="outline" className="gap-1.5 rounded-md font-normal">
            <BarChart3 className="size-3.5" />
            1 Visitor
          </Badge>
        </div>
        <Separator />

        {/* URL */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Website URL</label>
            <button
              type="button"
              onClick={() => toast.info("Custom domains coming soon")}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Link2 className="size-3" /> Add custom domain
            </button>
          </div>
          <div className="flex items-stretch gap-1.5">
            <div className="flex-1 min-w-0 rounded-md border bg-muted/40 px-3 py-2 text-sm truncate font-mono">
              {siteUrl(slug)}
            </div>
            <Button type="button" size="icon" variant="outline" onClick={copyUrl} aria-label="Copy URL">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
        <Separator />

        {/* Visibility */}
        <div className="px-4 py-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Who can see this website</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full rounded-md border px-3 py-2.5 flex items-center gap-3 hover:bg-accent transition-colors text-left"
              >
                <div className="size-8 rounded-md bg-muted flex items-center justify-center">
                  {visibility === "public" ? <Globe className="size-4" /> : <Lock className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{visibility === "public" ? "Public" : "Private"}</div>
                  <div className="text-xs text-muted-foreground">
                    {visibility === "public" ? "Anyone with the URL" : "Only staff can view"}
                  </div>
                </div>
                <ChevronDown className="size-4 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <DropdownMenuItem onSelect={() => setVis.mutate("public")} className="gap-2">
                <Globe className="size-4" /> Public
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setVis.mutate("private")} className="gap-2">
                <Lock className="size-4" /> Private
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Separator />

        {/* Actions */}
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 justify-center">
                  <AlertTriangle className="size-3.5" />
                  Review issues
                  {issues.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-semibold">
                      {issues.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3 text-sm">
                {issues.length === 0 ? (
                  <div className="text-muted-foreground">No issues. You're good to publish.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {issues.map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="size-3.5 mt-0.5 text-warning shrink-0" />
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>

            <Button asChild variant="outline" size="sm" className="gap-2 justify-center">
              <Link to="/$slug/app/settings" params={{ slug }} onClick={() => setOpen(false)}>
                <SettingsIcon className="size-3.5" />
                Edit settings
              </Link>
            </Button>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
          >
            {publish.isPending ? "Publishing…" : published ? "Update" : "Publish"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
