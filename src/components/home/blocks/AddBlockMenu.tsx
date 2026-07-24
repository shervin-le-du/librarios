import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BLOCK_PALETTE, type BlockType } from "./types";

export function AddBlockMenu({
  onAdd,
  variant = "inline",
}: {
  onAdd: (type: BlockType) => void;
  variant?: "inline" | "empty";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "empty" ? (
          <Button variant="outline" size="lg" className="gap-2">
            <Plus className="size-4" /> Add your first block
          </Button>
        ) : (
          <button
            type="button"
            className="group/add relative w-full max-w-5xl mx-auto flex items-center justify-center h-6 my-1 opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-label="Add block"
          >
            <span className="absolute left-6 right-6 h-px bg-primary/40" />
            <span className="relative z-10 flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-medium px-2.5 py-1 shadow">
              <Plus className="size-3.5" /> Add block
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="center">
        <div className="grid gap-0.5">
          {BLOCK_PALETTE.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={(e) => {
                onAdd(item.type);
                // Close popover
                (e.currentTarget.closest("[data-radix-popper-content-wrapper]") as HTMLElement | null)
                  ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
              }}
              className="text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
            >
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
