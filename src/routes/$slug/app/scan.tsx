import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/lib/use-current-staff";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Loader2, CheckCircle2, XCircle, ArrowLeft, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/$slug/app/scan")({
  head: () => ({ meta: [{ title: "Scan a book — LibrariOS" }] }),
  component: ScanPage,
});

type Phase =
  | { kind: "capture" }
  | { kind: "preview"; file: File; previewUrl: string }
  | { kind: "uploading"; step: "compressing" | "storage" | "queue" }
  | { kind: "upload-error"; message: string; file: File; previewUrl: string }
  | { kind: "queue-error"; message: string; storagePath: string; libraryId: string }
  | { kind: "status"; jobId: string };

const MAX_UNCOMPRESSED_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_DIM = 1600;
const JPEG_QUALITY = 0.8;

async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_UNCOMPRESSED_BYTES && file.type === "image/jpeg") return file;
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
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", JPEG_QUALITY),
  );
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

function ScanPage() {
  const { slug } = Route.useParams();
  const me = useCurrentStaff();
  const [phase, setPhase] = useState<Phase>({ kind: "capture" });
  const inputRef = useRef<HTMLInputElement>(null);

  const libraryId = me.data?.library_id ?? null;

  useEffect(() => {
    return () => {
      if (phase.kind === "preview" || phase.kind === "upload-error") URL.revokeObjectURL(phase.previewUrl);
    };
  }, [phase]);

  function onPickFile(f: File) {
    setPhase({ kind: "preview", file: f, previewUrl: URL.createObjectURL(f) });
  }

  async function doUpload(file: File) {
    if (!libraryId) {
      toast.error("No active library");
      return;
    }
    let compressed: File;
    setPhase({ kind: "uploading", step: "compressing" });
    try {
      compressed = await compressImage(file);
    } catch (e: any) {
      setPhase({ kind: "upload-error", message: e?.message ?? "Could not process image", file, previewUrl: URL.createObjectURL(file) });
      return;
    }
    const scanId = crypto.randomUUID();
    const storagePath = `${libraryId}/${scanId}.jpg`;

    setPhase({ kind: "uploading", step: "storage" });
    const up = await supabase.storage.from("scan-staging").upload(storagePath, compressed, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (up.error) {
      setPhase({ kind: "upload-error", message: up.error.message, file, previewUrl: URL.createObjectURL(file) });
      return;
    }

    setPhase({ kind: "uploading", step: "queue" });
    const ins = await supabase
      .from("book_scan_jobs")
      .insert({
        library_id: libraryId,
        storage_path: storagePath,
        created_by: (await supabase.auth.getUser()).data.user!.id,
        status: "pending",
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setPhase({ kind: "queue-error", message: ins.error?.message ?? "Could not queue job", storagePath, libraryId });
      return;
    }
    setPhase({ kind: "status", jobId: ins.data.id });
  }

  async function retryQueue(libraryIdArg: string, storagePath: string) {
    setPhase({ kind: "uploading", step: "queue" });
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      setPhase({ kind: "queue-error", message: "Signed out", storagePath, libraryId: libraryIdArg });
      return;
    }
    const ins = await supabase
      .from("book_scan_jobs")
      .insert({ library_id: libraryIdArg, storage_path: storagePath, created_by: userId, status: "pending" })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setPhase({ kind: "queue-error", message: ins.error?.message ?? "Could not queue job", storagePath, libraryId: libraryIdArg });
      return;
    }
    setPhase({ kind: "status", jobId: ins.data.id });
  }

  const heading = useMemo(() => {
    switch (phase.kind) {
      case "status": return "Scan status";
      default: return "Scan a book";
    }
  }, [phase.kind]);

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/$slug/app/books"
          params={{ slug }}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-4" /> Books
        </Link>
      </div>
      <h1 className="text-3xl font-semibold mb-2">{heading}</h1>
      <p className="text-muted-foreground mb-6">
        Snap or upload a photo of the cover. We'll queue it for automatic data extraction.
      </p>

      {phase.kind === "capture" && (
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto size-16 rounded-full bg-muted flex items-center justify-center">
            <Camera className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <div className="font-medium">Take a photo of the book cover</div>
            <p className="text-sm text-muted-foreground">Use your camera or pick an existing image.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex justify-center gap-2">
            <Button onClick={() => inputRef.current?.click()} className="gap-2">
              <Camera className="size-4" /> Open camera / pick photo
            </Button>
          </div>
        </Card>
      )}

      {(phase.kind === "preview" || phase.kind === "upload-error") && (
        <Card className="p-6 space-y-4">
          <img src={phase.previewUrl} alt="Cover preview" className="w-full max-h-[420px] object-contain rounded-md bg-muted" />
          {phase.kind === "upload-error" && (
            <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              Upload failed: {phase.message}
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" className="gap-2" onClick={() => setPhase({ kind: "capture" })}>
              <RefreshCw className="size-4" /> Retake
            </Button>
            <Button className="gap-2" onClick={() => doUpload(phase.file)}>
              <Upload className="size-4" /> {phase.kind === "upload-error" ? "Retry upload" : "Upload"}
            </Button>
          </div>
        </Card>
      )}

      {phase.kind === "uploading" && (
        <Card className="p-8 text-center space-y-3">
          <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
          <div className="font-medium">
            {phase.step === "compressing" && "Preparing photo…"}
            {phase.step === "storage" && "Uploading photo…"}
            {phase.step === "queue" && "Queuing job…"}
          </div>
        </Card>
      )}

      {phase.kind === "queue-error" && (
        <Card className="p-6 space-y-4">
          <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
            Photo uploaded, but queuing the job failed: {phase.message}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => setPhase({ kind: "capture" })}>New scan</Button>
            <Button className="gap-2" onClick={() => retryQueue(phase.libraryId, phase.storagePath)}>
              <RefreshCw className="size-4" /> Retry queuing
            </Button>
          </div>
        </Card>
      )}

      {phase.kind === "status" && (
        <ScanStatus jobId={phase.jobId} onNew={() => setPhase({ kind: "capture" })} />
      )}
    </div>
  );
}

type ScanJob = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  extracted_data: unknown | null;
  error_message: string | null;
};

function ScanStatus({ jobId, onNew }: { jobId: string; onNew: () => void }) {
  const qc = useQueryClient();

  const job = useQuery({
    queryKey: ["book-scan-job", jobId],
    queryFn: async (): Promise<ScanJob> => {
      const { data, error } = await supabase
        .from("book_scan_jobs")
        .select("id, status, extracted_data, error_message")
        .eq("id", jobId)
        .single();
      if (error) throw error;
      return data as ScanJob;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`book_scan_jobs:${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "book_scan_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          qc.setQueryData(["book-scan-job", jobId], payload.new as ScanJob);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, qc]);

  const status = job.data?.status ?? "pending";

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        {(status === "pending" || status === "processing") && (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        )}
        {status === "completed" && <CheckCircle2 className="size-6 text-green-600" />}
        {status === "failed" && <XCircle className="size-6 text-destructive" />}
        <div>
          <div className="font-medium capitalize">{status}</div>
          <div className="text-xs text-muted-foreground font-mono">Job {jobId.slice(0, 8)}</div>
        </div>
      </div>

      {status === "failed" && job.data?.error_message && (
        <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
          {job.data.error_message}
        </div>
      )}

      {status === "completed" && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Extracted data</div>
          <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-[360px]">
            {JSON.stringify(job.data?.extracted_data ?? null, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onNew}>Cancel / New scan</Button>
      </div>
    </Card>
  );
}
