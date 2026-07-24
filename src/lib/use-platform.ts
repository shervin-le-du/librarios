import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlatformRole = "owner" | "super_admin" | "admin";

export const platformRoleLabel = (r: PlatformRole): string =>
  r === "owner" ? "Owner" : r === "super_admin" ? "Super admin" : "Admin";
export type PlatformAdmin = { id: string; email: string; full_name: string | null; role: PlatformRole };

export function usePlatformAdmin() {
  return useQuery({
    queryKey: ["platform-admin"],
    queryFn: async (): Promise<PlatformAdmin | null> => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return null;
      const { data, error } = await supabase
        .from("platform_admins")
        .select("id, email, full_name, role")
        .eq("id", sess.session.user.id)
        .maybeSingle();
      if (error) return null;
      return (data as PlatformAdmin) ?? null;
    },
    staleTime: 60_000,
  });
}

export type ActiveSupportSession = {
  id: string;
  library_id: string;
  library_name: string;
  library_slug: string;
  started_at: string;
  reason: string | null;
};

export function useActiveSupportSession() {
  return useQuery({
    queryKey: ["active-support-session"],
    queryFn: async (): Promise<ActiveSupportSession | null> => {
      const { data, error } = await supabase.rpc("get_active_support_session");
      if (error) return null;
      return ((data ?? [])[0] as ActiveSupportSession) ?? null;
    },
    staleTime: 15_000,
  });
}
