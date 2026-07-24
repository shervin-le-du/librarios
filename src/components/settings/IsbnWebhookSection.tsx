import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { testIsbnWebhook } from "@/lib/isbn-scan.functions";
import { usePlatformAdmin } from "@/lib/use-platform";

type Config = { url: string | null; has_auth: boolean; updated_at: string | null };

export function IsbnWebhookSection() {
  const me = usePlatformAdmin();
  const isSuper = me.data?.role === "super_admin" || me.data?.role === "owner";
  const qc = useQueryClient();
  const test = useServerFn(testIsbnWebhook);

  const cfg = useQuery({
    queryKey: ["isbn-webhook-config"],
    queryFn: async (): Promise<Config> => {
      const { data, error } = await supabase.rpc("get_isbn_webhook_config");
      if (error) throw error;
      const row = (data ?? [])[0] as any;
      return { url: row?.url ?? null, has_auth: !!row?.has_auth, updated_at: row?.updated_at ?? null };
    },
  });

  const [url, setUrl] = useState("");
  const [auth, setAuth] = useState("");
  const [touchedAuth, setTouchedAuth] = useState(false);
  const [testResult, setTestResult] = useState<{ status: number; body: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (cfg.data) {
      setUrl(cfg.data.url ?? "");
      setAuth("");
      setTouchedAuth(false);
    }
  }, [cfg.data?.url, cfg.data?.has_auth]);

  const save = useMutation({
    mutationFn: async () => {
      const auth_header = touchedAuth ? (auth || null) : (cfg.data?.has_auth ? undefined : null);
      const { error } = await supabase.rpc("set_isbn_webhook_config", {
        p_url: url,
        p_auth_header: auth_header === undefined ? null : auth_header,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook saved");
      qc.invalidateQueries({ queryKey: ["isbn-webhook-config"] });
      qc.invalidateQueries({ queryKey: ["isbn-webhook-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("clear_isbn_webhook_config");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Webhook cleared");
      setUrl(""); setAuth(""); setTouchedAuth(false); setTestResult(null);
      qc.invalidateQueries({ queryKey: ["isbn-webhook-config"] });
      qc.invalidateQueries({ queryKey: ["isbn-webhook-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function runTest() {
    setTestResult(null);
    setTesting(true);
    try {
      const r = await test({ data: { url, auth_header: touchedAuth ? (auth || null) : null } });
      setTestResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div id="platform-isbn-webhook" className="scroll-mt-20">
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-1">ISBN scanner webhook</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Librarians can snap a photo of a book cover to auto-fill ISBN and metadata. Lovable POSTs the image
          (base64) to this endpoint and expects JSON back. Only super admins can change this.
        </p>

        <pre className="text-xs bg-muted rounded-md p-3 mb-5 overflow-auto">{`POST <your webhook>
Headers: Content-Type: application/json
         Authorization: <your auth header, if set>
Body:    { "image_base64": "...", "mime_type": "image/jpeg" }

Response 200: { "isbn": "9780143127741",
                "title": "Sapiens",          // optional
                "author": "Y. N. Harari",    // optional
                "language": "en" }           // optional`}</pre>

        {!isSuper ? (
          <p className="text-sm text-muted-foreground">
            {cfg.data?.url
              ? <>Currently configured: <code className="text-xs">{cfg.data.url}</code></>
              : "Not configured yet. Ask a super admin to set this up."}
          </p>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="webhook-url">Webhook URL (https only)</Label>
              <Input
                id="webhook-url" type="url" placeholder="https://example.com/isbn-scan"
                value={url} onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webhook-auth">
                Authorization header {cfg.data?.has_auth && !touchedAuth && (
                  <span className="text-xs text-muted-foreground">(currently set — leave blank to keep, type to replace)</span>
                )}
              </Label>
              <Input
                id="webhook-auth" type="text"
                placeholder={cfg.data?.has_auth ? "•••••••• (unchanged)" : "Bearer sk-..."}
                value={auth}
                onChange={(e) => { setAuth(e.target.value); setTouchedAuth(true); }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending}>Save</Button>
              <Button type="button" variant="outline" disabled={!url || testing} onClick={runTest}>
                {testing ? "Testing…" : "Send test image"}
              </Button>
              {cfg.data?.url && (
                <Button type="button" variant="ghost" className="ml-auto text-destructive"
                  onClick={() => { if (confirm("Clear webhook configuration?")) clear.mutate(); }}>
                  Clear
                </Button>
              )}
            </div>

            {testResult && (
              <div className="mt-2 text-xs">
                <div className="font-medium mb-1">HTTP {testResult.status || "error"}</div>
                <pre className="bg-muted rounded-md p-2 overflow-auto max-h-48">{testResult.body || "(empty)"}</pre>
              </div>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
