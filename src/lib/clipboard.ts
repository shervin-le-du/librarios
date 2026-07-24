import { toast } from "sonner";

/** Copy text to the clipboard, with a hidden-textarea fallback for iframes
 *  where the async Clipboard API is blocked by permissions policy. */
export async function copyText(text: string, successMessage = "Copied"): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) { toast.success(successMessage); return true; }
  } catch {
    /* ignore */
  }
  toast.error("Couldn't copy — select the link and copy manually");
  return false;
}
