import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HomePageConfig = {
  hero_heading?: string;
  hero_subheading?: string;
  hero_image_url?: string | null;
  about_text?: string;
  announcement?: string;
  announcement_visible?: boolean;
  hours?: string;
  published?: boolean;
};

export type Library = {
  id: string;
  name: string;
  subdomain: string | null;
  languages: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  logo_url: string | null;
  brand_color: string | null;
  status: "active" | "suspended" | null;
  patron_portal_enabled: boolean | null;
  home_page_config: HomePageConfig | null;
  branding: Record<string, any> | null;
};

export function useCurrentLibrary() {
  return useQuery({
    queryKey: ["current-library"],
    queryFn: async (): Promise<Library | null> => {
      const { data, error } = await supabase
        .from("libraries")
        .select("id, name, subdomain, languages, contact_email, contact_phone, contact_address, logo_url, brand_color, status, patron_portal_enabled, home_page_config, branding")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Library) ?? null;
    },
    staleTime: 30_000,
  });
}

export function useSignedLogo(path: string | null | undefined) {
  return useQuery({
    queryKey: ["logo-signed", path],
    enabled: !!path,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("library-logos")
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });
}

export function useSignedHeroImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ["hero-image-signed", path],
    enabled: !!path,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("library-home-images")
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });
}




// Convert hex to HSL components for tailwind/CSS var override
function hexToHsl(hex: string): string | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function useApplyBrandColor(color: string | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (!color) { root.style.removeProperty("--primary"); return; }
    const hsl = hexToHsl(color);
    if (hsl) root.style.setProperty("--primary", hsl);
    return () => { root.style.removeProperty("--primary"); };
  }, [color]);
}
