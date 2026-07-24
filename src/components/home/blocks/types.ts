import type { HomePageConfig } from "@/lib/use-current-library";

export type BlockType = "announcement" | "about" | "visit" | "rich_text" | "image" | "cta" | "featured_book";

export type CtaAlignment = "center" | "left" | "right";
export type CtaBackground = "solid" | "gradient";

export type Block =
  | { id: string; rowId?: string; type: "announcement"; props: { text?: string; visible?: boolean; bg?: string; fg?: string; accent?: string } }
  | { id: string; rowId?: string; type: "about"; props: { heading?: string; text?: string; bg?: string; fg?: string } }
  | { id: string; rowId?: string; type: "visit"; props: { heading?: string; hours?: string; bg?: string; fg?: string; accent?: string } }
  | { id: string; rowId?: string; type: "rich_text"; props: { heading?: string; text?: string; bg?: string; fg?: string } }
  | { id: string; rowId?: string; type: "image"; props: { path?: string | null; caption?: string; bg?: string; fg?: string } }
  | { id: string; rowId?: string; type: "cta"; props: { heading?: string; subtext?: string; label?: string; href?: string; align?: CtaAlignment; background?: CtaBackground; bg?: string; fg?: string; accent?: string } }
  | { id: string; rowId?: string; type: "featured_book"; props: {
      book_id?: string | null;
      intro?: string;
      title?: string;
      author?: string;
      year?: string;
      description?: string;
      image_path?: string | null;
      cta_label?: string;
      cta_href?: string;
      bg?: string; fg?: string; accent?: string;
    } };

/** Blocks that cannot be paired side-by-side — they always occupy their own row. */
export const FULL_BLEED_TYPES: BlockType[] = ["announcement"];
export function isFullBleed(b: Block) { return FULL_BLEED_TYPES.includes(b.type); }

export type BlockRow = { rowId: string; items: Block[] };

/**
 * Group blocks into visual rows. Consecutive blocks sharing a `rowId` are
 * grouped (max 2 per row). Full-bleed blocks always occupy their own row.
 * Blocks without a `rowId` get a synthetic single-block row.
 */
export function groupIntoRows(blocks: Block[]): BlockRow[] {
  const rows: BlockRow[] = [];
  for (const b of blocks) {
    const last = rows[rows.length - 1];
    const canJoin =
      !!last &&
      !!b.rowId &&
      last.rowId === b.rowId &&
      last.items.length < 2 &&
      !isFullBleed(b) &&
      !last.items.some(isFullBleed);
    if (canJoin) {
      last!.items.push(b);
    } else {
      rows.push({ rowId: b.rowId ?? `solo_${b.id}`, items: [b] });
    }
  }
  return rows;
}


export type HomePageConfigWithBlocks = HomePageConfig & { blocks?: Block[] };

function uid() {
  // Small random id — crypto.randomUUID if available.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeRowId() {
  return `r_${uid()}`;
}


export function newBlock(type: BlockType): Block {
  switch (type) {
    case "announcement":
      return { id: uid(), type, props: { text: "", visible: true } };
    case "about":
      return { id: uid(), type, props: { heading: "About", text: "" } };
    case "visit":
      return { id: uid(), type, props: { heading: "Visit us", hours: "" } };
    case "rich_text":
      return { id: uid(), type, props: { heading: "", text: "" } };
    case "image":
      return { id: uid(), type, props: { path: null, caption: "" } };
    case "cta":
      return { id: uid(), type, props: { heading: "", subtext: "", label: "Learn more", href: "", align: "center", background: "solid" } };
    case "featured_book":
      return { id: uid(), type, props: { intro: "Featured this month", title: "", author: "", year: "", description: "", image_path: null, cta_label: "Browse the collection", cta_href: "" } };
  }
}

export const BLOCK_PALETTE: { type: BlockType; label: string; description: string }[] = [
  { type: "rich_text", label: "Text", description: "Heading and body text" },
  { type: "image", label: "Image", description: "Full-width photo with caption" },
  { type: "cta", label: "Call to action", description: "Button that links somewhere" },
  { type: "featured_book", label: "Featured book", description: "Highlight a book with cover and link" },
  { type: "about", label: "About", description: "Introduce your library" },
  { type: "visit", label: "Visit us", description: "Hours, address, contact" },
  { type: "announcement", label: "Announcement", description: "Highlighted banner" },
];

/**
 * If `blocks` is missing, derive an initial list from the legacy fields so
 * existing pages keep rendering the same content.
 */
export function ensureBlocks(cfg: HomePageConfigWithBlocks | null | undefined): Block[] {
  if (!cfg) return [];
  if (Array.isArray(cfg.blocks)) return cfg.blocks;
  const seeded: Block[] = [];
  if (cfg.announcement?.trim()) {
    seeded.push({
      id: uid(),
      type: "announcement",
      props: { text: cfg.announcement, visible: cfg.announcement_visible !== false },
    });
  }
  if (cfg.about_text?.trim()) {
    seeded.push({ id: uid(), type: "about", props: { heading: "About", text: cfg.about_text } });
  }
  // Visit is always meaningful (contact info comes from library settings), seed it too.
  seeded.push({ id: uid(), type: "visit", props: { heading: "Visit us", hours: cfg.hours ?? "" } });
  return seeded;
}
