import { useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Shield, BookOpen, UserCog, Palette, Plug, Library as LibraryIcon, LifeBuoy, Paintbrush,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentStaff, roleCan } from "@/lib/use-current-staff";
import { usePlatformAdmin, useActiveSupportSession } from "@/lib/use-platform";
import { Button } from "@/components/ui/button";
import { SettingsShell, type ShellGroup } from "@/components/settings/SettingsShell";
import { ProfileSection, SecuritySection } from "@/components/settings/ProfileSection";
import { LibraryGeneralSection } from "@/components/settings/library/LibraryGeneralSection";
import { LibraryBrandingSection } from "@/components/settings/library/branding/LibraryBrandingSection";

import { LibraryTeamSection } from "@/components/settings/library/LibraryTeamSection";
import { PlatformLibraryPicker } from "@/components/settings/platform/PlatformLibraryPicker";
import { PlatformAdminSection } from "@/components/settings/platform/PlatformAdminSection";
import { PlatformIntegrationsSection } from "@/components/settings/platform/PlatformIntegrationsSection";
import { PlatformBrandingSection } from "@/components/settings/platform/PlatformSubsections";

export type SettingsMode = "all" | "user" | "admin";

export const SETTINGS_SECTIONS = [
  "profile", "security",
  "library-general", "library-branding", "library-team", "library-picker",
  "platform-admin", "platform-integrations", "platform-branding",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(v: unknown): v is SettingsSection {
  return typeof v === "string" && (SETTINGS_SECTIONS as readonly string[]).includes(v);
}

type UseSettingsGroupsArgs = {
  slug?: string;
  section: SettingsSection;
  onSectionChange: (id: SettingsSection) => void;
  mode?: SettingsMode;
};

export function useSettingsGroups({ slug, section, onSectionChange, mode = "all" }: UseSettingsGroupsArgs) {
  const staff = useCurrentStaff();
  const platform = usePlatformAdmin();
  const support = useActiveSupportSession();

  const isPlatformAdmin = !!platform.data;
  const supportSlug = support.data?.library_slug ?? null;
  const currentSlug = slug ?? (isPlatformAdmin ? supportSlug : null);
  const inSupport = !!supportSlug && !slug && isPlatformAdmin;

  const role = staff.data?.role;
  const isAdminMode = mode === "admin";
  const showUser = mode !== "admin";
  const showLibrary = mode !== "user" && !!currentSlug && !isAdminMode;
  const canManageSettings = inSupport ? true : roleCan(role, "manage_settings");
  const canManageStaff = inSupport ? true : roleCan(role, "manage_staff");
  const canManageEmails = inSupport ? true : roleCan(role, "manage_emails");
  const showLibraryPicker = mode !== "user" && isPlatformAdmin && !currentSlug && !isAdminMode;
  const showPlatform = mode !== "user" && isPlatformAdmin;

  const groups: ShellGroup[] = useMemo(() => {
    const g: ShellGroup[] = [];

    if (showUser) {
      g.push({
        id: "user", label: "User",
        items: [
          { id: "profile", label: "Profile", icon: User, active: section === "profile", onClick: () => onSectionChange("profile") },
          { id: "security", label: "Security", icon: Shield, active: section === "security", onClick: () => onSectionChange("security") },
        ],
      });
    }

    if (showLibrary) {
      const libLabel = inSupport && support.data ? `Library — ${support.data.library_name}` : "Library";
      const items = [
        { id: "library-general", label: "General", icon: BookOpen, active: section === "library-general", onClick: () => onSectionChange("library-general") },
      ];
      if (canManageSettings) {
        items.push({ id: "library-branding", label: "Branding", icon: Paintbrush, active: section === "library-branding", onClick: () => onSectionChange("library-branding") });
      }
      if (canManageStaff) {
        items.push({ id: "library-team", label: "Team", icon: UserCog, active: section === "library-team", onClick: () => onSectionChange("library-team") });
      }
      g.push({ id: "library", label: libLabel, items });
    } else if (showLibraryPicker) {
      g.push({
        id: "library", label: "Library",
        items: [
          { id: "library-picker", label: "Pick a library", icon: LibraryIcon, active: section === "library-picker", onClick: () => onSectionChange("library-picker") },
        ],
      });
    }

    if (showPlatform) {
      g.push({
        id: "platform", label: isAdminMode ? "" : "Platform",
        items: [
          { id: "platform-admin", label: "Platform Admin", icon: Shield, active: section === "platform-admin", onClick: () => onSectionChange("platform-admin") },
          { id: "platform-integrations", label: "Integrations", icon: Plug, active: section === "platform-integrations", onClick: () => onSectionChange("platform-integrations") },
          { id: "platform-branding", label: "Branding", icon: Palette, active: section === "platform-branding", onClick: () => onSectionChange("platform-branding") },
        ],
      });
    }

    return g;
  }, [section, isAdminMode, showUser, showLibrary, canManageSettings, canManageStaff, showLibraryPicker, showPlatform, inSupport, support.data, onSectionChange]);

  const visibleIds = useMemo(() => new Set(groups.flatMap((g) => g.items.map((i) => i.id))), [groups]);

  useEffect(() => {
    if (staff.isLoading || platform.isLoading || support.isLoading) return;
    if (visibleIds.has(section)) return;
    const fallback = (groups[0]?.items[0]?.id ?? "profile") as SettingsSection;
    onSectionChange(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, visibleIds, staff.isLoading, platform.isLoading, support.isLoading]);

  return {
    groups,
    currentSlug,
    inSupport,
    showLibrary,
    showLibraryTeam: canManageStaff,
    canManageSettings,
    canManageEmails,
    showLibraryPicker,
    showPlatform,
    role,
    loading: staff.isLoading || platform.isLoading || support.isLoading,
  };
}

export function SettingsSectionContent({
  slug,
  section,
  onSectionChange,
}: {
  slug?: string;
  section: SettingsSection;
  onSectionChange: (id: SettingsSection) => void;
}) {
  const qc = useQueryClient();
  const support = useActiveSupportSession();
  const platform = usePlatformAdmin();
  const staff = useCurrentStaff();

  const isPlatformAdmin = !!platform.data;
  const supportSlug = support.data?.library_slug ?? null;
  const currentSlug = slug ?? (isPlatformAdmin ? supportSlug : null);
  const inSupport = !!supportSlug && !slug && isPlatformAdmin;
  const role = staff.data?.role;
  const showLibrary = !!currentSlug;
  const showLibraryTeam = inSupport ? true : roleCan(role, "manage_staff");
  const showLibraryPicker = isPlatformAdmin && !currentSlug;
  const showPlatform = isPlatformAdmin;

  const endSupport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("end_support_session");
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["active-support-session"] });
      await qc.invalidateQueries({ queryKey: ["current-library"] });
      toast.success("Support session ended");
      onSectionChange("library-picker");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeLibrarySlug = currentSlug ?? "";
  const isLibrarySection =
    section === "library-general" || section === "library-branding" || section === "library-team";

  return (
    <div className="min-w-0">
      {inSupport && isLibrarySection && support.data && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/15 px-4 py-3 text-sm text-warning-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <LifeBuoy className="size-4 shrink-0" />
            <span className="truncate">
              Acting as admin of <strong>{support.data.library_name}</strong> via support session.
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => endSupport.mutate()} disabled={endSupport.isPending}>
            {endSupport.isPending ? "Ending…" : "End session"}
          </Button>
        </div>
      )}

      {section === "profile" && <ProfileSection />}
      {section === "security" && <SecuritySection />}

      {section === "library-general" && showLibrary && (
        <LibraryGeneralSection slug={activeLibrarySlug} role={inSupport ? "admin" : (role ?? "admin")} />
      )}
      {section === "library-branding" && showLibrary && <LibraryBrandingSection />}
      {section === "library-team" && showLibrary && showLibraryTeam && <LibraryTeamSection />}
      {section === "library-picker" && showLibraryPicker && (
        <PlatformLibraryPicker onSessionStarted={() => onSectionChange("library-general")} />
      )}

      {section === "platform-admin" && showPlatform && <PlatformAdminSection />}
      {section === "platform-integrations" && showPlatform && <PlatformIntegrationsSection />}
      {section === "platform-branding" && showPlatform && <PlatformBrandingSection />}
    </div>
  );
}

// Legacy wrapper preserved for backwards compatibility (not used by routes anymore).
export function UnifiedSettings({
  slug,
  section,
  onSectionChange,
  title = "Settings",
}: {
  slug?: string;
  section: SettingsSection;
  onSectionChange: (id: SettingsSection) => void;
  title?: string;
}) {
  const { groups } = useSettingsGroups({ slug, section, onSectionChange });
  return (
    <SettingsShell title={title} subtitle="Your profile and the things you can configure." groups={groups}>
      <SettingsSectionContent slug={slug} section={section} onSectionChange={onSectionChange} />
    </SettingsShell>
  );
}
