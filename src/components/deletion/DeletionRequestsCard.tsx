import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentStaff, roleCan } from "@/lib/use-current-staff";

type Row = {
  id: string;
  entity_type: "book" | "reader";
  entity_id: string;
  entity_label: string | null;
  reason: string | null;
  status: string;
  requested_by: string;
  requester_name: string | null;
  requester_email: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export function DeletionRequestsCard({ entityType }: { entityType: "book" | "reader" }) {
  const qc = useQueryClient();
  const staff = useCurrentStaff();
  const role = staff.data?.role;
  const libId = staff.data?.library_id;
  const canApprove = roleCan(role, "approve_deletions");

  const q = useQuery({
    queryKey: ["deletion-requests", libId, entityType],
    enabled: !!libId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_deletion_requests", {
        p_library_id: libId!,
        p_status: "pending",
      });
      if (error) throw error;
      return (data as Row[]).filter((r) => r.entity_type === entityType);
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("approve_deletion_request", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deletion approved"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reject_deletion_request", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deletion rejected"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_deletion_request", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request cancelled"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="p-4 mb-4 border-amber-300 bg-amber-50/40">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="size-4 text-amber-700" />
        <h3 className="font-semibold text-sm">
          {rows.length} pending deletion {rows.length === 1 ? "request" : "requests"}
        </h3>
      </div>
      <div className="divide-y">
        {rows.map((r) => {
          const isMine = r.requested_by === staff.data?.id;
          return (
            <div key={r.id} className="py-2.5 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.entity_label ?? r.entity_id}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Requested by {r.requester_name || r.requester_email || "unknown"}
                  {r.reason ? <> · <span className="italic">"{r.reason}"</span></> : null}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline">Pending</Badge>
                {canApprove && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => reject.mutate(r.id)} disabled={reject.isPending}>
                      <X className="size-3.5" /> Reject
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                      <Check className="size-3.5" /> Approve & delete
                    </Button>
                  </>
                )}
                {!canApprove && isMine && (
                  <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)} disabled={cancel.isPending}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
