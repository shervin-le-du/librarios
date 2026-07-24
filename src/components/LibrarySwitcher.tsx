import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useAllStaff, rememberLibrarySlug } from "@/lib/use-current-staff";

/**
 * Library switcher for staff in 2+ libraries. Hidden otherwise.
 * Navigates to /{slug} (the library's public home) on selection.
 */
export function LibrarySwitcher({ currentSlug, align = "end" }: { currentSlug?: string | null; align?: "start" | "end" }) {
  const all = useAllStaff();
  const navigate = useNavigate();
  const rows = all.data ?? [];
  if (rows.length < 2) return null;

  const current = rows.find((r) => r.library_slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[14rem]">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{current?.library_name ?? "Switch library"}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel>Your libraries</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {rows.map((r) => {
          const isCurrent = r.library_slug === currentSlug;
          return (
            <DropdownMenuItem
              key={r.library_id}
              onSelect={() => {
                if (!r.library_slug || isCurrent) return;
                rememberLibrarySlug(r.library_slug);
                navigate({ to: "/$slug", params: { slug: r.library_slug } });
              }}
              className="flex items-start gap-2 py-2"
            >
              <span className="mt-0.5 size-4 flex items-center justify-center">
                {isCurrent && <Check className="size-3.5 text-primary" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{r.library_name}</span>
                  <Badge variant="outline" className="capitalize text-[10px] py-0">{r.role}</Badge>
                </div>
                {r.library_slug && (
                  <div className="text-xs text-muted-foreground font-mono truncate">/{r.library_slug}</div>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Anchor variant for use outside a TanStack <Link> ecosystem (e.g. plain <a>). */
export function LibrarySwitcherLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <Link to="/$slug" params={{ slug }} onClick={() => rememberLibrarySlug(slug)}>
      {children}
    </Link>
  );
}
