import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Library, Users, BookOpen, BookMarked, Clock, AlertTriangle, BookmarkCheck, LifeBuoy,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Totals = {
  libraries_total: number; libraries_active: number; libraries_suspended: number;
  staff_total: number; readers_total: number; books_total: number;
  loans_active: number; loans_overdue: number;
  reservations_active: number; support_sessions_active: number;
};
type GrowthPoint = { day: string; new_libraries: number };
type ActivityRow = {
  id: string; created_at: string; actor_id: string | null; actor_type: string | null;
  action: string; library_id: string | null; library_name: string | null; detail: any;
};
type TopLib = {
  id: string; name: string; subdomain: string; status: "active" | "suspended";
  book_count: number; reader_count: number; staff_count: number;
};
type Overview = {
  totals: Totals; growth_30d: GrowthPoint[];
  recent_activity: ActivityRow[]; top_libraries: TopLib[];
};

function KPI({
  label, value, icon: Icon, sub,
}: { label: string; value: number | string; icon: any; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
        <Icon className="size-4 text-muted-foreground" />
      </div>
    </Card>
  );
}

export function PlatformOverview() {
  const q = useQuery({
    queryKey: ["platform-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_overview");
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading overview…</div>;
  if (q.error) return <div className="text-sm text-destructive">{(q.error as Error).message}</div>;
  if (!q.data) return null;

  const { totals, growth_30d, recent_activity, top_libraries } = q.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KPI label="Libraries" value={totals.libraries_total} icon={Library}
          sub={`${totals.libraries_active} active · ${totals.libraries_suspended} suspended`} />
        <KPI label="Staff users" value={totals.staff_total} icon={Users} />
        <KPI label="Readers" value={totals.readers_total} icon={Users} />
        <KPI label="Books" value={totals.books_total} icon={BookOpen} />
        <KPI label="Active loans" value={totals.loans_active} icon={BookMarked} />
        <KPI label="Overdue loans" value={totals.loans_overdue} icon={AlertTriangle} />
        <KPI label="Active holds" value={totals.reservations_active} icon={BookmarkCheck} />
        <KPI label="Support sessions" value={totals.support_sessions_active} icon={LifeBuoy} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">New libraries — last 30 days</h3>
            <span className="text-xs text-muted-foreground">
              {growth_30d.reduce((s, p) => s + p.new_libraries, 0)} total
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growth_30d} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                  fontSize={10}
                  interval={4}
                />
                <YAxis allowDecimals={false} fontSize={10} />
                <Tooltip
                  labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
                  contentStyle={{ fontSize: "12px" }}
                />
                <Bar dataKey="new_libraries" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Library className="size-4" /> Largest libraries
          </h3>
          {top_libraries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No libraries yet.</p>
          ) : (
            <ul className="divide-y">
              {top_libraries.map((l) => (
                <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                  <Link
                    to="/$slug"
                    params={{ slug: l.subdomain }}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <div className="font-medium truncate text-sm">{l.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">/{l.subdomain}</div>
                  </Link>
                  <div className="text-right text-xs text-muted-foreground tabular-nums">
                    <div>{l.book_count} books</div>
                    <div>{l.reader_count} readers</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Clock className="size-4" /> Recent activity
        </h3>
        {recent_activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="divide-y">
            {recent_activity.map((a) => (
              <li key={a.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-[10px]">{a.action}</Badge>
                    {a.library_name && (
                      <span className="text-muted-foreground truncate">{a.library_name}</span>
                    )}
                  </div>
                  {a.actor_type && (
                    <div className="text-xs text-muted-foreground mt-0.5">by {a.actor_type}</div>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
