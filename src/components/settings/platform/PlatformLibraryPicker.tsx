import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Lib = {
  id: string; name: string; subdomain: string; status: "active" | "suspended";
  staff_count: number; reader_count: number; book_count: number; created_at: string;
};

export function PlatformLibraryPicker({
  onSessionStarted,
}: {
  onSessionStarted: () => void;
}) {
  const qc = useQueryClient();
  const [libraryId, setLibraryId] = useState<string>("");
  const [reason, setReason] = useState("Settings access");

  const libraries = useQuery({
    queryKey: ["platform-libraries"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_libraries");
      if (error) throw error;
      return (data ?? []) as Lib[];
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!libraryId) throw new Error("Pick a library");
      const { error } = await supabase.rpc("start_support_session",
        { p_library_id: libraryId, p_reason: reason || "Settings access" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["active-support-session"] });
      await qc.invalidateQueries({ queryKey: ["current-library"] });
      toast.success("Support session started");
      onSessionStarted();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Library</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a library to view or edit its settings. Opening a library starts an audited support session.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Library</Label>
          <Select value={libraryId} onValueChange={setLibraryId}>
            <SelectTrigger>
              <SelectValue placeholder={libraries.isLoading ? "Loading…" : "Choose a library"} />
            </SelectTrigger>
            <SelectContent>
              {(libraries.data ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} <span className="text-muted-foreground font-mono">/{l.subdomain}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason (recorded)</Label>
          <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. ticket #1234 — fix settings" />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => start.mutate()} disabled={!libraryId || start.isPending}>
            {start.isPending ? "Starting…" : "Open library settings"}
          </Button>
        </div>
      </Card>
    </section>
  );
}
