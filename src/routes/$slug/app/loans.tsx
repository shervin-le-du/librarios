import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sb, isOverdue, type LoanWithRefs, type Book, type Reader } from "@/lib/librarian";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/$slug/app/loans")({
  head: () => ({ meta: [{ title: "Loans — LibrariOS" }] }),
  component: LoansPage,
});

type Filter = "active" | "overdue" | "returned" | "all";

function LoansPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("active");
  const [open, setOpen] = useState(false);

  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("loans")
        .select("*, book:books(id,title,author), reader:readers(id,first_name,last_name,membership_number)")
        .order("checked_out_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LoanWithRefs[];
    },
  });

  const filtered = useMemo(() => {
    const all = loans.data ?? [];
    if (filter === "all") return all;
    if (filter === "active") return all.filter((l) => l.status === "active");
    if (filter === "returned") return all.filter((l) => l.status === "returned");
    return all.filter((l) => isOverdue(l));
  }, [loans.data, filter]);

  const ret = useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await sb.rpc("return_loan", { p_loan_id: loanId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Book returned");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Loans</h1>
          <p className="text-muted-foreground mt-1">Track checkouts, returns, and overdue items.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="size-4" /> New checkout</Button>
      </div>

      <div className="flex gap-2 mb-4">
        {(["active", "overdue", "returned", "all"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No loans here.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr><Th>Book</Th><Th>Reader</Th><Th>Checked out</Th><Th>Due</Th><Th>Status</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((l) => {
                const overdue = isOverdue(l);
                return (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{l.book?.title}<div className="text-xs text-muted-foreground font-normal">{l.book?.author}</div></Td>
                    <Td>{l.reader?.first_name} {l.reader?.last_name}<div className="text-xs text-muted-foreground font-mono">{l.reader?.membership_number}</div></Td>
                    <Td className="text-muted-foreground">{format(new Date(l.checked_out_at), "MMM d, yyyy")}</Td>
                    <Td>{format(new Date(l.due_date), "MMM d, yyyy")}</Td>
                    <Td>
                      {l.status === "returned"
                        ? <Badge variant="secondary">Returned</Badge>
                        : overdue ? <Badge variant="destructive">OVERDUE</Badge> : <Badge>Active</Badge>}
                    </Td>
                    <Td className="text-right pr-2">
                      {l.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => ret.mutate(l.id)} className="gap-1.5">
                          <RotateCcw className="size-3.5" /> Return
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {open && <NewCheckoutDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function Th({ children }: any) { return <th className="py-3 px-4 font-medium text-muted-foreground">{children}</th>; }
function Td({ children, className = "" }: any) { return <td className={"py-3 px-4 " + className}>{children}</td>; }

function NewCheckoutDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [bookId, setBookId] = useState("");
  const [readerId, setReaderId] = useState("");
  const defaultDue = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); }, []);
  const [due, setDue] = useState(defaultDue);

  const books = useQuery({
    queryKey: ["books", "available"],
    queryFn: async () => {
      const { data, error } = await sb.from("books").select("id, title, author").eq("availability_status", "available").eq("condition", "in_circulation").order("title");
      if (error) throw error;
      return data as Pick<Book, "id" | "title" | "author">[];
    },
  });
  const readers = useQuery({
    queryKey: ["readers", "active"],
    queryFn: async () => {
      const { data, error } = await sb.from("readers").select("id, first_name, last_name, membership_number").eq("status", "active").order("first_name");
      if (error) throw error;
      return data as Pick<Reader, "id" | "first_name" | "last_name" | "membership_number">[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!bookId) throw new Error("Choose a book");
      if (!readerId) throw new Error("Choose a reader");
      const { error } = await sb.rpc("checkout_book", { p_book_id: bookId, p_reader_id: readerId, p_due_date: due });
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
        <DialogHeader><DialogTitle>New checkout</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Book *</Label>
            <Select value={bookId} onValueChange={setBookId}>
              <SelectTrigger><SelectValue placeholder={books.data?.length === 0 ? "No available books" : "Choose a book"} /></SelectTrigger>
              <SelectContent>
                {(books.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.title}{b.author ? ` — ${b.author}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reader *</Label>
            <Select value={readerId} onValueChange={setReaderId}>
              <SelectTrigger><SelectValue placeholder="Choose a reader" /></SelectTrigger>
              <SelectContent>
                {(readers.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name} — {r.membership_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due date *</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submit.isPending}>{submit.isPending ? "Checking out…" : "Check out"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
