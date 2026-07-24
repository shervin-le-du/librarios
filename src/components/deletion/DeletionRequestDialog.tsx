import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCurrentStaff, roleCan } from "@/lib/use-current-staff";

type EntityType = "book" | "reader";

export function DeletionRequestDialog({
  open, onOpenChange, entityType, entityId, entityLabel,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
}) {
  const qc = useQueryClient();
  const staff = useCurrentStaff();
  const role = staff.data?.role;
  const canDelete = roleCan(role, entityType === "book" ? "delete_books" : "delete_readers");
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("request_entity_deletion", {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_reason: reason.trim() || undefined,
      });
      if (error) throw error;
      return data as { status: "deleted" | "requested"; request_id: string };
    },
    onSuccess: (res) => {
      if (res.status === "deleted") toast.success(entityType === "book" ? "Book deleted" : "Reader deleted");
      else toast.success("Deletion request submitted for review");
      onOpenChange(false);
      setReason("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const title = canDelete
    ? `Delete ${entityType === "book" ? "book" : "reader"}`
    : `Request deletion`;

  const description = canDelete
    ? `This will permanently remove "${entityLabel}". This action cannot be undone.`
    : `Your request will be reviewed by a librarian or admin before "${entityLabel}" is deleted.`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setReason(""); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="deletion-reason">
            {canDelete ? "Note (optional)" : "Reason (optional but helpful)"}
          </Label>
          <Textarea id="deletion-reason" rows={3} value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={canDelete ? "Why is this being deleted?" : "Damaged copy, duplicate entry, member request…"} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={canDelete ? "destructive" : "default"} onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending
              ? (canDelete ? "Deleting…" : "Submitting…")
              : (canDelete ? "Delete" : "Submit request")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
