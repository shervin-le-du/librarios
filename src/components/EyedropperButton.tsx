import { useRef } from "react";
import { Pipette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openEyedropper, supportsEyedropper } from "@/lib/eyedropper";
import { cn } from "@/lib/utils";

interface EyedropperButtonProps {
  onPick: (hex: string) => void;
  /** Current color — used as the starting value for the native picker fallback. */
  color?: string;
  className?: string;
  size?: "icon" | "sm";
  title?: string;
}

function normalizeHex(color: string | undefined): string {
  const hex = (color ?? "#000000").replace("#", "");
  if (hex.length === 6) return `#${hex}`;
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return "#000000";
}

export function EyedropperButton({
  onPick,
  color = "#000000",
  className,
  size = "sm",
  title = "Pick color from screen",
}: EyedropperButtonProps) {
  const fallbackRef = useRef<HTMLInputElement>(null);
  const value = normalizeHex(color);

  const openNativePicker = () => {
    const input = fallbackRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!supportsEyedropper()) {
      openNativePicker();
      return;
    }

    // Call open() synchronously inside the user-gesture handler.
    void openEyedropper().then((result) => {
      if (result.ok) {
        onPick(result.hex);
        return;
      }
      if (result.reason === "cancelled") return;
      if (result.reason === "blocked") {
        toast.message("Screen picker unavailable", {
          description: result.message ?? "Opening the standard color picker instead.",
        });
        openNativePicker();
        return;
      }
      if (result.reason === "unsupported") {
        openNativePicker();
        return;
      }
      toast.error(result.message ?? "Could not pick a color.");
    });
  };

  return (
    <>
      <input
        ref={fallbackRef}
        type="color"
        value={value}
        onChange={(e) => onPick(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <Button
        type="button"
        variant="ghost"
        size={size}
        className={cn("h-8 w-8 shrink-0", className)}
        onPointerDown={handlePointerDown}
        title={title}
        aria-label={title}
      >
        <Pipette className="size-4" />
      </Button>
    </>
  );
}
