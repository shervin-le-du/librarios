import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Trash2, Settings2, Send } from "lucide-react";
import { EmailSettingsEditor } from "@/components/email/EmailSettingsEditor";
import { sendInviteEmail, expiresInLabel, reportInviteEmailOutcome } from "@/lib/email/send-invite";
import { copyText } from "@/lib/clipboard";

import { assignableRoles, staffRoleLabel, STAFF_ROLE_RANK, type StaffRole } from "@/lib/use-current-staff";

type InviteRole = Exclude<StaffRole, "owner">;

type Staff = { id: string; email: string | null; full_name: string | null; role: StaffRole; status: "active" | "invited" | "disabled" };
type Invite = { id: string; email: string; role: InviteRole; status: "pending" | "accepted" | "revoked"; token: string; created_at: string; first_name: string | null; last_name: string | null };

export function LibraryTeamSection() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<InviteRole>("librarian");
  const [openConfig, setOpenConfig] = useState(false);

  const staff = useQuery({
    queryKey: ["team-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_users")
        .select("id, email, full_name, role, status")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Staff[];
    },
  });

  const invites = useQuery({
    queryKey: ["team-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, token, created_at, first_name, last_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invite[];
    },
  });

  const me = useQuery({
    queryKey: ["current-staff"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_current_staff");
      return (data ?? [])[0] as (Staff & { library_id: string }) | undefined;
    },
  });

  function displayName(first: string | null, last: string | null, fallbackEmail: string) {
    const n = [first ?? "", last ?? ""].map(s => s.trim()).filter(Boolean).join(" ");
    return n || fallbackEmail.split("@")[0];
  }

  const createInvite = useMutation({
    mutationFn: async () => {
      const invitedEmail = email.trim().toLowerCase();
      const invitedRole = role;
      const fn = firstName.trim() || null;
      const ln = lastName.trim() || null;
      const { data: lib } = await supabase.rpc("get_current_staff");
      let library_id = (lib ?? [])[0]?.library_id as string | undefined;
      if (!library_id) {
        const { data: ses } = await supabase.rpc("get_active_support_session");
        library_id = (ses ?? [])[0]?.library_id as string | undefined;
        if (!library_id) throw new Error("Library not found");
      }
      const { data, error } = await supabase.from("invitations")
        .insert({ email: invitedEmail, role: invitedRole, library_id, invited_by: me.data?.id ?? null, first_name: fn, last_name: ln })
        .select("token").single();
      if (error) throw error;
      return { token: data.token as string, library_id, invitedEmail, invitedRole, fn, ln };
    },
    onSuccess: ({ token, library_id, invitedEmail, invitedRole, fn, ln }) => {
      const link = `${window.location.origin}/accept-invite?token=${token}`;
      setEmail(""); setFirstName(""); setLastName("");
      qc.invalidateQueries({ queryKey: ["team-invites"] });
      toast.success("Invitation created");
      reportInviteEmailOutcome(sendInviteEmail({
        templateName: "library-staff-invite",
        recipientEmail: invitedEmail,
        idempotencyKey: `library-staff-invite-${token}`,
        libraryId: library_id,
        vars: {
          recipientName: displayName(fn, ln, invitedEmail),
          inviterName: me.data?.full_name || me.data?.email || "A colleague",
          libraryName: (me.data as any)?.library_name || "the library",
          role: invitedRole,
          acceptUrl: link,
          expiresIn: expiresInLabel(undefined),
        },
      }));
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to invite"),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-invites"] }); toast.success("Invite revoked"); },
    onError: (err: any) => toast.error(err.message),
  });

  const resendInvite = useMutation({
    mutationFn: async (i: Invite) => {
      const link = `${window.location.origin}/accept-invite?token=${i.token}`;
      const res = await sendInviteEmail({
        templateName: "library-staff-invite",
        recipientEmail: i.email,
        idempotencyKey: `library-staff-invite-${i.token}-resend-${Date.now()}`,
        libraryId: me.data?.library_id,
        vars: {
          recipientName: displayName(i.first_name, i.last_name, i.email),
          inviterName: me.data?.full_name || me.data?.email || "A colleague",
          libraryName: (me.data as any)?.library_name || "the library",
          role: i.role,
          acceptUrl: link,
          expiresIn: expiresInLabel(undefined),
        },
      });
      if ("skipped" in res && res.skipped) {
        throw new Error(`Email could not be re-sent: ${res.detail ?? res.reason}`);
      }
    },
    onSuccess: () => toast.success("Invitation email re-sent"),
    onError: (err: any) => toast.error(err.message ?? "Failed to resend"),
  });

  const updateStaff = useMutation({
    mutationFn: async (p: { id: string; role?: StaffRole; status?: string }) => {
      const patch: { role?: string; status?: string } = {};
      if (p.role) patch.role = p.role;
      if (p.status) patch.status = p.status;
      const { error } = await supabase.from("staff_users").update(patch).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-staff"] }); toast.success("Saved"); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <section id="library-team" className="space-y-6 scroll-mt-20">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground mt-1">Invite colleagues and manage staff roles. Exactly one owner per library.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpenConfig(true)}>
          <Settings2 className="size-3.5" /> Configure invitation email
        </Button>
      </div>

      <EmailSettingsEditor
        open={openConfig}
        onOpenChange={setOpenConfig}
        templateKey="library-staff-invite"
        scope="library"
        libraryId={me.data?.library_id}
      />

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Invite staff</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); createInvite.mutate(); }}
          className="grid sm:grid-cols-2 gap-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-first">First name</Label>
            <Input id="invite-first" value={firstName}
              onChange={(e) => setFirstName(e.target.value)} placeholder="Jamie" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-last">Last name</Label>
            <Input id="invite-last" value={lastName}
              onChange={(e) => setLastName(e.target.value)} placeholder="Rivera" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="colleague@example.com" />
            <p className="text-xs text-muted-foreground">They'll be able to confirm their name when they set their password.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(assignableRoles(me.data?.role) as InviteRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{staffRoleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={createInvite.isPending}>Create invite</Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Pending invitations</h3>
        {invites.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
          (invites.data ?? []).filter(i => i.status === "pending").length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <div className="divide-y">
              {(invites.data ?? []).filter(i => i.status === "pending").map((i) => {
                const link = `${window.location.origin}/accept-invite?token=${i.token}`;
                const label = displayName(i.first_name, i.last_name, i.email);
                return (
                  <div key={i.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{label}</div>
                      <div className="text-xs text-muted-foreground truncate">{i.email} · <span className="capitalize">{i.role}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyText(link, "Link copied")}>
                        <Copy className="size-3.5" /> Copy link
                      </Button>
                      <Button size="sm" variant="outline"
                        disabled={resendInvite.isPending}
                        onClick={() => resendInvite.mutate(i)}>
                        <Send className="size-3.5" /> {resendInvite.isPending && resendInvite.variables?.id === i.id ? "Sending…" : "Resend"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => revokeInvite.mutate(i.id)}>
                        <Trash2 className="size-3.5" /> Revoke
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Staff</h3>
        {staff.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="divide-y">
            {(staff.data ?? []).map((s) => {
              const isMe = s.id === me.data?.id;
              const isOwner = s.role === "owner";
              const meRank = me.data ? STAFF_ROLE_RANK[me.data.role] : 0;
              const targetRank = STAFF_ROLE_RANK[s.role];
              const outranked = targetRank >= meRank;
              const lockedByHierarchy = !isMe && outranked;
              const assignable = assignableRoles(me.data?.role);
              return (
                <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.full_name || s.email} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === "active" ? "secondary" : s.status === "disabled" ? "destructive" : "outline"}>
                      {s.status}
                    </Badge>
                    <Select
                      value={s.role}
                      disabled={isMe || lockedByHierarchy}
                      onValueChange={(v) => updateStaff.mutate({ id: s.id, role: v as StaffRole })}
                    >
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                        {assignable.map((r) => (
                          <SelectItem key={r} value={r}>{staffRoleLabel(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isMe && !lockedByHierarchy && (
                      s.status === "disabled" ? (
                        <Button size="sm" variant="outline"
                          onClick={() => updateStaff.mutate({ id: s.id, status: "active" })}>Enable</Button>
                      ) : (
                        <Button size="sm" variant="ghost"
                          onClick={() => updateStaff.mutate({ id: s.id, status: "disabled" })}>Disable</Button>
                      )
                    )}
                    {lockedByHierarchy && (
                      <Badge variant="outline" className="text-xs">{isOwner ? "Owner — protected" : "Outranks you"}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
