import { Pipette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openEyedropper, supportsEyedropper } from "@/lib/eyedropper";
import { cn } from "@/lib/utils";

interface EyedropperButtonProps {
  onPick: (hex: string) => void;
  className?: string;
  size?: "icon" | "sm";
  title?: string;
}

export function EyedropperButton({
  onPick,
  className,
  size = "sm",
  title = "Pick color from screen",
}: EyedropperButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (!supportsEyedropper()) {
      toast.error("Screen color picking isn't supported in this browser. Try Chrome, Edge, or Firefox 131+.");
      return;
    }

    // open() must be invoked synchronously from the click handler (user activation).
    const pending = openEyedropper();
    void pending.then((result) => {
      if (result.ok) {
        onPick(result.hex);
        return;
      }
      if (result.reason === "cancelled") return;
      if (result.reason === "blocked") {
        toast.error("Screen picker blocked", {
          description:
            result.message ??
            "Open this page in a full browser tab (not an embedded preview) to sample colors from the screen.",
        });
        return;
      }
      toast.error(result.message ?? "Could not open the screen color picker.");
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn("h-8 w-8 shrink-0", className)}
      onClick={handleClick}
      title={title}
      aria-label={title}
    >
      <Pipette className="size-4" />
    </Button>
  );
}
