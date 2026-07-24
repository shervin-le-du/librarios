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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePlatformAdmin } from "@/lib/use-platform";

type LibStatus = "active" | "suspended" | "pending_setup";
type Lib = {
  id: string; name: string; subdomain: string; status: LibStatus;
  staff_count: number; reader_count: number; book_count: number; created_at: string;
};

export function PlatformLibrariesSection() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = usePlatformAdmin();
  const isSuper = me.data?.role === "owner" || me.data?.role === "super_admin";
  const [openLib, setOpenLib] = useState<Lib | null>(null);
  const [reason, setReason] = useState("");
  const [deleteLib, setDeleteLib] = useState<Lib | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const libraries = useQuery({
    queryKey: ["platform-libraries"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_libraries");
      if (error) throw error;
      return (data ?? []) as Lib[];
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
      setOpenLib(null); setReason("");
      qc.invalidateQueries({ queryKey: ["active-support-session"] });
      toast.success("Support session started");
      router.navigate({ to: "/$slug/app/dashboard", params: { slug } });
    },
    onError: (e: any) => toast.error(e.message),
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
      <div>
        <h2 className="text-2xl font-semibold">Libraries</h2>
        <p className="text-sm text-muted-foreground">
          {isSuper
            ? "Suspend/reactivate tenants or start a scoped support session."
            : "Start a scoped support session. Only super admins can suspend tenants."}
        </p>
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
                    {l.status === "active" ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : l.status === "pending_setup" ? (
                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        Awaiting setup
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Suspended</Badge>
                    )}
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
                  <Button size="sm" onClick={() => setOpenLib(l)}>Start support session</Button>
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

      <Dialog open={!!openLib} onOpenChange={(o) => { if (!o) { setOpenLib(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start support session</DialogTitle>
            <DialogDescription>
              You'll get admin-level access to <strong>{openLib?.name}</strong> until you end the session.
              This is audited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (recorded)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. ticket #1234 — fix duplicate reader" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpenLib(null); setReason(""); }}>Cancel</Button>
            <Button disabled={startSession.isPending || !openLib}
              onClick={() => openLib && startSession.mutate(openLib)}>
              {startSession.isPending ? "Starting…" : "Start session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Label htmlFor="confirm-slug">Type <span className="font-mono">{deleteLib?.subdomain}</span> to confirm</Label>
            <Input id="confirm-slug" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
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
