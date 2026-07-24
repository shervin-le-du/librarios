import { supabase } from "@/integrations/supabase/client";

export type BookCondition = "in_circulation" | "lost" | "damaged" | "withdrawn";

export type Book = {
  id: string;
  library_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  language: string | null;
  category: string | null;
  availability_status: "available" | "on_loan";
  condition: BookCondition;
  created_at: string;
  description?: string | null;
  cover_image_url?: string | null;
};

export type Reader = {
  id: string;
  library_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  id_document_type: string | null;
  id_document_number: string | null;
  membership_number: string;
  status: "active" | "suspended";
  created_at: string;
};

export type Loan = {
  id: string;
  library_id: string;
  book_id: string;
  reader_id: string;
  checked_out_at: string;
  due_date: string;
  returned_at: string | null;
  status: "active" | "returned";
  created_at: string;
};

export type LoanWithRefs = Loan & {
  book: Pick<Book, "id" | "title" | "author"> | null;
  reader: Pick<Reader, "id" | "first_name" | "last_name" | "membership_number"> | null;
};

export type Reservation = {
  id: string;
  library_id: string;
  book_id: string;
  reader_id: string;
  status: "active" | "fulfilled" | "cancelled" | "expired";
  expires_at: string | null;
  created_at: string;
};

export type ReservationWithRefs = Reservation & {
  book: Pick<Book, "id" | "title" | "author"> | null;
  reader: Pick<Reader, "id" | "first_name" | "last_name" | "membership_number"> | null;
};

export const isOverdue = (loan: { status: string; due_date: string }) =>
  loan.status === "active" && new Date(loan.due_date) < new Date(new Date().toDateString());

export type DisplayStatus = {
  label: string;
  tone: "ok" | "info" | "warn" | "danger" | "muted";
};

/** Compute a human-readable status from the three independent dimensions. */
export function computeDisplayStatus(book: Pick<Book, "availability_status" | "condition">, opts: {
  activeReservationReaderName?: string | null;
  activeLoanOverdue?: boolean;
} = {}): DisplayStatus {
  if (book.condition === "lost") return { label: "Lost", tone: "danger" };
  if (book.condition === "damaged") return { label: "Damaged", tone: "warn" };
  if (book.condition === "withdrawn") return { label: "Withdrawn", tone: "muted" };

  const reservedFor = opts.activeReservationReaderName;
  if (book.availability_status === "on_loan") {
    if (opts.activeLoanOverdue && reservedFor) return { label: `On loan · Overdue · Reserved for ${reservedFor}`, tone: "danger" };
    if (opts.activeLoanOverdue) return { label: "On loan · Overdue", tone: "danger" };
    if (reservedFor) return { label: `On loan · Reserved for ${reservedFor}`, tone: "info" };
    return { label: "On loan", tone: "info" };
  }
  if (reservedFor) return { label: `Reserved for ${reservedFor}`, tone: "warn" };
  return { label: "Available", tone: "ok" };
}

/** Derived borrowability: is this book borrowable by reader R right now? */
export function isBorrowableBy(
  book: Pick<Book, "availability_status" | "condition">,
  opts: { activeReservationReaderId?: string | null; readerId?: string | null }
): boolean {
  if (book.availability_status !== "available") return false;
  if (book.condition !== "in_circulation") return false;
  if (opts.activeReservationReaderId && opts.activeReservationReaderId !== opts.readerId) return false;
  return true;
}

export async function getCurrentLibrary() {
  const { data: lib, error } = await supabase
    .from("libraries")
    .select("id, name")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return lib;
}

export const sb = supabase;
