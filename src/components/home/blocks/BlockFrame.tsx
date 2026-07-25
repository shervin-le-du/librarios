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

  const { setNodeRef: setPairLeftRef, isOver: isPairLeftOver } = useDroppable({
    id: `pair-left:${id}`,
    disabled: !editMode || !canPair,
  });
  const { setNodeRef: setPairRightRef, isOver: isPairRightOver } = useDroppable({
    id: `pair-right:${id}`,
    disabled: !editMode || !canPair,
  });

  const dnd = useDndContext();
  const activeId = dnd.active?.id ? String(dnd.active.id) : null;
  const isSelfDrag = activeId === id;

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
      <div className="absolute inset-0 pointer-events-none rounded-sm transition-all ring-2 ring-transparent group-hover/block:ring-primary/30" />
      {canPair && (
        <>
          <div ref={setPairLeftRef} className="absolute inset-y-4 left-4 w-1/2 z-10" aria-hidden />
          <div ref={setPairRightRef} className="absolute inset-y-4 right-4 w-1/2 z-10" aria-hidden />
          {isPairLeftOver && !isSelfDrag && (
            <div
              className="absolute left-4 top-4 bottom-4 w-1 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)] pointer-events-none z-20"
              aria-hidden
            />
          )}
          {isPairRightOver && !isSelfDrag && (
            <div
              className="absolute right-4 top-4 bottom-4 w-1 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)] pointer-events-none z-20"
              aria-hidden
            />
          )}
        </>
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
