import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { UserBubble } from "@/components/UserBubble";
import {
  SettingsSectionContent,
  SETTINGS_SECTIONS,
  useSettingsGroups,
  type SettingsSection,
} from "@/components/settings/UnifiedSettings";

export const Route = createFileRoute("/platform/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — LibrariOS" }] }),
  validateSearch: z.object({
    section: z.enum(SETTINGS_SECTIONS).catch("platform-admin").default("platform-admin"),
  }),
  component: PlatformAdminPage,
});

function PlatformAdminPage() {
  const { section } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const onSectionChange = (id: SettingsSection) =>
    navigate({ to: "/platform/admin", search: { section: id }, replace: true });
  const { groups } = useSettingsGroups({ section, onSectionChange, mode: "admin" });

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link
          to="/platform"
          className="px-5 py-6 flex items-center gap-2.5 border-b border-sidebar-border hover:bg-sidebar-accent/40 transition-colors"
        >
          <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Shield className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-none truncate">Platform</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono truncate">LibrariOS</div>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <Link
            to="/platform"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Platform
          </Link>
          {groups.map((group) => (
            <div key={group.id} className="space-y-1">
              {group.label && (
                <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
              )}
              {group.items.length > 0 && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onClick}
                        className={
                          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left transition-colors " +
                          (item.active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "hover:bg-sidebar-accent text-sidebar-foreground")
                        }
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t p-2">
          <UserBubble
            onSignOut={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/auth", replace: true });
            }}
            settingsHref="/platform/settings"
          />
        </div>
      </aside>

      <nav className="md:hidden flex border-b bg-sidebar overflow-x-auto">
        <Link
          to="/platform"
          className="px-4 py-2.5 text-sm whitespace-nowrap text-muted-foreground flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" /> Platform
        </Link>
        {groups.flatMap((g) => g.items).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={
              "px-4 py-2.5 text-sm whitespace-nowrap " +
              (item.active ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground")
            }
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 min-w-0 p-6 md:p-10">
        <div className="max-w-4xl">
          <SettingsSectionContent section={section} onSectionChange={onSectionChange} />
        </div>
      </main>
    </div>
  );
}
