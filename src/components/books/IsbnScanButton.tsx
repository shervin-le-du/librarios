import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { scanIsbnFromPhoto, getIsbnWebhookStatus } from "@/lib/isbn-scan.functions";

export type ScanPrefill = {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
  language?: string | null;
};

const MAX_DIM = 1600;

async function downscaleToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL("image/jpeg", 0.85);
  const base64 = out.split(",")[1] ?? "";
  return { base64, mime: "image/jpeg" };
}

export function IsbnScanButton({ onResult }: { onResult: (data: ScanPrefill) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const scan = useServerFn(scanIsbnFromPhoto);
  const getStatus = useServerFn(getIsbnWebhookStatus);

  const status = useQuery({
    queryKey: ["isbn-webhook-status"],
    queryFn: () => getStatus(),
    staleTime: 60_000,
  });

  const configured = status.data?.configured ?? false;

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const { base64, mime } = await downscaleToBase64(file);
      const result = await scan({ data: { image_base64: base64, mime_type: mime } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (!result.isbn && !result.title) {
        toast.warning("Couldn't read the cover — try another photo or fill the fields manually.");
        return;
      }
      onResult(result);
      toast.success(result.isbn ? `ISBN ${result.isbn} detected` : "Cover read");
    } catch (e: any) {
      toast.error(e?.message ?? "Scan failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={busy || !configured || status.isLoading}
        title={configured ? "Snap or upload a photo of the cover" : "ISBN scanning isn't set up. Ask your platform admin."}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {busy ? "Reading cover…" : configured ? "Scan cover" : "Scan cover (not set up)"}
      </Button>
    </div>
  );
}
