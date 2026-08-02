import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useCurrentLibrary, useSignedLogo } from "@/lib/use-current-library";
import { Upload, X, AlertTriangle } from "lucide-react";
import { validateSlug } from "@/lib/tenant";
import type { StaffRole } from "@/lib/use-current-staff";

export function LibraryGeneralSection({ slug, role }: { slug: string; role: StaffRole }) {
  const router = useRouter();
  const lib = useCurrentLibrary();
  const qc = useQueryClient();
  const canEditSlug = role === "owner";

  const [name, setName] = useState("");
  const [languages, setLanguages] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lib.data) return;
    setName(lib.data.name ?? "");
    setLanguages((lib.data.languages ?? []).join(", "));
    setEmail(lib.data.contact_email ?? "");
    setPhone(lib.data.contact_phone ?? "");
    setAddress(lib.data.contact_address ?? "");
    setNewSlug(lib.data.subdomain ?? slug);
  }, [lib.data, slug]);

  const logo = useSignedLogo(lib.data?.logo_url);

  const save = useMutation({
    mutationFn: async () => {
      if (!lib.data) throw new Error("No library");
      const langs = languages.split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase.from("libraries").update({
        name: name.trim(),
        languages: langs.length ? langs : null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
        contact_address: address.trim() || null,
      }).eq("id", lib.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-library"] });
      toast.success("Library details saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSlug = useMutation({
    mutationFn: async () => {
      const err = validateSlug(newSlug.trim().toLowerCase());
      if (err) throw new Error(err);
      const { data, error } = await supabase.rpc("update_library_slug", { p_slug: newSlug.trim().toLowerCase() });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (next) => {
      toast.success("URL slug updated. Old links will break.");
      qc.invalidateQueries();
      router.navigate({ to: "/$slug/app/settings", params: { slug: next }, replace: true });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function onUpload(file: File) {
    if (!lib.data) return;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${lib.data.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("library-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    if (lib.data.logo_url && lib.data.logo_url !== path) {
      await supabase.storage.from("library-logos").remove([lib.data.logo_url]);
    }
    const { error } = await supabase.from("libraries").update({ logo_url: path }).eq("id", lib.data.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["current-library"] });
    qc.invalidateQueries({ queryKey: ["logo-signed"] });
    toast.success("Logo updated");
  }

  async function removeLogo() {
    if (!lib.data?.logo_url) return;
    await supabase.storage.from("library-logos").remove([lib.data.logo_url]);
    await supabase.from("libraries").update({ logo_url: null }).eq("id", lib.data.id);
    qc.invalidateQueries({ queryKey: ["current-library"] });
    toast.success("Logo removed");
  }

  function onSlugChange(v: string) {
    setNewSlug(v);
    setSlugError(validateSlug(v.trim().toLowerCase()));
  }

  return (
    <section id="library-general" className="space-y-6 scroll-mt-20">
      <div>
        <h2 className="text-2xl font-semibold">Library</h2>
        <p className="text-sm text-muted-foreground mt-1">URL, branding, and contact details.</p>
      </div>

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-1">URL slug</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Your library lives at <code className="bg-muted px-1.5 py-0.5 rounded">/{lib.data?.subdomain ?? slug}</code>.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[220px]">
            <Label htmlFor="slug">Slug</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-sm">/</span>
              <Input id="slug" value={newSlug} disabled={!canEditSlug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="acme" autoCapitalize="none" />
            </div>
            {slugError && <p className="text-xs text-destructive">{slugError}</p>}
          </div>
          {canEditSlug && (
            <Button variant="outline"
              disabled={!!slugError || newSlug === lib.data?.subdomain || updateSlug.isPending}
              onClick={() => {
                if (confirm("Change the slug? Existing links and bookmarks to the old slug will stop working.")) {
                  updateSlug.mutate();
                }
              }}>
              {updateSlug.isPending ? "Updating…" : "Change slug"}
            </Button>
          )}
        </div>
        {canEditSlug && (
          <div className="mt-4 flex gap-2 text-xs text-muted-foreground bg-muted/60 p-3 rounded-md">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <span>Changing the slug breaks any existing links, bookmarks, and pending invite links. Owner-only.</span>
          </div>
        )}
      </Card>


      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Details</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lib-name">Library name</Label>
            <Input id="lib-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="langs">Languages</Label>
            <Input id="langs" value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="English, Spanish, French" />
            <p className="text-xs text-muted-foreground">Comma-separated.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lib-email">Contact email</Label>
              <Input id="lib-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-phone">Contact phone</Label>
              <Input id="lib-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lib-addr">Address</Label>
            <Textarea id="lib-addr" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">Patron portal</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Allow your readers to log in at <code className="bg-muted px-1 rounded">/{lib.data?.subdomain ?? slug}/account</code> and view their own loans and holds.
            </p>
          </div>
          <Switch
            checked={!!lib.data?.patron_portal_enabled}
            onCheckedChange={async (checked) => {
              if (!lib.data) return;
              const { error } = await supabase.from("libraries")
                .update({ patron_portal_enabled: checked }).eq("id", lib.data.id);
              if (error) { toast.error(error.message); return; }
              qc.invalidateQueries({ queryKey: ["current-library"] });
              toast.success(checked ? "Patron portal enabled" : "Patron portal disabled");
            }}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </section>
  );
}
