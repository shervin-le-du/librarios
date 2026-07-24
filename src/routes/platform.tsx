import { createFileRoute, redirect, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, LifeBuoy, Wrench } from "lucide-react";
import { useActiveSupportSession, usePlatformAdmin } from "@/lib/use-platform";
import { UserBubble } from "@/components/UserBubble";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/auth" });
    const { data, error } = await supabase
      .from("platform_admins").select("id").eq("id", sess.session.user.id).maybeSingle();
    if (error || !data) throw redirect({ to: "/" });
  },
  component: PlatformLayout,
});

function PlatformLayout() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = usePlatformAdmin();
  const role = me.data?.role;
  const session = useActiveSupportSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inAdmin = pathname.startsWith("/platform/admin") || pathname.startsWith("/platform/settings");

  const endSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("end_support_session");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-support-session"] });
      toast.success("Support session ended");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {!inAdmin && (
        <header className="border-b">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/platform" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Shield className="size-5 text-primary" />
              <h1 className="font-semibold">LibrariOS — Platform</h1>
              {me.data && role && (
                <Badge variant={role === "owner" ? "default" : role === "super_admin" ? "secondary" : "outline"} className="ml-2">
                  {role === "owner" ? "Owner" : role === "super_admin" ? "Super admin" : "Admin"}
                </Badge>
              )}
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" title="Admin">
                <Link to="/platform/admin">
                  <Wrench className="size-4" /> Admin
                </Link>
              </Button>
              <div className="min-w-[180px]">
                <UserBubble
                  onSignOut={async () => {
                    await supabase.auth.signOut();
                    router.navigate({ to: "/auth", replace: true });
                  }}
                  align="end"
                />
              </div>
            </div>
          </div>
        </header>
      )}

      {session.data && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <Card className="p-4 bg-amber-50 border-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <LifeBuoy className="size-4 text-amber-700" />
              <span>Active support session in <strong>{session.data.library_name}</strong> since {new Date(session.data.started_at).toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/$slug/app/dashboard" params={{ slug: session.data.library_slug }}>Open tenant</Link>
              </Button>
              <Button size="sm" variant="destructive" onClick={() => endSession.mutate()}>
                End session
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Outlet />
    </div>
  );
}
