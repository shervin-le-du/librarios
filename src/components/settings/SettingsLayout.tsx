import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type SettingsItem = { id: string; label: string; icon: LucideIcon };
export type SettingsGroup = { id: string; label: string; items: SettingsItem[] };

export function SettingsLayout({
  title = "Settings",
  groups,
  children,
}: {
  title?: string;
  groups: SettingsGroup[];
  children: ReactNode;
}) {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-1">Your profile and the things you can configure.</p>
      </div>

      <div className="grid md:grid-cols-[220px,1fr] gap-10">
        <aside className="hidden md:block">
          <nav className="sticky top-6 space-y-6 text-sm">
            {groups.map((g) => (
              <div key={g.id} className="space-y-1">
                <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {g.label}
                </div>
                <ul className="space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <li key={it.id}>
                        <a
                          href={`#${it.id}`}
                          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{it.label}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="space-y-14 min-w-0">{children}</div>
      </div>
    </div>
  );
}
