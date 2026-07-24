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
import { Trash2 } from "lucide-react";
import { usePlatformAdmin, type PlatformRole } from "@/lib/use-platform";

type Admin = { id: string; email: string; full_name: string | null; role: PlatformRole; created_at: string };

export function PlatformTeamSection() {
  const qc = useQueryClient();
  const me = usePlatformAdmin();
  const isSuper = me.data?.role === "super_admin";

  const [grantEmail, setGrantEmail] = useState("");
  const [grantRole, setGrantRole] = useState<PlatformRole>("admin");

  const admins = useQuery({
    queryKey: ["platform-admins"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_list_admins");
      if (error) throw error;
      return (data ?? []) as Admin[];
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("platform_grant_role",
        { p_email: grantEmail, p_role: grantRole });
      if (error) throw error;
    },
    onSuccess: () => {
      setGrantEmail("");
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Role granted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("platform_revoke_role", { p_user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
      toast.success("Role revoked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform team</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isSuper
            ? "Grant platform-level access. Super admins have full control; platform admins can run support sessions only."
            : "Only super admins can manage the platform team."}
        </p>
      </div>

      {isSuper && (
        <Card className="p-6">
          <form
            onSubmit={(e) => { e.preventDefault(); grant.mutate(); }}
            className="grid sm:grid-cols-[1fr,200px,auto] gap-3 items-end mb-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="grant-email">User email (must have signed up)</Label>
              <Input id="grant-email" type="email" required value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={grantRole} onValueChange={(v) => setGrantRole(v as PlatformRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform_admin">Platform admin</SelectItem>
                  <SelectItem value="super_admin">Super admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={grant.isPending}>Grant</Button>
          </form>

          {admins.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="divide-y">
              {(admins.data ?? []).map((a) => {
                const isMe = a.id === me.data?.id;
                const superCount = (admins.data ?? []).filter(x => x.role === "super_admin").length;
                const lastSuper = a.role === "super_admin" && superCount <= 1;
                return (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {a.full_name || a.email} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.role === "super_admin" ? "default" : "secondary"}>
                        {a.role === "super_admin" ? "Super admin" : "Platform admin"}
                      </Badge>
                      <Button size="sm" variant="ghost" disabled={lastSuper}
                        title={lastSuper ? "At least one super admin must remain" : undefined}
                        onClick={() => revoke.mutate(a.id)}>
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
    </section>
  );
}

export function PlatformBrandingSection() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Platform branding</h2>
        <p className="text-sm text-muted-foreground mt-1">Customize the LibrariOS marketing surfaces.</p>
      </div>
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </Card>
    </section>
  );
}
