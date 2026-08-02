import { useEffect, useState } from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickColorFromScreen, supportsEyedropper } from "@/lib/eyedropper";
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
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(supportsEyedropper());
  }, []);

  const handleClick = async () => {
    if (!supported) return;
    const hex = await pickColorFromScreen();
    if (hex) onPick(hex);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled={!supported}
      className={cn(size === "icon" ? "h-8 w-8 shrink-0" : "h-8 w-8 shrink-0", className)}
      onClick={handleClick}
      title={supported ? title : "Screen color picker is not supported in this browser"}
      aria-label={title}
    >
      <Pipette className="size-4" />
    </Button>
  );
}
