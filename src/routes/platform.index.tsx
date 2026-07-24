import { createFileRoute } from "@tanstack/react-router";
import { PlatformOverview } from "@/components/platform/PlatformOverview";

export const Route = createFileRoute("/platform/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Platform — LibrariOS" }] }),
  component: PlatformHome,
});

function PlatformHome() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <PlatformOverview />
    </main>
  );
}
