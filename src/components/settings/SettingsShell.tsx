import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ShellItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active: boolean;
};
export type ShellGroup = { id: string; label: string; items: ShellItem[] };

export function SettingsShell({
  title = "Settings",
  subtitle,
  groups,
  children,
}: {
  title?: string;
  subtitle?: string;
  groups: ShellGroup[];
  children: ReactNode;
}) {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
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
                        <button
                          type="button"
                          onClick={it.onClick}
                          className={
                            "w-full flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors text-left " +
                            (it.active
                              ? "bg-muted text-foreground font-medium"
                              : "text-foreground/80 hover:bg-muted hover:text-foreground")
                          }
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{it.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
