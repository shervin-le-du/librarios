import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, BookOpen, LogOut, RefreshCw, XCircle } from "lucide-react";
import { fetchLibraryBySlug } from "@/lib/use-tenant-library";

type MemberLoan = {
  id: string; book_id: string; book_title: string; book_author: string | null;
  checked_out_at: string; due_date: string; returned_at: string | null;
  status: "active" | "returned";
};
type MemberHold = {
  id: string; book_id: string; book_title: string; book_author: string | null;
  created_at: string; expires_at: string | null;
  status: "active" | "fulfilled" | "cancelled" | "expired";
};
type MemberReader = {
  id: string; first_name: string; last_name: string; email: string | null;
  phone: string | null; membership_number: string; status: string;
};

export const Route = createFileRoute("/$slug/account")({
  ssr: false,
  loader: async ({ params }) => {
    const lib = await fetchLibraryBySlug(params.slug);
    if (!lib) throw notFound();
    return lib;
  },
  head: () => ({ meta: [{ title: "My account" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { slug } = Route.useParams();
  const lib = Route.useLoaderData();
  const router = useRouter();
  const qc = useQueryClient();
  const [session, setSession] = useState<{ userId: string; email: string | null } | null | undefined>(undefined);

  // Portal must be enabled
  const portalOpen = useQuery({
    queryKey: ["public-home", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_library_public_home", { p_slug: slug });
      if (error) throw error;
      return (data ?? [])[0] as any ?? null;
    },
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setSession(data.user ? { userId: data.user.id, email: data.user.email ?? null } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user ? { userId: s.user.id, email: s.user.email ?? null } : null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (portalOpen.isLoading || session === undefined) {
    return <Shell libName={lib.name} slug={slug}><div className="p-10 text-sm text-muted-foreground">Loading…</div></Shell>;
  }

  const portalEnabled = portalOpen.data?.patron_portal_enabled === true;
  if (!portalEnabled) {
    return (
      <Shell libName={lib.name} slug={slug}>
        <div className="max-w-md mx-auto text-center py-16">
          <h1 className="text-2xl font-semibold">Member area not available</h1>
          <p className="text-muted-foreground mt-2">This library hasn't opened member accounts yet.</p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/$slug" params={{ slug }}><ArrowLeft className="size-4" /> Back to home</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (!session) {
    return <Shell libName={lib.name} slug={slug}><SignInForm slug={slug} /></Shell>;
  }

  return <Shell libName={lib.name} slug={slug} signedIn email={session.email} onSignOut={async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/$slug/account", params: { slug }, replace: true });
  }}><MemberDashboard slug={slug} /></Shell>;
}

function Shell({ children, libName, slug, signedIn, email, onSignOut }: {
  children: React.ReactNode; libName: string; slug: string; signedIn?: boolean; email?: string | null; onSignOut?: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/$slug" params={{ slug }} className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <BookOpen className="size-4.5" />
            </div>
            <span className="font-semibold truncate">{libName}</span>
          </Link>
          {signedIn && (
            <div className="flex items-center gap-3">
              {email && <span className="text-xs text-muted-foreground hidden sm:inline">{email}</span>}
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 px-6 py-10 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  );
}

function SignInForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Signed in");
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Member sign in</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Use the email and password you created with your activation link.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="text-xs text-muted-foreground mt-6 text-center">
        Need an account? Ask the library to send you an activation link.
      </p>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        <Link to="/$slug" params={{ slug }} className="hover:underline">← Back to the library home</Link>
      </p>
    </div>
  );
}

function MemberDashboard({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const dash = useQuery({
    queryKey: ["member-dashboard", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_member_dashboard", { p_slug: slug });
      if (error) throw error;
      return data as { reader: MemberReader; loans: MemberLoan[]; holds: MemberHold[] };
    },
    retry: false,
  });

  const renew = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase.rpc("renew_member_loan", { p_loan_id: loanId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Loan renewed"); qc.invalidateQueries({ queryKey: ["member-dashboard", slug] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelHold = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_member_reservation", { p_reservation_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Hold cancelled"); qc.invalidateQueries({ queryKey: ["member-dashboard", slug] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (dash.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (dash.error) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <h2 className="text-xl font-semibold">No member account here</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          You're signed in, but this account isn't linked to a reader at this library.
        </p>
        <p className="text-xs text-muted-foreground mt-2">{(dash.error as any)?.message}</p>
      </div>
    );
  }

  const { reader, loans, holds } = dash.data!;
  const activeLoans = loans.filter((l) => l.status === "active");
  const pastLoans = loans.filter((l) => l.status !== "active");
  const activeHolds = holds.filter((h) => h.status === "active");
  const today = new Date(new Date().toDateString());

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-semibold">Hello, {reader.first_name}</h1>
        <p className="text-muted-foreground mt-1">Member <span className="font-mono">{reader.membership_number}</span></p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">My loans</h2>
        {activeLoans.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No active loans.</Card>
        ) : (
          <Card className="divide-y">
            {activeLoans.map((l) => {
              const overdue = new Date(l.due_date) < today;
              return (
                <div key={l.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{l.book_title}</div>
                    {l.book_author && <div className="text-xs text-muted-foreground">{l.book_author}</div>}
                    <div className="text-xs text-muted-foreground mt-1">
                      Due {format(new Date(l.due_date), "MMM d, yyyy")}
                      {overdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" disabled={renew.isPending} onClick={() => renew.mutate(l.id)}>
                    <RefreshCw className="size-3.5" /> Renew
                  </Button>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">My holds</h2>
        {activeHolds.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No active holds.</Card>
        ) : (
          <Card className="divide-y">
            {activeHolds.map((h) => (
              <div key={h.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium">{h.book_title}</div>
                  {h.book_author && <div className="text-xs text-muted-foreground">{h.book_author}</div>}
                  <div className="text-xs text-muted-foreground mt-1">Placed {format(new Date(h.created_at), "MMM d, yyyy")}</div>
                </div>
                <Button size="sm" variant="outline" disabled={cancelHold.isPending} onClick={() => {
                  if (confirm("Cancel this hold?")) cancelHold.mutate(h.id);
                }}>
                  <XCircle className="size-3.5" /> Cancel
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      {pastLoans.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Loan history</h2>
          <Card className="divide-y">
            {pastLoans.slice(0, 20).map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <div className="font-medium">{l.book_title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(l.checked_out_at), "MMM d, yyyy")}
                    {l.returned_at && <> · Returned {format(new Date(l.returned_at), "MMM d, yyyy")}</>}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">My profile</h2>
        <Card className="p-5 space-y-2 text-sm">
          <Row k="Name" v={`${reader.first_name} ${reader.last_name}`} />
          <Row k="Member #" v={reader.membership_number} />
          <Row k="Email" v={reader.email} />
          <Row k="Phone" v={reader.phone} />
          <Row k="Status" v={reader.status === "active" ? "Active" : "Suspended"} />
          <p className="text-xs text-muted-foreground pt-2">To update your details, please contact the library.</p>
        </Card>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex gap-4">
      <dt className="text-muted-foreground w-24 shrink-0">{k}</dt>
      <dd className="flex-1">{v || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
