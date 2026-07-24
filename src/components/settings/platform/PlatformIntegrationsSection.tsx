import { IsbnWebhookSection } from "@/components/settings/IsbnWebhookSection";

export function PlatformIntegrationsSection() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external services that power platform features.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">ISBN Scanner</h3>
        <IsbnWebhookSection />
      </div>
    </section>
  );
}
