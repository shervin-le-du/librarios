import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { sb, isOverdue, type LoanWithRefs } from "@/lib/librarian";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Library, Users, ArrowLeftRight, AlertCircle, Bookmark, UserX, BookCheck } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export const Route = createFileRoute("/$slug/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LibrariOS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { slug } = Route.useParams();
  const [overdueOnly, setOverdueOnly] = useState(false);

  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [books, onLoan, readers, activeLoans, reservations, suspended] = await Promise.all([
        sb.from("books").select("id", { count: "exact", head: true }),
        sb.from("books").select("id", { count: "exact", head: true }).eq("availability_status", "on_loan"),
        sb.from("readers").select("id", { count: "exact", head: true }),
        sb.from("loans").select("id, due_date", { count: "exact" }).eq("status", "active"),
        sb.from("reservations").select("id, book_id", { count: "exact" }).eq("status", "active"),
        sb.from("readers").select("id", { count: "exact", head: true }).eq("status", "suspended"),
      ]);
      const overdueCount = (activeLoans.data ?? []).filter((l: any) =>
        new Date(l.due_date) < new Date(new Date().toDateString())
      ).length;
      const total = books.count ?? 0;
      const onLoanCount = onLoan.count ?? 0;
      const reservedCount = reservations.count ?? 0;
      // Derived available = in_circulation, not on loan, not reserved.
      // We approximate "Available" via the books table query below.
      return {
        books: total,
        onLoan: onLoanCount,
        readers: readers.count ?? 0,
        overdue: overdueCount,
        reserved: reservedCount,
        suspended: suspended.count ?? 0,
      };
    },
  });

  const availableCount = useQuery({
    queryKey: ["dashboard-available"],
    queryFn: async () => {
      const [{ count: avail }, reservedRes] = await Promise.all([
        sb.from("books").select("id", { count: "exact", head: true })
          .eq("availability_status", "available").eq("condition", "in_circulation"),
        sb.from("reservations").select("book_id").eq("status", "active"),
      ]);
      const reservedBookIds = new Set((reservedRes.data ?? []).map((r: any) => r.book_id));
      if (reservedBookIds.size === 0) return avail ?? 0;
      // Subtract those whose book is available + in_circulation
      const { data: availBooks } = await sb.from("books").select("id")
        .eq("availability_status", "available").eq("condition", "in_circulation");
      const heldAndAvailable = (availBooks ?? []).filter((b: any) => reservedBookIds.has(b.id)).length;
      return Math.max(0, (avail ?? 0) - heldAndAvailable);
    },
  });

  const loans = useQuery({
    queryKey: ["dashboard-active-loans"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("loans")
        .select("*, book:books(id,title,author), reader:readers(id,first_name,last_name,membership_number)")
        .eq("status", "active")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as unknown as LoanWithRefs[];
    },
  });

  const activeRes = useQuery({
    queryKey: ["dashboard-active-reservations"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("reservations")
        .select("book_id, reader:readers(first_name,last_name)")
        .eq("status", "active");
      if (error) throw error;
      return data as any[];
    },
  });

  const resByBook = new Map<string, string>();
  (activeRes.data ?? []).forEach((r: any) => {
    if (r.reader) resByBook.set(r.book_id, `${r.reader.first_name} ${r.reader.last_name}`);
  });

  const filtered = (loans.data ?? []).filter((l) => (overdueOnly ? isOverdue(l) : true));

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Today at the library.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total books" value={stats.data?.books} icon={Library} to="/$slug/app/books" slug={slug} />
        <StatCard label="Available" value={availableCount.data} icon={BookCheck} to="/$slug/app/books" slug={slug} />
        <StatCard label="On loan" value={stats.data?.onLoan} icon={ArrowLeftRight} to="/$slug/app/loans" slug={slug} />
        <StatCard label="Overdue" value={stats.data?.overdue} icon={AlertCircle} tone="warn" to="/$slug/app/loans" slug={slug} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Reserved" value={stats.data?.reserved} icon={Bookmark} to="/$slug/app/books" slug={slug} />
        <StatCard label="Readers" value={stats.data?.readers} icon={Users} to="/$slug/app/readers" slug={slug} />
        <StatCard label="Suspended readers" value={stats.data?.suspended} icon={UserX} tone={stats.data?.suspended ? "warn" : undefined} to="/$slug/app/readers" slug={slug} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Active loans</h2>
        <div className="flex gap-2">
          <Button size="sm" variant={overdueOnly ? "outline" : "default"} onClick={() => setOverdueOnly(false)}>All</Button>
          <Button size="sm" variant={overdueOnly ? "default" : "outline"} onClick={() => setOverdueOnly(true)}>Overdue only</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {overdueOnly ? "Nothing overdue. 🎉" : "No active loans yet — check a book out from the Books page."}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((loan) => {
              const overdue = isOverdue(loan);
              const reservedFor = loan.book ? resByBook.get(loan.book.id) : undefined;
              return (
                <div key={loan.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{loan.book?.title ?? "Untitled"}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {loan.book?.author && <>by {loan.book.author} · </>}
                      {loan.reader?.first_name} {loan.reader?.last_name} ({loan.reader?.membership_number})
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm">Due {format(new Date(loan.due_date), "MMM d, yyyy")}</div>
                    </div>
                    {reservedFor && <Badge variant="outline" className="gap-1"><Bookmark className="size-3" /> Held for {reservedFor}</Badge>}
                    {overdue && <Badge variant="destructive">OVERDUE</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, to, slug }: { label: string; value?: number; icon: any; tone?: "warn"; to: "/$slug/app/books" | "/$slug/app/loans" | "/$slug/app/readers"; slug: string }) {
  return (
    <Link to={to} params={{ slug }}>
      <Card className={"p-5 hover:shadow-md transition-shadow " + (tone === "warn" && value ? "border-destructive/30" : "")}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className={"size-4 " + (tone === "warn" && value ? "text-destructive" : "text-muted-foreground")} />
        </div>
        <div className={"text-3xl font-semibold " + (tone === "warn" && value ? "text-destructive" : "")}>
          {value ?? "—"}
        </div>
      </Card>
    </Link>
  );
}
