import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  SettingsSectionContent,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/components/settings/UnifiedSettings";

export const Route = createFileRoute("/$slug/app/settings")({
  head: () => ({ meta: [{ title: "Settings — LibrariOS" }] }),
  validateSearch: z.object({
    section: z.enum(SETTINGS_SECTIONS).catch("profile").default("profile"),
  }),
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
