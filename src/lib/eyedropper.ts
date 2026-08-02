declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

export function supportsEyedropper(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

/** Opens the browser eyedropper to sample a color from anywhere on screen. */
export async function pickColorFromScreen(): Promise<string | null> {
  if (!supportsEyedropper() || !window.EyeDropper) return null;
  try {
    const eyeDropper = new window.EyeDropper();
    const { sRGBHex } = await eyeDropper.open();
    return sRGBHex;
  } catch {
    return null;
  }
}
