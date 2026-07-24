import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Trash2, Plus, Settings2, CheckCircle2, Send } from "lucide-react";
import { usePlatformAdmin, platformRoleLabel, type PlatformRole } from "@/lib/use-platform";
import { EmailSettingsEditor } from "@/components/email/EmailSettingsEditor";
import { sendInviteEmail, expiresInLabel } from "@/lib/email/send-invite";
import { copyText } from "@/lib/clipboard";

type LibStatus = "active" | "suspended" | "pending_setup";
type Lib = {
  id: string; name: string; subdomain: string; status: LibStatus;
  staff_count: number; reader_count: number; book_count: number; created_at: string;
};
type OwnerInvite = {
  id: string; email: string; library_id: string; library_name: string; library_slug: string;
  status: "pending" | "accepted" | "revoked"; token: string; created_at: string; expires_at: string;
  first_name: string | null; last_name: string | null;
};
type AdminUser = { id: string; email: string; full_name: string | null; role: PlatformRole; created_at: string };
type AdminInvite = {
  id: string; email: string; role: PlatformRole;
  status: "pending" | "accepted" | "revoked"; token: string; created_at: string; expires_at: string;
  first_name: string | null; last_name: string | null;
};
type LibraryMembership = { library_id: string; library_name: string; library_slug: string; role: string; status: string };
type PlatformUser = {
  id: string; email: string; full_name: string | null;
  created_at: string; last_sign_in_at: string | null;
  platform_role: PlatformRole | null;
  library_memberships: LibraryMembership[];
};

function copyLink(link: string) { void copyText(link, "Link copied"); }

function displayName(first: string | null, last: string | null, fallbackEmail: string) {
  const n = [first ?? "", last ?? ""].map(s => s.trim()).filter(Boolean).join(" ");
  return n || fallbackEmail.split("@")[0];
}

// (Placeholder ConfigureEmailDialog removed — replaced by EmailSettingsEditor)



// ---------- Libraries tab ----------
function LibrariesTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = usePlatformAdmin();
  const isSuper = me.data?.role === "owner" || me.data?.role === "super_admin";

  const [openInvite, setOpenInvite] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [openSupportFor, setOpenSupportFor] = useState<Lib | null>(null);
  const [reason, setReason] = useState("");
  const [deleteLib, setDeleteLib] = useState<Lib | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const libraries = useQuery({
    queryKey: ["platform-libraries"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_libraries");
      if (error) throw error;
      return (data ?? []) as Lib[];
    },
  });

  const invites = useQuery({
    queryKey: ["platform-owner-invites"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_library_owner_invites");
      if (error) throw error;
      return (data ?? []) as OwnerInvite[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (p: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase.rpc("platform_set_library_status",
        { p_library_id: p.id, p_status: p.status });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-libraries"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const startSession = useMutation({
    mutationFn: async (lib: Lib) => {
      const { data, error } = await supabase.rpc("start_support_session",
        { p_library_id: lib.id, p_reason: reason });
      if (error) throw error;
      return { slug: lib.subdomain, id: data };
    },
    onSuccess: ({ slug }) => {
      setOpenSupportFor(null); setReason("");
      qc.invalidateQueries({ queryKey: ["active-support-session"] });
      toast.success("Support session started");
      router.navigate({ to: "/$slug/app/dashboard", params: { slug } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const fn = firstName.trim() || null;
      const ln = lastName.trim() || null;
      const { data, error } = await supabase.rpc("platform_invite_library_owner", {
        p_name: name.trim(), p_slug: slug.trim(), p_email: email.trim(),
        p_first_name: fn ?? undefined, p_last_name: ln ?? undefined,
      });
      if (error) throw error;
      const row = (data ?? [])[0] as { token: string; library_id: string };
      return { token: row.token, libraryId: row.library_id, recipient: email.trim(), libraryName: name.trim(), fn, ln };
    },
    onSuccess: async ({ token, libraryId, recipient, libraryName, fn, ln }) => {
      const link = `${window.location.origin}/accept-invite?token=${token}&kind=owner`;
      setCreatedLink(link);
      setName(""); setSlug(""); setEmail(""); setFirstName(""); setLastName("");
      qc.invalidateQueries({ queryKey: ["platform-libraries"] });
      qc.invalidateQueries({ queryKey: ["platform-owner-invites"] });
      toast.success("Invitation created");
      void sendInviteEmail({
        templateName: "library-owner-invite",
        recipientEmail: recipient,
        idempotencyKey: `library-owner-invite-${token}`,
        libraryId,
        vars: {
          recipientName: displayName(fn, ln, recipient),
          inviterName: me.data?.full_name || me.data?.email || "Platform team",
          libraryName,
          role: "owner",
          acceptUrl: link,
          expiresIn: expiresInLabel(undefined),
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("platform_revoke_library_owner_invite", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-owner-invites"] });
      toast.success("Invite revoked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendInvite = useMutation({
    mutationFn: async (i: OwnerInvite) => {
      const link = `${window.location.origin}/accept-invite?token=${i.token}&kind=owner`;
      const res = await sendInviteEmail({
        templateName: "library-owner-invite",
        recipientEmail: i.email,
        idempotencyKey: `library-owner-invite-${i.token}-resend-${Date.now()}`,
        libraryId: i.library_id,
        vars: {
          recipientName: displayName(i.first_name, i.last_name, i.email),
          inviterName: me.data?.full_name || me.data?.email || "Platform team",
          libraryName: i.library_name,
          role: "owner",
          acceptUrl: link,
          expiresIn: expiresInLabel(undefined),
        },
      });
      if ("skipped" in res && res.skipped) throw new Error("Email could not be re-sent");
    },
    onSuccess: () => toast.success("Invitation email re-sent"),
    onError: (e: any) => toast.error(e.message ?? "Failed to resend"),
  });

  const deleteLibrary = useMutation({
    mutationFn: async (lib: Lib) => {
      const { error } = await supabase.rpc("platform_delete_library", { p_library_id: lib.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteLib(null); setDeleteConfirm("");
      qc.invalidateQueries({ queryKey: ["platform-libraries"] });
      toast.success("Library deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {isSuper
            ? "Invite new library owners, start scoped support sessions, or suspend tenants."
            : "Invite new library owners or start a scoped support session."}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpenConfig(true)}>
            <Settings2 className="size-3.5" />
          </Button>
          <Button size="sm" onClick={() => { setCreatedLink(null); setOpenInvite(true); }}>
            <Plus className="size-3.5" /> Invite
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {libraries.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (libraries.data ?? []).length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No libraries yet.</div>
        ) : (
          <div className="divide-y">
            {(libraries.data ?? []).map((l) => (
              <div key={l.id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{l.name}</span>
                    <LibraryStatusBadge status={l.status} />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">/{l.subdomain}</div>
                </div>
                <div className="text-xs text-muted-foreground hidden md:flex gap-4">
                  <span>{l.staff_count} staff</span>
                  <span>{l.reader_count} readers</span>
                  <span>{l.book_count} books</span>
                </div>
                <div className="flex gap-2">
                  {isSuper && l.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "suspended" })}>
                      Suspend
                    </Button>
                  )}
                  {isSuper && l.status === "suspended" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "active" })}>
                      Reactivate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/$slug" params={{ slug: l.subdomain }}>Open</Link>
                  </Button>
                  <Button size="sm" onClick={() => setOpenSupportFor(l)}>Start support session</Button>
                  {isSuper && (
                    <Button size="sm" variant="destructive" onClick={() => { setDeleteLib(l); setDeleteConfirm(""); }}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>

            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Pending owner invitations</h3>
        {invites.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (invites.data ?? []).filter(i => i.status === "pending").length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <div className="divide-y">
            {(invites.data ?? []).filter(i => i.status === "pending").map((i) => {
              const link = `${window.location.origin}/accept-invite?token=${i.token}&kind=owner`;
              const label = displayName(i.first_name, i.last_name, i.email);
              return (
                <div key={i.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{label}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {i.email} · {i.library_name} <span className="font-mono">/{i.library_slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLink(link)}>
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

      {/* Support session dialog */}
      <Dialog open={!!openSupportFor} onOpenChange={(o) => { if (!o) { setOpenSupportFor(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start support session</DialogTitle>
            <DialogDescription>
              You'll get admin-level access to <strong>{openSupportFor?.name}</strong> until you end the session.
              This is audited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (recorded)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. ticket #1234 — fix duplicate reader" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenSupportFor(null); setReason(""); }}>Cancel</Button>
            <Button disabled={startSession.isPending || !openSupportFor}
              onClick={() => openSupportFor && startSession.mutate(openSupportFor)}>
              {startSession.isPending ? "Starting…" : "Start session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite library owner dialog */}
      <Dialog open={openInvite} onOpenChange={(o) => { setOpenInvite(o); if (!o) setCreatedLink(null); }}>
        <DialogContent className={createdLink ? "sm:max-w-[520px]" : undefined}>
          {createdLink ? (
            <InviteCreatedPanel
              title="Invitation ready"
              description="The library has been created and is waiting for the owner to complete setup. Share this link with them:"
              link={createdLink}
              onDone={() => setOpenInvite(false)}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Invite a new library owner</DialogTitle>
                <DialogDescription>
                  We'll create the library — it stays in <strong>awaiting setup</strong> until the owner accepts — and generate an invite link.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); createInvite.mutate(); }}
                className="space-y-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="lib-name">Library name</Label>
                  <Input id="lib-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lib-slug">Subdomain</Label>
                  <Input id="lib-slug" required value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="my-library" pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?" minLength={3} maxLength={30} />
                  <p className="text-xs text-muted-foreground">Lowercase letters, numbers and hyphens (3–30 chars).</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="lib-owner-first">Owner first name</Label>
                    <Input id="lib-owner-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ada" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lib-owner-last">Owner last name</Label>
                    <Input id="lib-owner-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Lovelace" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lib-owner-email">Owner email</Label>
                  <Input id="lib-owner-email" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" />
                  <p className="text-xs text-muted-foreground">They can confirm their name when they set their password.</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpenInvite(false)}>Cancel</Button>
                  <Button type="submit" disabled={createInvite.isPending}>
                    {createInvite.isPending ? "Creating…" : "Create invite"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>


      <EmailSettingsEditor
        open={openConfig}
        onOpenChange={setOpenConfig}
        templateKey="library-owner-invite"
        scope="platform"
      />

      <Dialog open={!!deleteLib} onOpenChange={(o) => { if (!o) { setDeleteLib(null); setDeleteConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete library</DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{deleteLib?.name}</strong> and all of its books,
              readers, loans, staff, and invitations. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-slug-admin">Type <span className="font-mono">{deleteLib?.subdomain}</span> to confirm</Label>
            <Input id="confirm-slug-admin" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteLib(null); setDeleteConfirm(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteLibrary.isPending || !deleteLib || deleteConfirm !== deleteLib?.subdomain}
              onClick={() => deleteLib && deleteLibrary.mutate(deleteLib)}
            >
              {deleteLibrary.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Team tab ----------
function TeamTab() {
  const qc = useQueryClient();
  const me = usePlatformAdmin();
  const myRole = me.data?.role;
  const isOwner = myRole === "owner";
  const canManageAdmins = myRole === "owner" || myRole === "super_admin";

  const [openInvite, setOpenInvite] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<PlatformRole>("admin");
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const admins = useQuery({
    queryKey: ["platform-admins"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_admins");
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });

  const invites = useQuery({
    queryKey: ["platform-admin-invites"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_admin_invites");
      if (error) throw error;
      return (data ?? []) as AdminInvite[];
    },
  });





  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("platform_revoke_role", { p_user_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-admins"] }); toast.success("Role revoked"); },
    onError: (e: any) => toast.error(e.message),
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const invitedEmail = email.trim();
      const invitedRole = role;
      const fn = firstName.trim() || null;
      const ln = lastName.trim() || null;
      const { data, error } = await supabase.rpc("platform_invite_admin",
        { p_email: invitedEmail, p_role: invitedRole, p_first_name: fn ?? undefined, p_last_name: ln ?? undefined });
      if (error) throw error;
      const row = (data ?? [])[0] as { token: string };
      return { token: row.token, recipient: invitedEmail, invitedRole, fn, ln };
    },
    onSuccess: async ({ token, recipient, invitedRole, fn, ln }) => {
      const link = `${window.location.origin}/accept-invite?token=${token}&kind=platform`;
      setCreatedLink(link);
      setEmail(""); setFirstName(""); setLastName("");
      qc.invalidateQueries({ queryKey: ["platform-admin-invites"] });
      toast.success("Invitation created");
      void sendInviteEmail({
        templateName: "platform-admin-invite",
        recipientEmail: recipient,
        idempotencyKey: `platform-admin-invite-${token}`,
        vars: {
          recipientName: displayName(fn, ln, recipient),
          inviterName: me.data?.full_name || me.data?.email || "Platform owner",
          role: platformRoleLabel(invitedRole),
          acceptUrl: link,
          expiresIn: expiresInLabel(undefined),
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("platform_revoke_admin_invite", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-admin-invites"] });
      toast.success("Invite revoked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendInvite = useMutation({
    mutationFn: async (i: AdminInvite) => {
      const link = `${window.location.origin}/accept-invite?token=${i.token}&kind=platform`;
      const res = await sendInviteEmail({
        templateName: "platform-admin-invite",
        recipientEmail: i.email,
        idempotencyKey: `platform-admin-invite-${i.token}-resend-${Date.now()}`,
        vars: {
          recipientName: displayName(i.first_name, i.last_name, i.email),
          inviterName: me.data?.full_name || me.data?.email || "Platform owner",
          role: platformRoleLabel(i.role),
          acceptUrl: link,
          expiresIn: expiresInLabel(undefined),
        },
      });
      if ("skipped" in res && res.skipped) throw new Error("Email could not be re-sent");
    },
    onSuccess: () => toast.success("Invitation email re-sent"),
    onError: (e: any) => toast.error(e.message ?? "Failed to resend"),
  });

  const canRevoke = (targetRole: PlatformRole) => {
    if (targetRole === "owner") return false;
    if (targetRole === "super_admin") return isOwner;
    return canManageAdmins; // admin
  };





  const roleBadgeVariant = (r: PlatformRole): "default" | "secondary" | "outline" =>
    r === "owner" ? "default" : r === "super_admin" ? "secondary" : "outline";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Manage the full platform team. Only you can grant or revoke super admins."
            : canManageAdmins
              ? "Manage day-to-day admins. Only the owner can grant super admins."
              : "Only the owner or super admins can manage the platform team."}
        </p>
        {canManageAdmins && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenConfig(true)}>
              <Settings2 className="size-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreatedLink(null);
                setRole(isOwner ? "super_admin" : "admin");
                setOpenInvite(true);
              }}
            >
              <Plus className="size-3.5" /> Invite
            </Button>
          </div>
        )}
      </div>

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Platform team</h3>
        {admins.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="divide-y">
            {(admins.data ?? []).map((a) => {
              const isMe = a.id === me.data?.id;
              const showRevoke = canRevoke(a.role) && !isMe;
              return (
                <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {a.full_name || a.email} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={roleBadgeVariant(a.role)}>{platformRoleLabel(a.role)}</Badge>
                    {showRevoke && (
                      <Button size="sm" variant="ghost" onClick={() => revoke.mutate(a.id)}>
                        <Trash2 className="size-3.5" /> Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {canManageAdmins && (
        <Card className="p-6">
          <h3 className="text-base font-semibold mb-4">Pending invitations</h3>
          {invites.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (invites.data ?? []).filter(i => i.status === "pending").length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <div className="divide-y">
              {(invites.data ?? []).filter(i => i.status === "pending").map((i) => {
                const link = `${window.location.origin}/accept-invite?token=${i.token}&kind=platform`;
                const label = displayName(i.first_name, i.last_name, i.email);
                return (
                  <div key={i.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{label}</div>
                      <div className="text-xs text-muted-foreground truncate">{i.email} · {platformRoleLabel(i.role)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyLink(link)}>
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
      )}





      <Dialog open={openInvite} onOpenChange={(o) => { setOpenInvite(o); if (!o) setCreatedLink(null); }}>
        <DialogContent className={createdLink ? "sm:max-w-[520px]" : undefined}>
          {createdLink ? (
            <InviteCreatedPanel
              title="Invitation ready"
              description="Share this link with the invitee. Their role will be granted the moment they sign up."
              link={createdLink}
              onDone={() => setOpenInvite(false)}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Invite a platform team member</DialogTitle>
                <DialogDescription>
                  We'll generate a link that grants the chosen role when the invitee signs up.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); createInvite.mutate(); }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-first">First name</Label>
                    <Input id="admin-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ada" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-last">Last name</Label>
                    <Input id="admin-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Lovelace" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input id="admin-email" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
                  <p className="text-xs text-muted-foreground">They can confirm their name when they set their password.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as PlatformRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isOwner && <SelectItem value="super_admin">Super admin</SelectItem>}
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpenInvite(false)}>Cancel</Button>
                  <Button type="submit" disabled={createInvite.isPending}>
                    {createInvite.isPending ? "Creating…" : "Create invite"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>


      <EmailSettingsEditor
        open={openConfig}
        onOpenChange={setOpenConfig}
        templateKey="platform-admin-invite"
        scope="platform"
      />
    </div>
  );
}

// ---------- Accounts tab ----------
function AccountsTab() {
  const qc = useQueryClient();
  const me = usePlatformAdmin();
  const myRole = me.data?.role;
  const isOwner = myRole === "owner";
  const canManage = myRole === "owner" || myRole === "super_admin";

  const [confirmDelete, setConfirmDelete] = useState<PlatformUser | null>(null);

  const allUsers = useQuery({
    queryKey: ["platform-all-users"],
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_all_users");
      if (error) throw error;
      return (data ?? []) as PlatformUser[];
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("platform_delete_user", { p_user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-all-users"] });
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
      setConfirmDelete(null);
      toast.success("Account deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canDeleteUser = (u: PlatformUser) => {
    if (!canManage) return false;
    if (u.id === me.data?.id) return false;
    if (u.platform_role === "owner") return false;
    if (u.platform_role === "super_admin") return isOwner;
    return true;
  };

  const roleBadgeVariant = (r: PlatformRole): "default" | "secondary" | "outline" =>
    r === "owner" ? "default" : r === "super_admin" ? "secondary" : "outline";

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the owner or super admins can view all accounts.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every user that has ever signed up on the platform — platform team, library staff, and accounts with no role. Deleting removes the account permanently.
      </p>

      <Card className="p-6">
        {allUsers.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (allUsers.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <div className="divide-y">
            {(allUsers.data ?? []).map((u) => {
              const isMe = u.id === me.data?.id;
              const roleLabel = u.platform_role
                ? platformRoleLabel(u.platform_role)
                : u.library_memberships.length > 0
                  ? `Library ${u.library_memberships[0].role}${u.library_memberships.length > 1 ? ` +${u.library_memberships.length - 1}` : ""}`
                  : "No role";
              return (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {u.full_name || u.email} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={u.platform_role ? roleBadgeVariant(u.platform_role) : "outline"}>
                      {roleLabel}
                    </Badge>
                    {canDeleteUser(u) && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(u)}>
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{confirmDelete?.email}</strong>? This removes their login,
              any platform role, and their staff memberships. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => confirmDelete && deleteUser.mutate(confirmDelete.id)}
            >
              {deleteUser.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PlatformAdminSection() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform Admin</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage libraries on the platform and the platform team.
        </p>
      </div>
      <Tabs defaultValue="libraries" className="w-full">
        <TabsList>
          <TabsTrigger value="libraries">Libraries</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="accounts">All accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="libraries" className="mt-4">
          <LibrariesTab />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <TeamTab />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}


function LibraryStatusBadge({ status }: { status: LibStatus }) {
  if (status === "active") return <Badge variant="secondary">Active</Badge>;
  if (status === "pending_setup") {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
        Awaiting setup
      </Badge>
    );
  }
  return <Badge variant="destructive">Suspended</Badge>;
}

function InviteCreatedPanel({
  title, description, link, onDone,
}: { title: string; description: string; link: string; onDone: () => void }) {
  return (
    <div className="space-y-5">
      <DialogHeader className="space-y-2">
        <div className="mx-auto size-11 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <CheckCircle2 className="size-6" />
        </div>
        <DialogTitle className="text-center">{title}</DialogTitle>
        <DialogDescription className="text-center">{description}</DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Invitation link</div>
        <code className="block text-xs break-all font-mono leading-relaxed">{link}</code>
      </div>

      <DialogFooter className="sm:justify-between gap-2">
        <Button variant="ghost" onClick={onDone}>Done</Button>
        <Button onClick={() => copyLink(link)}>
          <Copy className="size-3.5" /> Copy link
        </Button>
      </DialogFooter>
    </div>
  );
}

