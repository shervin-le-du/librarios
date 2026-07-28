import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sb, isOverdue, type Reader, type LoanWithRefs, type ReservationWithRefs } from "@/lib/librarian";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Ban, CheckCircle2, KeyRound, Copy, UserX } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentLibrary } from "@/lib/use-current-library";
import { useCurrentStaff } from "@/lib/use-current-staff";
import { sendInviteEmail, expiresInLabel, reportInviteEmailOutcome } from "@/lib/email/send-invite";

export const Route = createFileRoute("/$slug/app/readers/$id")({
  head: () => ({ meta: [{ title: "Reader — LibrariOS" }] }),
  component: ReaderDetail,
});

function ReaderDetail() {
  const { id, slug } = Route.useParams();
  const qc = useQueryClient();

  const reader = useQuery({
    queryKey: ["reader", id],
    queryFn: async () => {
      const { data, error } = await sb.from("readers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Reader | null;
    },
  });

  const loans = useQuery({
    queryKey: ["reader-loans", id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("loans")
        .select("*, book:books(id,title,author), reader:readers(id,first_name,last_name,membership_number)")
        .eq("reader_id", id)
        .order("checked_out_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LoanWithRefs[];
    },
  });

  const reservations = useQuery({
    queryKey: ["reader-reservations", id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("reservations")
        .select("*, book:books(id,title,author), reader:readers(id,first_name,last_name,membership_number)")
        .eq("reader_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ReservationWithRefs[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: "active" | "suspended") => {
      const { error } = await sb.rpc("set_reader_status", { p_reader_id: id, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reader updated");
      qc.invalidateQueries({ queryKey: ["reader", id] });
      qc.invalidateQueries({ queryKey: ["readers"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelHold = useMutation({
    mutationFn: async (resId: string) => {
      const { error } = await sb.rpc("cancel_reservation", { p_reservation_id: resId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hold cancelled");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (reader.isLoading) return <div className="p-10">Loading…</div>;
  if (!reader.data) return <div className="p-10">Reader not found.</div>;

  const r = reader.data;
  const active = (loans.data ?? []).filter((l) => l.status === "active");
  const past = (loans.data ?? []).filter((l) => l.status === "returned");
  const activeRes = (reservations.data ?? []).filter((x) => x.status === "active");
  const pastRes = (reservations.data ?? []).filter((x) => x.status !== "active");

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <Link to="/$slug/app/readers" params={{ slug }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-4" /> All readers
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold">{r.first_name} {r.last_name}</h1>
            {r.status === "suspended" && <Badge variant="destructive">Suspended</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{r.membership_number}</p>
        </div>
        {r.status === "active" ? (
          <Button variant="outline" className="gap-2" onClick={() => {
            if (confirm(`Suspend ${r.first_name}? They won't be able to borrow or be reserved for books.`)) setStatus.mutate("suspended");
          }}>
            <Ban className="size-4" /> Suspend
          </Button>
        ) : (
          <Button variant="default" className="gap-2" onClick={() => setStatus.mutate("active")}>
            <CheckCircle2 className="size-4" /> Reactivate
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Contact</h3>
          <dl className="space-y-2 text-sm">
            <Row k="Email" v={r.email} />
            <Row k="Phone" v={r.phone} />
            <Row k="Address" v={r.address} />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Identity & status</h3>
          <dl className="space-y-2 text-sm">
            <Row k="ID type" v={r.id_document_type} />
            <Row k="ID number" v={r.id_document_number} />
            <Row k="Status" v={r.status === "active" ? "Active" : "Suspended"} />
          </dl>
        </Card>
      </div>

      <MemberLoginCard readerId={id} slug={slug} readerName={r.first_name} />



      <h2 className="text-xl font-semibold mb-3">Active holds</h2>
      {activeRes.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No active holds.</Card>
      ) : (
        <Card className="divide-y">
          {activeRes.map((res) => (
            <div key={res.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{res.book?.title}</div>
                <div className="text-xs text-muted-foreground">
                  Placed {format(new Date(res.created_at), "MMM d, yyyy")}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => {
                if (confirm("Cancel this hold?")) cancelHold.mutate(res.id);
              }}>Cancel</Button>
            </div>
          ))}
        </Card>
      )}

      <h2 className="text-xl font-semibold mt-10 mb-3">Active loans</h2>
      <LoansList loans={active} empty="No active loans." />

      <h2 className="text-xl font-semibold mt-10 mb-3">Past loans</h2>
      <LoansList loans={past} empty="No past loans." />

      {pastRes.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mt-10 mb-3">Past holds</h2>
          <Card className="divide-y">
            {pastRes.map((res) => (
              <div key={res.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{res.book?.title}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(res.created_at), "MMM d, yyyy")}</div>
                </div>
                <Badge variant="outline" className="capitalize">{res.status}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}
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

function LoansList({ loans, empty }: { loans: LoanWithRefs[]; empty: string }) {
  if (loans.length === 0) return <Card className="p-6 text-sm text-muted-foreground">{empty}</Card>;
  return (
    <Card className="divide-y">
      {loans.map((l) => (
        <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">{l.book?.title}</div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(l.checked_out_at), "MMM d, yyyy")} → Due {format(new Date(l.due_date), "MMM d, yyyy")}
              {l.returned_at && <> · Returned {format(new Date(l.returned_at), "MMM d, yyyy")}</>}
            </div>
          </div>
          {l.status === "returned"
            ? <Badge variant="secondary">Returned</Badge>
            : isOverdue(l)
              ? <Badge variant="destructive">OVERDUE</Badge>
              : <Badge>Active</Badge>}
        </div>
      ))}
    </Card>
  );
}

function MemberLoginCard({ readerId, slug, readerName }: { readerId: string; slug: string; readerName: string }) {
  const qc = useQueryClient();
  const lib = useCurrentLibrary();
  const staff = useCurrentStaff();
  const role = staff.data?.role;
  const canManage = role === "owner" || role === "admin" || role === "librarian";
  const portalEnabled = lib.data?.patron_portal_enabled === true;

  const status = useQuery({
    queryKey: ["reader-member-status", readerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_reader_member_status", { p_reader_id: readerId });
      if (error) throw error;
      return ((data ?? [])[0] as { has_login: boolean; pending_invitation_id: string | null; pending_token: string | null; pending_expires_at: string | null } | undefined) ?? null;
    },
    enabled: canManage,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_member_invitation", { p_reader_id: readerId });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async (token) => {
      toast.success("Activation link created");
      qc.invalidateQueries({ queryKey: ["reader-member-status", readerId] });
      // Look up reader email to send activation email
      const { data: r } = await supabase.from("readers").select("email, first_name, last_name").eq("id", readerId).maybeSingle();
      const emailAddr = (r as any)?.email as string | null | undefined;
      if (emailAddr) {
        reportInviteEmailOutcome(sendInviteEmail({
          templateName: "member-invite",
          recipientEmail: emailAddr,
          idempotencyKey: `member-invite-${token}`,
          libraryId: lib.data?.id ?? null,
          vars: {
            recipientName: [(r as any)?.first_name, (r as any)?.last_name].filter(Boolean).join(" ") || readerName,
            libraryName: lib.data?.name || "your library",
            role: "member",
            acceptUrl: `${window.location.origin}/${slug}/activate/${token}`,
            expiresIn: expiresInLabel(undefined),
          },
        }));
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_member_invitation", { p_invitation_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invitation revoked"); qc.invalidateQueries({ queryKey: ["reader-member-status", readerId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("disable_member_login", { p_reader_id: readerId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Login disabled"); qc.invalidateQueries({ queryKey: ["reader-member-status", readerId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!canManage) return null;

  const activationUrl = (token: string) =>
    `${window.location.origin}/${slug}/activate/${token}`;

  return (
    <Card className="p-5 mb-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <KeyRound className="size-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="font-semibold">Member login</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {portalEnabled
                ? `Give ${readerName} access to view their own loans and holds at /${slug}/account.`
                : "Enable the patron portal in Library settings to give readers their own login."}
            </p>
          </div>
        </div>
      </div>

      {portalEnabled && (
        <div className="mt-4">
          {status.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : status.data?.has_login ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Badge variant="secondary">Active member login</Badge>
              <Button size="sm" variant="outline" onClick={() => {
                if (confirm(`Disable ${readerName}'s login? They won't be able to sign in anymore.`)) disable.mutate();
              }}>
                <UserX className="size-4" /> Disable login
              </Button>
            </div>
          ) : status.data?.pending_token ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Pending activation</Badge>
                {status.data.pending_expires_at && (
                  <span className="text-xs text-muted-foreground">
                    Expires {format(new Date(status.data.pending_expires_at), "MMM d, yyyy")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={activationUrl(status.data.pending_token)}
                  className="flex-1 text-xs bg-muted px-3 py-2 rounded border font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(activationUrl(status.data!.pending_token!));
                  toast.success("Link copied");
                }}>
                  <Copy className="size-3.5" /> Copy
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  if (confirm("Revoke this activation link?")) revoke.mutate(status.data!.pending_invitation_id!);
                }}>
                  Revoke
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Send this link to {readerName} so they can set their password.</p>
            </div>
          ) : (
            <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
              <KeyRound className="size-4" /> Enable login
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
