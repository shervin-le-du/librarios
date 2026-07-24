import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TenantLibrary = {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  brand_color: string | null;
  branding: Record<string, any> | null;
};

export async function fetchLibraryBySlug(slug: string): Promise<TenantLibrary | null> {
  const { data, error } = await supabase.rpc("get_library_by_slug", { p_slug: slug });
  if (error) throw error;
  return ((data ?? [])[0] as TenantLibrary | undefined) ?? null;
}

export function useTenantLibraryBySlug(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["tenant-library", slug],
    enabled: !!slug,
    queryFn: () => fetchLibraryBySlug(slug!),
    staleTime: 60_000,
  });
}
