import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { slugify, validateSlug } from "@/lib/tenant";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Create your library — LibrariOS" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // If the user already belongs to a library, leave onboarding.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_current_staff");
      const me = (data ?? [])[0];
      if (me) {
        // Look up their library slug and redirect there.
        const { data: lib } = await supabase.from("libraries").select("subdomain").eq("id", me.library_id).maybeSingle();
        const sub = (lib as any)?.subdomain;
        if (sub) navigate({ to: "/$slug/app/dashboard", params: { slug: sub }, replace: true });
      } else {
        setChecking(false);
      }
    })();
  }, [navigate]);

  // Auto-suggest slug from name until user edits it
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const slugError = slug ? validateSlug(slug.trim().toLowerCase()) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (slugError) { toast.error(slugError); return; }
    setLoading(true);
    try {
      const { error } = await supabase.rpc("create_library_for_current_user", {
        p_name: name.trim(),
        p_slug: slug.trim().toLowerCase(),
      });
      if (error) throw error;
      await qc.invalidateQueries();
      toast.success("Library created");
      navigate({ to: "/$slug/app/dashboard", params: { slug: slug.trim().toLowerCase() }, replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not create library");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <BookOpen className="size-5" />
          </div>
          <h1 className="text-2xl font-semibold">LibrariOS</h1>
        </div>
        <Card className="p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-1">Create your library</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Name your library and choose its web address. You'll be its owner.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Library name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Central Public Library" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Web address</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">librarios.com/</span>
                <Input id="slug" required value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
                  placeholder="central-public" autoCapitalize="none" />
              </div>
              {slugError ? (
                <p className="text-xs text-destructive">{slugError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This is where your library will live on the web. Use 3–30 lowercase letters, numbers, or hyphens.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || !name.trim() || !slug.trim() || !!slugError}>
              {loading ? "Creating…" : "Create library"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
