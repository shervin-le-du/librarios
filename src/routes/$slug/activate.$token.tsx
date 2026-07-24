import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";

type Preview = {
  library_name: string;
  library_slug: string;
  reader_first_name: string;
  reader_last_name: string;
  status: "pending" | "accepted" | "revoked";
  expired: boolean;
  portal_enabled: boolean;
};

export const Route = createFileRoute("/$slug/activate/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Activate account" }] }),
  component: ActivatePage,
});

function ActivatePage() {
  const { slug, token } = Route.useParams();
  const router = useRouter();

  const preview = useQuery({
    queryKey: ["member-invite-preview", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_invitation_preview", { p_token: token });
      if (error) throw error;
      return ((data ?? [])[0] as Preview | undefined) ?? null;
    },
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null } | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user ? { id: data.user.id, email: data.user.email ?? null } : null);
    });
  }, []);

  if (preview.isLoading || currentUser === undefined) {
    return <Wrap><div className="text-sm text-muted-foreground">Loading…</div></Wrap>;
  }

  const inv = preview.data;
  if (!inv) return <Wrap><Notice tone="error" title="Invalid link" body="This activation link doesn't exist. Ask the library for a new one." slug={slug} /></Wrap>;
  if (!inv.portal_enabled) return <Wrap><Notice tone="error" title="Member portal closed" body="This library hasn't opened member accounts." slug={slug} /></Wrap>;
  if (inv.status === "revoked") return <Wrap><Notice tone="error" title="Link revoked" body="This activation link has been revoked. Ask the library for a new one." slug={slug} /></Wrap>;
  if (inv.status === "accepted") return <Wrap><Notice tone="ok" title="Already activated" body="This account is already set up. Sign in below." slug={slug} action /></Wrap>;
  if (inv.expired) return <Wrap><Notice tone="error" title="Link expired" body="This activation link has expired. Ask the library for a new one." slug={slug} /></Wrap>;

  async function linkExisting() {
    setPending(true);
    const { error } = await supabase.rpc("link_member_account", { p_token: token });
    setPending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account linked");
    router.navigate({ to: "/$slug/account", params: { slug }, replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setPending(true);
    const { error: signErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (signErr) { setPending(false); toast.error(signErr.message); return; }
    // Ensure session is established (autoconfirm should be on in dev; for prod the user may need to verify email first)
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setPending(false);
      toast.info("Check your email to confirm your address, then come back to this link.");
      return;
    }
    const { error: linkErr } = await supabase.rpc("link_member_account", { p_token: token });
    setPending(false);
    if (linkErr) { toast.error(linkErr.message); return; }
    toast.success("Welcome — your account is ready");
    router.navigate({ to: "/$slug/account", params: { slug }, replace: true });
  }

  return (
    <Wrap>
      <h1 className="text-2xl font-semibold">Activate your library account</h1>
      <p className="text-sm text-muted-foreground mt-1">
        <span className="font-medium text-foreground">{inv.library_name}</span> invited{" "}
        <span className="font-medium text-foreground">{inv.reader_first_name} {inv.reader_last_name}</span> to use the member portal.
      </p>

      {currentUser ? (
        <Card className="p-5 mt-6 space-y-3">
          <p className="text-sm">You're signed in as <span className="font-medium">{currentUser.email}</span>. Link this account to {inv.reader_first_name}'s reader record?</p>
          <div className="flex gap-2">
            <Button onClick={linkExisting} disabled={pending}>{pending ? "Linking…" : "Link this account"}</Button>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); setCurrentUser(null); }}>
              Use a different email
            </Button>
          </div>
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf">Confirm</Label>
              <Input id="cf" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Setting up…" : "Create my account"}</Button>
          <p className="text-xs text-muted-foreground text-center">
            By continuing you create a member account at {inv.library_name}.
          </p>
        </form>
      )}
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="max-w-md mx-auto px-6 h-16 flex items-center gap-2.5">
          <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <BookOpen className="size-4.5" />
          </div>
          <span className="font-semibold">LibrariOS</span>
        </div>
      </header>
      <main className="flex-1 px-6 py-12 max-w-md mx-auto w-full">{children}</main>
    </div>
  );
}

function Notice({ tone, title, body, slug, action }: { tone: "ok" | "error"; title: string; body: string; slug: string; action?: boolean }) {
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <div className="text-center py-8">
      <div className={`mx-auto size-12 rounded-full flex items-center justify-center mb-4 ${tone === "ok" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
        <Icon className="size-6" />
      </div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
      <div className="mt-6 flex justify-center gap-2">
        {action && (
          <Button asChild>
            <Link to="/$slug/account" params={{ slug }}>Go to sign in</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/$slug" params={{ slug }}>Library home</Link>
        </Button>
      </div>
    </div>
  );
}
