declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

export function supportsEyedropper(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

export type EyedropperResult =
  | { ok: true; hex: string }
  | { ok: false; reason: "unsupported" | "cancelled" | "blocked" | "error"; message?: string };

/** Opens the browser eyedropper to sample a color from anywhere on screen. */
export function openEyedropper(): Promise<EyedropperResult> {
  if (!supportsEyedropper() || !window.EyeDropper) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }

  try {
    const eyeDropper = new window.EyeDropper();
    return eyeDropper
      .open()
      .then(({ sRGBHex }) => ({ ok: true as const, hex: sRGBHex }))
      .catch((err: unknown) => {
        if (err instanceof DOMException) {
          if (err.name === "AbortError") return { ok: false as const, reason: "cancelled" };
          if (err.name === "NotAllowedError" || err.name === "SecurityError") {
            return {
              ok: false as const,
              reason: "blocked",
              message: "Screen color picking is blocked in this context (for example inside an embedded preview).",
            };
          }
        }
        return {
          ok: false as const,
          reason: "error",
          message: err instanceof Error ? err.message : "Could not open the color picker.",
        };
      });
  } catch (err) {
    return Promise.resolve({
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Could not open the color picker.",
    });
  }
}
