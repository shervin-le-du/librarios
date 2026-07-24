import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  sb, type Book, type Reader, type Reservation,
  computeDisplayStatus, isBorrowableBy, type BookCondition,
} from "@/lib/librarian";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, ArrowRight, MoreVertical, BookmarkPlus, X, Camera, Upload, ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IsbnScanButton } from "@/components/books/IsbnScanButton";
import { DeletionRequestDialog } from "@/components/deletion/DeletionRequestDialog";
import { DeletionRequestsCard } from "@/components/deletion/DeletionRequestsCard";

export const Route = createFileRoute("/$slug/app/books")({
  head: () => ({ meta: [{ title: "Books — LibrariOS" }] }),
  component: BooksPage,
});

type BookForm = Partial<Book> & { title: string };

type ReservationLite = Pick<Reservation, "id" | "book_id" | "reader_id" | "status"> & {
  reader: Pick<Reader, "id" | "first_name" | "last_name" | "membership_number"> | null;
};

type Filter = "all" | "available" | "on_loan" | "reserved" | "out_of_circulation";

function BooksPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Book | null>(null);
  const [open, setOpen] = useState(false);
  const [checkoutBook, setCheckoutBook] = useState<Book | null>(null);
  const [holdBook, setHoldBook] = useState<Book | null>(null);
  const [deleteBook, setDeleteBook] = useState<Book | null>(null);

  const books = useQuery({
    queryKey: ["books"],
    queryFn: async () => {
      const { data, error } = await sb.from("books").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Book[];
    },
  });

  const activeRes = useQuery({
    queryKey: ["reservations", "active"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("reservations")
        .select("id, book_id, reader_id, status, reader:readers(id,first_name,last_name,membership_number)")
        .eq("status", "active");
      if (error) throw error;
      return data as unknown as ReservationLite[];
    },
  });

  const resByBook = useMemo(() => {
    const m = new Map<string, ReservationLite>();
    (activeRes.data ?? []).forEach((r) => m.set(r.book_id, r));
    return m;
  }, [activeRes.data]);

  const coverPaths = useMemo(
    () => (books.data ?? []).map((b) => b.cover_image_url).filter((p): p is string => !!p),
    [books.data],
  );

  const coverUrls = useQuery({
    queryKey: ["book-cover-urls", coverPaths],
    enabled: coverPaths.length > 0,
    queryFn: async () => {
      const { data, error } = await sb.storage.from("book-covers").createSignedUrls(coverPaths, 3600);
      if (error) throw error;
      const map = new Map<string, string>();
      data?.forEach((d) => { if (d.path && d.signedUrl) map.set(d.path, d.signedUrl); });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return (books.data ?? []).filter((b) => {
      const matches = !term ||
        b.title.toLowerCase().includes(term) ||
        (b.author ?? "").toLowerCase().includes(term) ||
        (b.isbn ?? "").toLowerCase().includes(term) ||
        (b.category ?? "").toLowerCase().includes(term);
      if (!matches) return false;
      if (filter === "all") return true;
      if (filter === "out_of_circulation") return b.condition !== "in_circulation";
      if (b.condition !== "in_circulation") return false;
      if (filter === "available") return b.availability_status === "available" && !resByBook.get(b.id);
      if (filter === "on_loan") return b.availability_status === "on_loan";
      if (filter === "reserved") return !!resByBook.get(b.id);
      return true;
    });
  }, [books.data, q, filter, resByBook]);


  const setCondition = useMutation({
    mutationFn: async ({ id, condition }: { id: string; condition: BookCondition }) => {
      const { error } = await sb.rpc("set_book_condition", { p_book_id: id, p_condition: condition });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Condition updated");
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelHold = useMutation({
    mutationFn: async (resId: string) => {
      const { error } = await sb.rpc("cancel_reservation", { p_reservation_id: resId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hold cancelled");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Books</h1>
          <p className="text-muted-foreground mt-1">{books.data?.length ?? 0} title{books.data?.length === 1 ? "" : "s"} in your library.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/$slug/app/scan" params={{ slug }}>
              <Camera className="size-4" /> Scan book
            </Link>
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Add book
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input placeholder="Search by title, author, ISBN, category…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "available", "on_loan", "reserved", "out_of_circulation"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
              {f.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>

      <DeletionRequestsCard entityType="book" />

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {books.data?.length === 0 ? "No books yet — add your first." : "No matches."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <Th className="w-14"></Th><Th>Title</Th><Th>Author</Th><Th>ISBN</Th><Th>Category</Th><Th>Status</Th><Th className="text-right pr-4">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((b) => {
                const res = resByBook.get(b.id);
                const readerName = res?.reader ? `${res.reader.first_name} ${res.reader.last_name}` : null;
                const status = computeDisplayStatus(b, { activeReservationReaderName: readerName });
                const canCheckout = isBorrowableBy(b, { activeReservationReaderId: res?.reader_id ?? null, readerId: null }) || (b.availability_status === "available" && b.condition === "in_circulation" && !!res);
                const canHold = b.condition === "in_circulation" && !res;
                return (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <Td className="py-2">
                      <div className="w-10 h-14 rounded-sm overflow-hidden bg-muted flex items-center justify-center">
                        {b.cover_image_url && coverUrls.data?.get(b.cover_image_url) ? (
                          <img src={coverUrls.data.get(b.cover_image_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="size-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </Td>
                    <Td className="font-medium">{b.title}</Td>
                    <Td>{b.author ?? "—"}</Td>
                    <Td className="text-muted-foreground">{b.isbn ?? "—"}</Td>
                    <Td className="text-muted-foreground">{b.category ?? "—"}</Td>
                    <Td><StatusBadge status={status} /></Td>
                    <Td className="text-right pr-2">
                      <div className="flex justify-end gap-1">
                        {canCheckout && (
                          <Button size="sm" variant="ghost" onClick={() => setCheckoutBook(b)} className="gap-1">
                            Check out <ArrowRight className="size-3.5" />
                          </Button>
                        )}
                        {canHold && (
                          <Button size="sm" variant="ghost" onClick={() => setHoldBook(b)} className="gap-1">
                            <BookmarkPlus className="size-3.5" /> Hold
                          </Button>
                        )}
                        {res && (
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Cancel hold for ${readerName}?`)) cancelHold.mutate(res.id); }} className="gap-1">
                            <X className="size-3.5" /> Cancel hold
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreVertical className="size-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(b); setOpen(true); }}>
                              <Pencil className="size-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">Condition</DropdownMenuLabel>
                            {(["in_circulation", "lost", "damaged", "withdrawn"] as BookCondition[]).map((c) => (
                              <DropdownMenuItem key={c} disabled={b.condition === c}
                                onClick={() => setCondition.mutate({ id: b.id, condition: c })}>
                                {c === "in_circulation" ? "Restore to circulation" : `Mark ${c}`}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive"
                              onClick={() => setDeleteBook(b)}>
                              <Trash2 className="size-4 mr-2" /> Delete…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <BookFormDialog open={open} onOpenChange={setOpen} editing={editing} />
      {checkoutBook && <CheckoutDialog book={checkoutBook} reservedReaderId={resByBook.get(checkoutBook.id)?.reader_id ?? null} onClose={() => setCheckoutBook(null)} />}
      {holdBook && <HoldDialog book={holdBook} onClose={() => setHoldBook(null)} />}
      {deleteBook && (
        <DeletionRequestDialog
          open={!!deleteBook}
          onOpenChange={(o) => { if (!o) setDeleteBook(null); }}
          entityType="book"
          entityId={deleteBook.id}
          entityLabel={deleteBook.title}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ReturnType<typeof computeDisplayStatus> }) {
  const variant =
    status.tone === "ok" ? "secondary"
    : status.tone === "danger" ? "destructive"
    : status.tone === "muted" ? "outline"
    : "default";
  return <Badge variant={variant as any}>{status.label}</Badge>;
}

function Th({ children, className = "" }: any) { return <th className={"py-3 px-4 font-medium text-muted-foreground " + className}>{children}</th>; }
function Td({ children, className = "" }: any) { return <td className={"py-3 px-4 " + className}>{children}</td>; }

function BookFormDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (b: boolean) => void; editing: Book | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<BookForm>({ title: "" });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm(editing ?? { title: "", author: "", isbn: "", language: "", category: "", description: "" } as any);
    setCoverPreview(null);
  }, [open, editing]);

  useEffect(() => {
    let cancelled = false;
    const path = (form as any).cover_image_url as string | null | undefined;
    if (!path) { setCoverPreview(null); return; }
    sb.storage.from("book-covers").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setCoverPreview(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [(form as any).cover_image_url]);

  const uploadCover = async (file: File) => {
    setUploading(true);
    try {
      const { data: lib, error: le } = await sb.from("libraries").select("id").limit(1).single();
      if (le) throw le;
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${lib.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("book-covers").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const prev = (form as any).cover_image_url as string | null | undefined;
      if (prev) { await sb.storage.from("book-covers").remove([prev]); }
      setForm((f) => ({ ...f, cover_image_url: path } as any));
      toast.success("Cover uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeCover = async () => {
    const path = (form as any).cover_image_url as string | null | undefined;
    if (path) { await sb.storage.from("book-covers").remove([path]); }
    setForm((f) => ({ ...f, cover_image_url: null } as any));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      const payload = {
        title: form.title, author: form.author || null, isbn: form.isbn || null,
        language: form.language || null, category: form.category || null,
        description: (form as any).description || null,
        cover_image_url: (form as any).cover_image_url || null,
      };
      if (editing) {
        const { error } = await sb.from("books").update(payload as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: lib, error: le } = await sb.from("libraries").select("id").limit(1).single();
        if (le) throw le;
        const { error } = await sb.from("books").insert({ library_id: lib.id, ...payload } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Book updated" : "Book added");
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["book-cover-urls"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit book" : "Add book"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          {!editing && (
            <IsbnScanButton
              onResult={(d) => setForm((prev) => ({
                ...prev,
                isbn: d.isbn ?? prev.isbn ?? "",
                title: prev.title || (d.title ?? ""),
                author: prev.author || (d.author ?? ""),
                language: prev.language || (d.language ?? ""),
              }))}
            />
          )}
          <Field label="Cover photo">
            <div className="flex items-start gap-3">
              <div className="w-24 h-32 rounded-md overflow-hidden bg-muted flex items-center justify-center border">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }}
                  />
                  <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-muted">
                    <Upload className="size-3.5" /> {uploading ? "Uploading…" : coverPreview ? "Replace" : "Upload"}
                  </span>
                </label>
                {coverPreview && (
                  <Button type="button" size="sm" variant="ghost" onClick={removeCover} className="gap-1 text-destructive">
                    <X className="size-3.5" /> Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground max-w-[16rem]">Portrait JPG/PNG works best.</p>
              </div>
            </div>
          </Field>
          <Field label="Title *"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
          <Field label="Author"><Input value={form.author ?? ""} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ISBN"><Input value={form.isbn ?? ""} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></Field>
            <Field label="Language"><Input value={form.language ?? ""} onChange={(e) => setForm({ ...form, language: e.target.value })} /></Field>
          </div>
          <Field label="Category"><Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Description">
            <textarea
              value={(form as any).description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value } as any)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Short summary of the book…"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutDialog({ book, reservedReaderId, onClose }: { book: Book; reservedReaderId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [readerId, setReaderId] = useState<string>(reservedReaderId ?? "");
  const defaultDue = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }, []);
  const [due, setDue] = useState(defaultDue);

  const readers = useQuery({
    queryKey: ["readers", "active"],
    queryFn: async () => {
      const { data, error } = await sb.from("readers").select("id, first_name, last_name, membership_number, status").eq("status", "active").order("first_name");
      if (error) throw error;
      return data as Reader[];
    },
  });

  // If a reservation exists, lock the reader picker to the reserving reader.
  const lockedReaderList = useMemo(() => {
    if (!reservedReaderId) return readers.data ?? [];
    return (readers.data ?? []).filter((r) => r.id === reservedReaderId);
  }, [readers.data, reservedReaderId]);

  const checkout = useMutation({
    mutationFn: async () => {
      if (!readerId) throw new Error("Choose a reader");
      const { error } = await sb.rpc("checkout_book", { p_book_id: book.id, p_reader_id: readerId, p_due_date: due });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Book checked out");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Check out · {book.title}</DialogTitle></DialogHeader>
        {reservedReaderId && (
          <div className="text-sm rounded-md bg-muted px-3 py-2 text-muted-foreground">
            This book is reserved. Checkout will fulfill the hold.
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); checkout.mutate(); }} className="space-y-4">
          <Field label="Reader *">
            <Select value={readerId} onValueChange={setReaderId} disabled={!!reservedReaderId}>
              <SelectTrigger><SelectValue placeholder="Choose a reader" /></SelectTrigger>
              <SelectContent>
                {lockedReaderList.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.first_name} {r.last_name} — {r.membership_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due date *"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={checkout.isPending}>{checkout.isPending ? "Checking out…" : "Check out"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HoldDialog({ book, onClose }: { book: Book; onClose: () => void }) {
  const qc = useQueryClient();
  const [readerId, setReaderId] = useState("");

  const readers = useQuery({
    queryKey: ["readers", "active"],
    queryFn: async () => {
      const { data, error } = await sb.from("readers").select("id, first_name, last_name, membership_number, status").eq("status", "active").order("first_name");
      if (error) throw error;
      return data as Reader[];
    },
  });

  const place = useMutation({
    mutationFn: async () => {
      if (!readerId) throw new Error("Choose a reader");
      const { error } = await sb.rpc("place_reservation", { p_book_id: book.id, p_reader_id: readerId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hold placed");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Place hold · {book.title}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); place.mutate(); }} className="space-y-4">
          <Field label="Reader *">
            <Select value={readerId} onValueChange={setReaderId}>
              <SelectTrigger><SelectValue placeholder="Choose a reader" /></SelectTrigger>
              <SelectContent>
                {(readers.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.first_name} {r.last_name} — {r.membership_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={place.isPending}>{place.isPending ? "Placing…" : "Place hold"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
