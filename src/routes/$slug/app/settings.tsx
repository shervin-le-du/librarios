import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  SettingsSectionContent,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/components/settings/UnifiedSettings";

export const Route = createFileRoute("/$slug/app/settings")({
  head: () => ({ meta: [{ title: "Settings — LibrariOS" }] }),
  validateSearch: (search: Record<string, unknown>): { section: SettingsSection } => {
    const s = search.section;
    return {
      section: (typeof s === "string" && (SETTINGS_SECTIONS as readonly string[]).includes(s)
        ? s : "profile") as SettingsSection,
    };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { slug } = Route.useParams();
  const { section } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <div className="p-6 md:p-10 max-w-4xl">
      <SettingsSectionContent
        slug={slug}
        section={section}
        onSectionChange={(id) =>
          navigate({ to: "/$slug/app/settings", params: { slug }, search: { section: id }, replace: true })
        }
      />
    </div>
  );
}
