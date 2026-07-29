import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  getBookScanWebhookConfig,
  testBookScanWebhook,
  type BookScanWebhookConfig,
} from "@/lib/isbn-scan.functions";
import type { Database } from "@/integrations/supabase/types";
import { usePlatformAdmin } from "@/lib/use-platform";

const WEBHOOK_KEY = "book_scan_processing";

function isForwardingActive(cfg: BookScanWebhookConfig | null | undefined) {
  return !!(cfg?.url?.trim() && cfg.is_active);
}

export function IsbnWebhookSection() {
  const me = usePlatformAdmin();
  const isAdmin = !!me.data;
  const qc = useQueryClient();
  const loadConfig = useServerFn(getBookScanWebhookConfig);
  const test = useServerFn(testBookScanWebhook);

  const cfg = useQuery({
    queryKey: ["book-scan-webhook-config"],
    queryFn: () => loadConfig(),
    retry: false,
  });

  const [url, setUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [auth, setAuth] = useState("");
  const [touchedAuth, setTouchedAuth] = useState(false);
  const [clearAuth, setClearAuth] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; body: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (cfg.data) {
      setUrl(cfg.data.url ?? "");
      setIsActive(cfg.data.is_active);
      setAuth("");
      setTouchedAuth(false);
      setClearAuth(false);
    }
  }, [cfg.data?.id, cfg.data?.url, cfg.data?.is_active, cfg.data?.has_auth]);

  const savedUrl = cfg.data?.url?.trim() ?? "";
  const isDirty =
    url.trim() !== savedUrl ||
    isActive !== (cfg.data?.is_active ?? false) ||
    touchedAuth ||
    clearAuth;

  const hasStoredAuth = !!(cfg.data?.has_auth && !clearAuth);

  const save = useMutation({
    mutationFn: async () => {
      const trimmedUrl = url.trim();
      if (trimmedUrl && !trimmedUrl.startsWith("https://")) {
        throw new Error("Webhook URL must use https://");
      }

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const now = new Date().toISOString();
      const base = {
        url: trimmedUrl || null,
        is_active: isActive,
        updated_by: userId,
        updated_at: now,
      };

      if (cfg.data?.id) {
        const update: Database["public"]["Tables"]["webhook_configs"]["Update"] = { ...base };
        if (clearAuth) update.auth_header = null;
        else if (touchedAuth) update.auth_header = auth.trim() || null;
        const { error } = await supabase
          .from("webhook_configs")
          .update(update)
          .eq("id", cfg.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("webhook_configs").insert({
          key: WEBHOOK_KEY,
          ...base,
          auth_header: clearAuth ? null : touchedAuth ? (auth.trim() || null) : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Webhook saved");
      qc.invalidateQueries({ queryKey: ["book-scan-webhook-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function runTest() {
    if (isDirty) {
      toast.error("Save your changes before sending a test payload.");
      return;
    }
    if (!savedUrl) {
      toast.error("Save a webhook URL first.");
      return;
    }

    setTestResult(null);
    setTesting(true);
    try {
      const r = await test();
      setTestResult(r);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const loadError = cfg.isError
    ? (cfg.error instanceof Error ? cfg.error.message : "Could not load webhook settings")
    : null;

  return (
    <div id="platform-isbn-webhook" className="scroll-mt-20">
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-1">Book scan webhook</h3>
        <p className="text-sm text-muted-foreground mb-4">
          When a librarian scans a book by barcode or cover photo, a row is inserted into{" "}
          <code className="text-xs bg-muted px-1 rounded">book_scan_jobs</code> and forwarded to
          this URL as a JSON POST containing the full job record. Processing is asynchronous — your
          endpoint does not need to return metadata to the app.
        </p>

        <pre className="text-xs bg-muted rounded-md p-3 mb-5 overflow-auto">{`POST <your webhook>
Headers: Content-Type: application/json
         Authorization: <your auth header, if set>
Body:    { "type": "INSERT", "table": "book_scan_jobs", "schema": "public",
           "record": { "id": "...", "library_id": "...", "scan_method": "barcode|photo",
                       "isbn": "...", "storage_path": "...", "status": "pending", ... },
           "old_record": null }`}</pre>

        {cfg.isLoading || me.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-muted-foreground">
            Could not load webhook settings. {loadError}
          </p>
        ) : !isAdmin ? (
          <p className="text-sm text-muted-foreground">
            {isForwardingActive(cfg.data)
              ? "Book scan forwarding is active."
              : cfg.data?.url
                ? "A webhook URL is saved but forwarding is off."
                : "Not configured yet. Ask a platform admin to set this up."}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Webhook URL (https only)</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/book-scan"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="webhook-auth">Authorization header</Label>
                {(hasStoredAuth || auth) && !clearAuth && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => {
                      setClearAuth(true);
                      setAuth("");
                      setTouchedAuth(false);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <Input
                id="webhook-auth"
                type="text"
                autoComplete="off"
                placeholder={
                  hasStoredAuth ? "•••• (configured)" : "Bearer sk-..."
                }
                value={auth}
                onChange={(e) => {
                  setAuth(e.target.value);
                  setTouchedAuth(true);
                  setClearAuth(false);
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <Label htmlFor="webhook-active" className="text-sm font-medium">
                  Forward scans to this webhook
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isActive && url.trim()
                    ? "New scans will be forwarded to the saved URL."
                    : "Off — scans are queued but not forwarded until enabled and a URL is saved."}
                </p>
              </div>
              <Switch
                id="webhook-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {!isForwardingActive(cfg.data) && savedUrl && (
              <p className="text-sm text-muted-foreground">
                Forwarding is currently off — real scans will not reach this URL until you enable
                the toggle and save. The test button below still posts directly to the saved URL.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!savedUrl || testing || isDirty}
                onClick={runTest}
              >
                {testing ? "Sending…" : "Send test payload"}
              </Button>
            </div>

            {isDirty && savedUrl && (
              <p className="text-xs text-muted-foreground">
                Save before testing — the test uses the URL already stored in the database.
              </p>
            )}

            {testResult && (
              <div className="mt-2 text-xs">
                <div className="font-medium mb-1">HTTP {testResult.status || "error"}</div>
                <pre className="bg-muted rounded-md p-2 overflow-auto max-h-48">
                  {testResult.body || "(empty)"}
                </pre>
              </div>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
