import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDndContext,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { BlockFrame } from "./BlockFrame";
import { BlockRenderer } from "./BlockRenderer";
import { AddBlockMenu } from "./AddBlockMenu";
import {
  newBlock,
  groupIntoRows,
  isFullBleed,
  makeRowId,
  BLOCK_PALETTE,
  type Block,
  type BlockType,
} from "./types";
import { cn } from "@/lib/utils";

type Ctx = {
  libraryId: string;
  libContact: {
    address: string | null;
    phone: string | null;
    email: string | null;
    languages: string[] | null;
  };
  editMode: boolean;
};

/** Horizontal insertion line between rows. Expands hit area during drag. */
function RowGap({ index, disabledForActive }: { index: number; disabledForActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `gap:${index}`,
    disabled: disabledForActive,
  });
  const dnd = useDndContext();
  const dragging = !!dnd.active;
  return (
    <div
      ref={setNodeRef}
      aria-label="Insert block on new row"
      className={cn(
        "relative w-full transition-all",
        dragging ? "h-6 my-1" : "h-0 my-0 pointer-events-none",
      )}
    >
      {dragging && (
        <div
          className={cn(
            "absolute left-6 right-6 top-1/2 -translate-y-1/2 rounded-full transition-all",
            isOver ? "h-1.5 bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]" : "h-0.5 bg-primary/30",
          )}
        />
      )}
    </div>
  );
}

export function BlockList({
  blocks,
  onBlocksChange,
  ctx,
}: {
  blocks: Block[];
  onBlocksChange: (next: Block[]) => void;
  ctx: Ctx;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const rows = useMemo(() => groupIntoRows(blocks), [blocks]);

  function updateProps(id: string, props: any) {
    onBlocksChange(blocks.map((b) => (b.id === id ? ({ ...b, props } as Block) : b)));
  }
  function deleteBlock(id: string) {
    onBlocksChange(blocks.filter((b) => b.id !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex((b) => b.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= blocks.length) return;
    onBlocksChange(arrayMove(blocks, idx, next));
  }
  function insertAt(index: number, type: BlockType) {
    const b = { ...newBlock(type), rowId: makeRowId() };
    const next = [...blocks];
    next.splice(index, 0, b);
    onBlocksChange(next);
  }
  function unpair(id: string) {
    onBlocksChange(
      blocks.map((b) => (b.id === id ? ({ ...b, rowId: makeRowId() } as Block) : b)),
    );
  }
  function pairWithNext(id: string) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0 || idx >= blocks.length - 1) return;
    const cur = blocks[idx];
    const nxt = blocks[idx + 1];
    if (isFullBleed(cur) || isFullBleed(nxt)) return;
    const rowId = cur.rowId ?? makeRowId();
    onBlocksChange(
      blocks.map((b, i) =>
        i === idx ? ({ ...b, rowId } as Block) : i === idx + 1 ? ({ ...b, rowId } as Block) : b,
      ),
    );
  }

  /** Collision detection precedence: pair drop (over another block's body)
   *  → gap drop (row insertion bar) → generic reorder fallback. */
  const collision: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    const pair = pointer.filter((c) => String(c.id).startsWith("pair:"));
    if (pair.length > 0) return pair;
    const gap = pointer.filter((c) => String(c.id).startsWith("gap:"));
    if (gap.length > 0) return gap;
    // Rect intersection catches sortable siblings for keyboard reorder.
    return rectIntersection(args);
  };

  function moveToRowIndex(activeId: string, targetRowIndex: number) {
    const from = blocks.findIndex((b) => b.id === activeId);
    if (from < 0) return;
    // Compute the flat index where the block should land.
    // targetRowIndex is the row slot BEFORE which we insert (0..rows.length).
    let insertIdx = 0;
    for (let i = 0; i < targetRowIndex && i < rows.length; i++) {
      insertIdx += rows[i].items.length;
    }
    // Detach from its current row and give it a fresh rowId.
    const detached = blocks.map((b) =>
      b.id === activeId ? ({ ...b, rowId: makeRowId() } as Block) : b,
    );
    const next = [...detached];
    const [pulled] = next.splice(from, 1);
    // Adjust insert index if we removed a block before it.
    if (from < insertIdx) insertIdx -= 1;
    next.splice(insertIdx, 0, pulled);
    onBlocksChange(next);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const dragged = blocks.find((b) => b.id === active.id);
    if (!dragged) return;
    const overId = String(over.id);

    // Pair drop — vertical insertion on left or right edge of target block.
    if (overId.startsWith("pair-left:") || overId.startsWith("pair-right:")) {
      const insertBefore = overId.startsWith("pair-left:");
      const targetId = overId.slice(insertBefore ? "pair-left:".length : "pair-right:".length);
      if (targetId === active.id) return;
      const target = blocks.find((b) => b.id === targetId);
      if (!target) return;
      if (isFullBleed(dragged) || isFullBleed(target)) return;

      const targetRow = rows.find((r) => r.items.some((it) => it.id === targetId));
      if (!targetRow || targetRow.items.length >= 2) return;

      const rowId = target.rowId ?? makeRowId();
      const tagged = blocks.map((b) =>
        b.id === active.id || b.id === targetId ? ({ ...b, rowId } as Block) : b,
      );
      const fromIdx = tagged.findIndex((b) => b.id === active.id);
      const [pulled] = tagged.splice(fromIdx, 1);
      const targetIdx = tagged.findIndex((b) => b.id === targetId);
      const toIdx = insertBefore ? targetIdx : targetIdx + 1;
      tagged.splice(toIdx, 0, pulled);
      onBlocksChange(tagged);
      return;
    }

    // Gap drop → move to its own row at that slot.
    if (overId.startsWith("gap:")) {
      const targetRowIndex = parseInt(overId.slice("gap:".length), 10);
      moveToRowIndex(String(active.id), targetRowIndex);
      return;
    }

    // Sortable fallback (keyboard reorder / rect intersection).
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === overId);
    if (from < 0 || to < 0) return;
    const detached = blocks.map((b) =>
      b.id === active.id ? ({ ...b, rowId: makeRowId() } as Block) : b,
    );
    onBlocksChange(arrayMove(detached, from, to));
  }

  const { editMode } = ctx;

  if (blocks.length === 0) {
    if (!editMode) return null;
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground text-sm">This page has no content between the hero and the footer.</p>
        <AddBlockMenu variant="empty" onAdd={(t) => insertAt(0, t)} />
      </div>
    );
  }

  const sortableIds = blocks.map((b) => b.id);
  const indexOf = (id: string) => blocks.findIndex((b) => b.id === id);

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragEnd={onDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {editMode && <AddBlockMenu onAdd={(t) => insertAt(0, t)} />}
        {editMode && <RowGap index={0} disabledForActive={false} />}
        {rows.map((row, rowIdx) => {
          const insertAfterIndex =
            indexOf(row.items[row.items.length - 1].id) + 1;
          const paired = row.items.length === 2;
          return (
            <div key={row.rowId}>
              <div
                className={
                  paired
                    ? "grid grid-cols-1 md:grid-cols-2"
                    : undefined
                }
              >
                {row.items.map((block) => {
                  const flatIdx = indexOf(block.id);
                  const nextBlock = blocks[flatIdx + 1];
                  const canPairWithNext =
                    !!nextBlock &&
                    !isFullBleed(block) &&
                    !isFullBleed(nextBlock) &&
                    (nextBlock.rowId !== block.rowId) &&
                    (rows.find((r) => r.items.some((it) => it.id === nextBlock.id))?.items.length ?? 0) < 2 &&
                    row.items.length < 2;
                  return (
                    <BlockFrame
                      key={block.id}
                      id={block.id}
                      editMode={editMode}
                      canMoveUp={flatIdx > 0}
                      canMoveDown={flatIdx < blocks.length - 1}
                      isPaired={paired}
                      canPair={!isFullBleed(block) && !paired}
                      canPairWithNext={canPairWithNext}
                      onMoveUp={() => move(block.id, -1)}
                      onMoveDown={() => move(block.id, 1)}
                      onDelete={() => deleteBlock(block.id)}
                      onUnpair={() => unpair(block.id)}
                      onPairWithNext={() => pairWithNext(block.id)}
                    >
                      <BlockRenderer
                        block={block}
                        ctx={{
                          ...ctx,
                          editMode,
                          onChange: (props) => updateProps(block.id, props),
                        }}
                      />
                    </BlockFrame>
                  );
                })}
              </div>
              {editMode && <RowGap index={rowIdx + 1} disabledForActive={false} />}
              {editMode && rowIdx < rows.length && (
                <AddBlockMenu onAdd={(t) => insertAt(insertAfterIndex, t)} />
              )}
            </div>
          );
        })}
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        <DragGhost blocks={blocks} />
      </DragOverlay>
    </DndContext>
  );
}

function DragGhost({ blocks }: { blocks: Block[] }) {
  const { active } = useDndContext();
  if (!active) return null;
  const b = blocks.find((x) => x.id === active.id);
  if (!b) return null;
  const label = BLOCK_PALETTE.find((p) => p.type === b.type)?.label ?? b.type;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background shadow-2xl px-3 py-2 text-sm font-medium">
      <GripVertical className="size-4 text-muted-foreground" />
      <span>Moving “{label}”</span>
    </div>
  );
}
