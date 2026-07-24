import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScanInput = z.object({
  image_base64: z.string().min(100).max(8_000_000),
  mime_type: z.string().regex(/^image\/(jpeg|png|webp)$/),
});

const WebhookResponse = z.object({
  isbn: z.string().trim().min(8).max(20).optional().nullable(),
  title: z.string().trim().max(500).optional().nullable(),
  author: z.string().trim().max(500).optional().nullable(),
  language: z.string().trim().max(50).optional().nullable(),
}).passthrough();

type ScanResult =
  | { ok: true; isbn: string | null; title?: string | null; author?: string | null; language?: string | null }
  | { ok: false; code: "not_configured" | "webhook_error" | "bad_response"; message: string };

async function loadWebhook() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("isbn_webhook_url, isbn_webhook_auth_header")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function callWebhook(image_base64: string, mime_type: string): Promise<ScanResult> {
  const cfg = await loadWebhook();
  if (!cfg?.isbn_webhook_url) {
    return { ok: false, code: "not_configured", message: "ISBN scanning isn't set up yet." };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.isbn_webhook_auth_header) headers["Authorization"] = cfg.isbn_webhook_auth_header;
    const res = await fetch(cfg.isbn_webhook_url, {
      method: "POST",
      headers,
      body: JSON.stringify({ image_base64, mime_type }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, code: "webhook_error", message: `Webhook returned ${res.status}` };
    }
    const json = await res.json().catch(() => null);
    const parsed = WebhookResponse.safeParse(json);
    if (!parsed.success) {
      return { ok: false, code: "bad_response", message: "Webhook returned unexpected data" };
    }
    return {
      ok: true,
      isbn: parsed.data.isbn ?? null,
      title: parsed.data.title ?? null,
      author: parsed.data.author ?? null,
      language: parsed.data.language ?? null,
    };
  } catch (e: any) {
    return {
      ok: false,
      code: "webhook_error",
      message: e?.name === "AbortError" ? "Webhook timed out" : (e?.message ?? "Webhook call failed"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const scanIsbnFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScanInput.parse(data))
  .handler(async ({ data, context }): Promise<ScanResult> => {
    // Any signed-in staff member can scan; library scoping isn't required since
    // the call only relays an image to the platform-configured webhook.
    void context.userId;
    return callWebhook(data.image_base64, data.mime_type);
  });

export const getIsbnWebhookStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ configured: boolean }> => {
    const cfg = await loadWebhook();
    return { configured: !!cfg?.isbn_webhook_url };
  });

const TestInput = z.object({
  url: z.string().url().regex(/^https:\/\//, "URL must use https://"),
  auth_header: z.string().max(2000).optional().nullable(),
});

// 1x1 transparent PNG, used so super admins can sanity-check a webhook
// returns 200 + a valid shape without uploading a real cover.
const TEST_IMAGE_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const testIsbnWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: isSuper, error } = await supabase.rpc("is_platform_super_admin");
    if (error) throw new Error(error.message);
    if (!isSuper) throw new Error("Not authorized");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (data.auth_header) headers["Authorization"] = data.auth_header;
      const res = await fetch(data.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ image_base64: TEST_IMAGE_B64, mime_type: "image/png" }),
        signal: controller.signal,
      });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 4000) };
    } catch (e: any) {
      return {
        status: 0,
        body: e?.name === "AbortError" ? "Request timed out" : (e?.message ?? "Request failed"),
      };
    } finally {
      clearTimeout(timeout);
    }
  });
