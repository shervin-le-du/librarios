import { useSortable } from "@dnd-kit/sortable";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronUp, ChevronDown, Columns2, Split } from "lucide-react";
import { cn } from "@/lib/utils";

export function BlockFrame({
  id,
  editMode,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isPaired,
  canPair,
  onUnpair,
  onPairWithNext,
  canPairWithNext,
  children,
}: {
  id: string;
  editMode: boolean;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isPaired: boolean;
  canPair: boolean;
  onUnpair: () => void;
  onPairWithNext: () => void;
  canPairWithNext: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode,
  });

  // Pair droppable — its rect drives dnd-kit collision detection.
  const { setNodeRef: setPairRef, isOver: isPairOver } = useDroppable({
    id: `pair:${id}`,
    disabled: !editMode || !canPair,
  });

  const dnd = useDndContext();
  const activeId = dnd.active?.id ? String(dnd.active.id) : null;
  const dragging = !!activeId;
  const isSelfDrag = activeId === id;
  // Show the pair affordance whenever something else is being dragged onto a
  // block that can accept a pair. Also show a light hint at rest so users
  // discover the gesture.
  const showPairHint = editMode && canPair && dragging && !isSelfDrag;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!editMode) return <>{children}</>;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/block h-full",
        isDragging && "opacity-40 z-30",
      )}
    >
      {/* Outer outline: hover at rest, primary while a peer is dragged over us. */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none rounded-sm transition-all",
          isPairOver
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
            : showPairHint
              ? "ring-2 ring-primary/30 ring-dashed"
              : "ring-2 ring-transparent group-hover/block:ring-primary/30",
        )}
      />
      {/* Pair drop target — covers most of the block so aiming is easy. */}
      {canPair && (
        <div
          ref={setPairRef}
          className={cn(
            "absolute inset-4 z-10 rounded-md pointer-events-none flex items-center justify-center transition-all",
            isPairOver
              ? "bg-primary/15 opacity-100"
              : showPairHint
                ? "bg-primary/5 opacity-100"
                : "opacity-0",
          )}
          aria-hidden
        >
          {showPairHint && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full text-xs font-medium px-3 py-1.5 shadow-md transition-all",
                isPairOver
                  ? "bg-primary text-primary-foreground scale-105"
                  : "bg-background/90 text-foreground border",
              )}
            >
              <Columns2 className="size-3.5" />
              {isPairOver ? "Release to pair side-by-side" : "Drop here to pair"}
            </div>
          )}
        </div>
      )}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-full border bg-background shadow-sm px-1 py-0.5 opacity-0 group-hover/block:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder or drop on another block to pair"
          title="Drag: onto a block = pair · between rows = move"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          aria-label="Move up"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="p-1 rounded hover:bg-muted disabled:opacity-30"
          aria-label="Move down"
        >
          <ChevronDown className="size-3.5" />
        </button>
        {isPaired ? (
          <button
            type="button"
            onClick={onUnpair}
            className="p-1 rounded hover:bg-muted"
            aria-label="Move to its own row"
            title="Move to its own row"
          >
            <Split className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPairWithNext}
            disabled={!canPairWithNext}
            className="p-1 rounded hover:bg-muted disabled:opacity-30"
            aria-label="Pair with next block"
            title="Pair side-by-side with next block"
          >
            <Columns2 className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded hover:bg-destructive/10 text-destructive"
          aria-label="Delete block"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}
