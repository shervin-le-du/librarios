import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { slugify, validateSlug } from "@/lib/tenant";

export const Route = createFileRoute("/accept-invite")({
  ssr: false,
  validateSearch: z.object({
    token: z.string().optional(),
    kind: z.enum(["staff", "owner", "platform"]).optional(),
  }),
  head: () => ({ meta: [{ title: "Accept invite — LibrariOS" }] }),
  component: AcceptInvitePage,
});

type InviteKind = "staff" | "owner" | "platform";
type Invite = {
  kind: InviteKind;
  email: string;
  heading: string;
  subheading: string;
  role?: string;
  slug?: string;
  libraryName?: string;
};

type OwnerOverrides = { name?: string; slug?: string };

async function accept(kind: InviteKind, token: string, owner?: OwnerOverrides): Promise<string | null> {
  if (kind === "owner") {
    const { data, error } = await supabase.rpc("accept_owner_invitation", {
      p_token: token,
      p_library_name: owner?.name ?? undefined,
      p_library_slug: owner?.slug ?? undefined,
    });
    if (error) throw error;
    return ((data ?? [])[0] as { library_slug: string } | undefined)?.library_slug ?? null;
  }
  if (kind === "platform") {
    const { error } = await supabase.rpc("accept_platform_invitation", { p_token: token });
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase.rpc("accept_staff_invitation", { p_token: token });
  if (error) throw error;
  return ((data ?? [])[0] as { library_slug: string } | undefined)?.library_slug ?? null;
}

function AcceptInvitePage() {
  const { token, kind } = Route.useSearch();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState<boolean | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Owner-only: editable library name + slug
  const [libName, setLibName] = useState("");
  const [libSlug, setLibSlug] = useState("");
  const [libSlugTouched, setLibSlugTouched] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setError("Missing invitation token."); setLoading(false); return; }
      try {
        let inv: Invite;
        let prefillName = "";
        if (kind === "owner") {
          const { data, error } = await supabase.rpc("get_owner_invitation_by_token", { p_token: token });
          if (error) throw error;
          const row = (data ?? [])[0] as { email: string; library_name: string; library_slug: string; status: string; expired: boolean; first_name: string | null; last_name: string | null } | undefined;
          if (!row) throw new Error("This invitation link is invalid.");
          if (row.status !== "pending") throw new Error(`This invitation is ${row.status}.`);
          if (row.expired) throw new Error("This invitation has expired.");
          inv = {
            kind: "owner", email: row.email, slug: row.library_slug, libraryName: row.library_name,
            heading: `Take ownership of ${row.library_name}`,
            subheading: `Confirm your library's name and web address, then finish setting up your account.`,
          };
          setLibName(row.library_name);
          setLibSlug(row.library_slug);
          prefillName = [row.first_name ?? "", row.last_name ?? ""].map(s => s.trim()).filter(Boolean).join(" ");
        } else if (kind === "platform") {
          const { data, error } = await supabase.rpc("get_platform_invitation_by_token", { p_token: token });
          if (error) throw error;
          const row = (data ?? [])[0] as { email: string; role: string; status: string; expired: boolean; first_name: string | null; last_name: string | null } | undefined;
          if (!row) throw new Error("This invitation link is invalid.");
          if (row.status !== "pending") throw new Error(`This invitation is ${row.status}.`);
          if (row.expired) throw new Error("This invitation has expired.");
          inv = {
            kind: "platform", email: row.email, role: row.role,
            heading: "Join the LibrariOS platform team",
            subheading: `You're invited as ${row.role === "super_admin" ? "super admin" : "admin"}.`,
          };
          prefillName = [row.first_name ?? "", row.last_name ?? ""].map(s => s.trim()).filter(Boolean).join(" ");
        } else {
          const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });
          if (error) throw error;
          const row = (data ?? [])[0] as { email: string; role: string; library_name: string; status: string; first_name: string | null; last_name: string | null } | undefined;
          if (!row) throw new Error("This invitation link is invalid.");
          if (row.status !== "pending") throw new Error(`This invitation is ${row.status}.`);
          inv = {
            kind: "staff", email: row.email, role: row.role,
            heading: `Join ${row.library_name}`,
            subheading: `You're invited as ${row.role} with email ${row.email}.`,
          };
          prefillName = [row.first_name ?? "", row.last_name ?? ""].map(s => s.trim()).filter(Boolean).join(" ");
        }
        setInvite(inv);
        if (prefillName) setFullName(prefillName);

        // Verify the session against Supabase — a stale token whose auth user
        // was deleted still returns a session locally, but any RPC using
        // auth.uid() will fail. In that case, clear it and treat as signed out.
        let email: string | null = null;
        const { data: sess } = await supabase.auth.getSession();
        if (sess.session) {
          const { data: userRes, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userRes.user) {
            await supabase.auth.signOut();
          } else {
            email = userRes.user.email ?? null;
          }
        }
        setCurrentEmail(email);

        if (!email) {
          const { data: exists } = await supabase.rpc("email_has_account", { p_email: inv.email });
          setAccountExists(Boolean(exists));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not load invitation";
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, kind]);

  async function afterAccept(inv: Invite, redirectSlug: string | null) {
    if (inv.kind === "platform") {
      window.location.assign("/platform");
      return;
    }
    const slug = redirectSlug ?? inv.slug ?? null;
    if (slug) {
      // Full page load: guarantees the protected /_authenticated layout
      // remounts cleanly with the freshly-hydrated session and avoids a React
      // "rendered more hooks than during the previous render" error that can
      // occur when navigating client-side mid auth-state transition.
      window.location.assign(`/${slug}/app/dashboard`);
    } else {
      window.location.assign("/onboarding");
    }
  }

  function ownerOverrides(): OwnerOverrides | undefined {
    if (!invite || invite.kind !== "owner") return undefined;
    return { name: libName.trim(), slug: libSlug.trim().toLowerCase() };
  }

  function ownerFieldsValid(): string | null {
    if (!invite || invite.kind !== "owner") return null;
    if (!libName.trim()) return "Library name is required.";
    const slugErr = validateSlug(libSlug.trim().toLowerCase());
    if (slugErr) return slugErr;
    return null;
  }

  async function submitSignedIn() {
    if (!invite || !token) return;
    const err = ownerFieldsValid();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const slug = await accept(invite.kind, token, ownerOverrides());
      toast.success("Invitation accepted");
      await afterAccept(invite, slug);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not accept invite");
    } finally { setSubmitting(false); }
  }

  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!invite || !token) return;
    const err = ownerFieldsValid();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
      if (error) throw error;
      const slug = await accept(invite.kind, token, ownerOverrides());
      toast.success("Welcome back — invitation accepted");
      await afterAccept(invite, slug);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign in");
    } finally { setSubmitting(false); }
  }

  async function submitSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!invite || !token) return;
    const err = ownerFieldsValid();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      const data: Record<string, string> = { full_name: fullName };
      // For owner invites we DON'T include the token in metadata: the DB trigger
      // would auto-accept and skip the name/slug the user just confirmed. We
      // call accept_owner_invitation explicitly after signup instead.
      if (invite.kind === "platform") data.platform_invitation_token = token;
      else if (invite.kind === "staff") data.invitation_token = token;

      const { data: res, error } = await supabase.auth.signUp({
        email: invite.email, password,
        options: { emailRedirectTo: `${window.location.origin}/`, data },
      });
      if (error) {
        // If the account actually already exists, fall back to sign-in mode.
        if (/already/i.test(error.message)) { setAccountExists(true); return; }
        throw error;
      }
      toast.success("Account created — welcome!");
      if (res.session) {
        if (invite.kind === "owner") {
          const slug = await accept("owner", token, ownerOverrides());
          await afterAccept(invite, slug);
        } else {
          await afterAccept(invite, invite.slug ?? null);
        }
      } else {
        toast.info("Check your email to confirm your account.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create account");
    } finally { setSubmitting(false); }
  }

  async function switchAccount() {
    await supabase.auth.signOut();
    setCurrentEmail(null);
    if (invite) {
      const { data: exists } = await supabase.rpc("email_has_account", { p_email: invite.email });
      setAccountExists(Boolean(exists));
    }
  }

  const emailMatches = invite && currentEmail && currentEmail.toLowerCase() === invite.email.toLowerCase();

  const isOwner = invite?.kind === "owner";
  const libSlugError = isOwner && libSlug ? validateSlug(libSlug.trim().toLowerCase()) : null;

  const ownerLibraryFields = isOwner ? (
    <div className="space-y-4 rounded-md border p-4 bg-muted/30">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your library
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="lib-name">Library name</Label>
        <Input id="lib-name" required value={libName}
          onChange={(e) => {
            const v = e.target.value;
            setLibName(v);
            if (!libSlugTouched) setLibSlug(slugify(v));
          }} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lib-slug">Web address</Label>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm">librarios.com/</span>
          <Input id="lib-slug" required value={libSlug} autoCapitalize="none"
            onChange={(e) => { setLibSlugTouched(true); setLibSlug(e.target.value); }} />
        </div>
        {libSlugError ? (
          <p className="text-xs text-destructive">{libSlugError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            This is where your library will live on the web. Use 3–30 lowercase letters, numbers, or hyphens.
          </p>
        )}
      </div>
    </div>
  ) : null;

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
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading invitation…</p>
          ) : error ? (
            <>
              <h2 className="text-xl font-semibold mb-2">Invitation problem</h2>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Link to="/auth" className="text-sm text-primary hover:underline">Go to sign in</Link>
            </>
          ) : invite ? (
            <>
              <h2 className="text-xl font-semibold mb-1">{invite.heading}</h2>
              <p className="text-sm text-muted-foreground mb-6">{invite.subheading}</p>

              {currentEmail && emailMatches ? (
                <div className="space-y-4">
                  <p className="text-sm">
                    You're signed in as <span className="font-medium">{currentEmail}</span>.
                  </p>
                  {ownerLibraryFields}
                  <Button className="w-full" onClick={submitSignedIn} disabled={submitting}>
                    {submitting ? "Accepting…" : "Accept invitation"}
                  </Button>
                </div>
              ) : currentEmail && !emailMatches ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You're signed in as <span className="font-medium">{currentEmail}</span>, but this
                    invitation is for <span className="font-medium">{invite.email}</span>.
                  </p>
                  <Button variant="outline" className="w-full" onClick={switchAccount}>
                    Sign out and continue
                  </Button>
                </div>
              ) : accountExists ? (
                <form onSubmit={submitSignIn} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You already have a LibrariOS account. Sign in to accept.
                  </p>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={invite.email} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" minLength={6}
                      value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
                  </div>
                  {ownerLibraryFields}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Please wait…" : "Sign in & accept"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={submitSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input value={invite.email} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" minLength={6}
                      value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  {ownerLibraryFields}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Please wait…" : "Create account & continue"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Already have an account?{" "}
                    <button type="button" className="text-primary hover:underline"
                      onClick={() => setAccountExists(true)}>Sign in instead</button>
                  </p>
                </form>
              )}
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
