import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, ImageIcon, Loader2, ScanLine } from "lucide-react";
import { isValidIsbn13 } from "@/lib/isbn";

/** How long we scan before nudging the user toward the photo fallback. */
const NO_BARCODE_HINT_MS = 8000;

type ReaderStatus = "starting" | "scanning" | "denied" | "error";

type BrowserReader = {
  decodeFromVideoDevice: (
    deviceId: string | null,
    video: HTMLVideoElement,
    callback: (result?: { getText: () => string } | null, error?: unknown) => void,
  ) => Promise<unknown>;
  reset: () => void;
};

export function BarcodeScanner({
  onDetected,
  onFallback,
}: {
  onDetected: (isbn: string) => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserReader | null>(null);
  const settledRef = useRef(false);
  // Held in refs so an unmemoized parent callback can't restart the camera.
  const onDetectedRef = useRef(onDetected);
  const onFallbackRef = useRef(onFallback);
  onDetectedRef.current = onDetected;
  onFallbackRef.current = onFallback;
  const [status, setStatus] = useState<ReaderStatus>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showNoBarcodeHint, setShowNoBarcodeHint] = useState(false);

  const stopCamera = useCallback(() => {
    readerRef.current?.reset();
    readerRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    // reset() releases the stream, but a track can survive if decoding never
    // started — drop them by hand so no camera indicator is left lit.
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { BarcodeFormat, BrowserMultiFormatReader, DecodeHintType } =
          await import("@zxing/library");
        const video = videoRef.current;
        if (cancelled || !video) return;

        // ISBN barcodes are EAN-13; limiting the format set keeps decoding fast
        // and avoids false positives from other symbologies.
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
        // Second arg is the delay between scan attempts; the default 500ms
        // makes scanning feel sluggish.
        const reader = new BrowserMultiFormatReader(hints, 150) as unknown as BrowserReader;
        readerRef.current = reader;

        // A null deviceId lets ZXing request the rear-facing camera, which is
        // the only way to get `facingMode: environment` on iOS Safari.
        await reader.decodeFromVideoDevice(null, video, (result) => {
          if (!result || settledRef.current) return;
          const text = result.getText();
          // Misreads are common; ignore anything that isn't a real ISBN-13 and
          // keep scanning rather than surfacing per-frame errors.
          if (!isValidIsbn13(text)) return;
          settledRef.current = true;
          stopCamera();
          onDetectedRef.current(text.replace(/[^0-9]/g, ""));
        });

        if (cancelled) {
          stopCamera();
          return;
        }
        setStatus("scanning");
      } catch (e) {
        if (cancelled) return;
        stopCamera();
        const name = (e as { name?: string } | undefined)?.name;
        if (
          name === "NotAllowedError" ||
          name === "PermissionDeniedError" ||
          name === "SecurityError"
        ) {
          setStatus("denied");
        } else {
          setStatus("error");
          setErrorMessage(
            (e as { message?: string } | undefined)?.message ?? "Could not start the camera",
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (status !== "scanning") return;
    const t = setTimeout(() => setShowNoBarcodeHint(true), NO_BARCODE_HINT_MS);
    return () => clearTimeout(t);
  }, [status]);

  function switchToPhoto() {
    settledRef.current = true;
    stopCamera();
    onFallbackRef.current();
  }

  if (status === "denied" || status === "error") {
    return (
      <Card className="p-6 space-y-4 text-center">
        <div className="mx-auto size-16 rounded-full bg-muted flex items-center justify-center">
          <Camera className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="font-medium">
            {status === "denied" ? "Camera access blocked" : "Camera unavailable"}
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "denied"
              ? "Allow camera access in your browser settings to scan barcodes, or photograph the cover instead."
              : (errorMessage ?? "Could not start the camera.")}
          </p>
        </div>
        <Button className="gap-2" onClick={switchToPhoto}>
          <ImageIcon className="size-4" /> Photograph the cover instead
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="relative overflow-hidden rounded-md bg-black aspect-[4/3]">
        <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-4/5 h-1/3 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Starting camera…
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <ScanLine className="size-4" /> Point the camera at the barcode on the back cover
      </div>

      {showNoBarcodeHint && (
        <div className="rounded-md bg-muted px-3 py-3 space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Still looking for a barcode. Try more light or a different angle — or use the cover
            photo instead.
          </p>
          <Button variant="secondary" size="sm" className="gap-2" onClick={switchToPhoto}>
            <ImageIcon className="size-4" /> No barcode? Photograph the cover instead
          </Button>
        </div>
      )}

      {!showNoBarcodeHint && (
        <div className="text-center">
          <button
            type="button"
            onClick={switchToPhoto}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            No barcode? Photograph the cover instead
          </button>
        </div>
      )}
    </Card>
  );
}
