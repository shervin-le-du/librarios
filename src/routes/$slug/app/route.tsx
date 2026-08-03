import {
  createFileRoute, Outlet, Link, useRouter, useRouterState, useNavigate, useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { type TenantLibrary } from "@/lib/use-tenant-library";
import { useSignedLogo } from "@/lib/use-current-library";
import { useCurrentStaff, useAllStaff, roleCan, type StaffRole } from "@/lib/use-current-staff";
import { useActiveSupportSession } from "@/lib/use-platform";
import { LibrarySwitcher } from "@/components/LibrarySwitcher";
import { PublishButton } from "@/components/publish/PublishButton";
import { UserBubble } from "@/components/UserBubble";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, LayoutDashboard, Library as LibraryIcon, Users,
  ArrowLeftRight, LifeBuoy, AlertTriangle, ArrowLeft,
} from "lucide-react";
import { DynamicIcon, type IconName } from "@/lib/dynamic-icon";
import type { LibraryBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

import {
  useSettingsGroups,
  isSettingsSection,
  type SettingsSection,
} from "@/components/settings/UnifiedSettings";


import { toast } from "sonner";

export const Route = createFileRoute("/$slug/app")({
  ssr: false,
  component: StaffShell,
});

const baseNav = [
  { to: "/$slug/app/dashboard", label: "Dashboard", icon: LayoutDashboard, cap: "view" as const },
  { to: "/$slug/app/books", label: "Books", icon: LibraryIcon, cap: "view" as const },
  { to: "/$slug/app/readers", label: "Readers", icon: Users, cap: "view" as const },
  { to: "/$slug/app/loans", label: "Loans", icon: ArrowLeftRight, cap: "circulation" as const },
] as const;

function LogoMark({
  logoUrl,
  branding,
  className,
  iconClassName,
  fallbackClassName,
}: {
  logoUrl: string | null;
  branding: LibraryBranding | null | undefined;
  className: string;
  iconClassName: string;
  fallbackClassName: string;
}) {
  const iconName = (branding?.logo_icon_name ?? branding?.icon_name ?? null) as IconName | null;
  const iconColor = branding?.logo_icon_color ?? branding?.icon_color ?? undefined;
  const hasVisual = !!logoUrl || !!iconName;
  return (
    <div className={cn(className, hasVisual ? "bg-transparent" : "bg-primary text-primary-foreground")}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className="w-full h-full object-cover" />
      ) : iconName ? (
        <DynamicIcon name={iconName} className={iconClassName} style={{ color: iconColor }} />
      ) : (
        <BookOpen className={fallbackClassName} />
      )}
    </div>
  );
}




function StaffShell() {
  // tenantLibrary comes from the parent /$slug route's beforeLoad
  const ctx = Route.useRouteContext() as unknown as { tenantLibrary: TenantLibrary };
  const tenantLibrary = ctx.tenantLibrary;
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<null | { userId: string } | "loading">("loading");
  const logo = useSignedLogo(tenantLibrary.logo_url);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ? { userId: data.session.user.id } : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ? { userId: s.user.id } : null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (session === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!session) return <BrandedSignIn library={tenantLibrary} logoUrl={logo.data ?? null} slug={slug} />;

  return (
    <AuthedTenant
      library={tenantLibrary}
      slug={slug}
      logoUrl={logo.data ?? null}
      onSignOut={async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      }}
    />
  );
}

function BrandedSignIn({ library, logoUrl, slug }: { library: TenantLibrary; logoUrl: string | null; slug: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message ?? "Could not sign in");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Link to="/$slug" params={{ slug }} className="block">
            <LogoMark
              logoUrl={logoUrl}
              branding={(library.branding as LibraryBranding | null) ?? null}
              className="size-14 rounded-md flex items-center justify-center overflow-hidden"
              iconClassName="size-8"
              fallbackClassName="size-7"
            />
          </Link>

          <h1 className="text-2xl font-semibold text-center">{library.name}</h1>
          <p className="text-xs text-muted-foreground">Staff sign-in · on LibrariOS</p>
        </div>
        <Card className="p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-6">Staff sign-in for {library.name}.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Please wait…" : "Sign in"}</Button>
          </form>
          <p className="text-xs text-muted-foreground mt-6 text-center">
            <Link to="/$slug" params={{ slug }} className="hover:underline">← Back to {library.name}</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

function AuthedTenant({ library, slug, logoUrl, onSignOut }: {
  library: TenantLibrary; slug: string; logoUrl: string | null; onSignOut: () => void;
}) {
  const me = useCurrentStaff();
  const all = useAllStaff();
  const support = useActiveSupportSession();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const settingsBasePath = `/${slug}/app/settings`;
  const inSettings = path === settingsBasePath || path.startsWith(`${settingsBasePath}/`);
  const rawSearch = useSearch({ strict: false }) as { section?: unknown };
  const activeSection: SettingsSection =
    inSettings && isSettingsSection(rawSearch.section) ? rawSearch.section : "profile";
  const { groups: settingsGroups } = useSettingsGroups({
    slug,
    section: activeSection,
    onSectionChange: (id) =>
      navigate({ to: "/$slug/app/settings", params: { slug }, search: { section: id }, replace: true }),
  });

  const isSupport = !!support.data && support.data.library_id === library.id;
  const qc = useQueryClient();
  const startingRef = useRef(false);
  const [autoStartFailed, setAutoStartFailed] = useState(false);

  useEffect(() => {
    if (me.isLoading || support.isLoading || all.isLoading) return;
    if (isSupport) return;

    // Platform admin signing into a branded page → auto-start a support session
    // for this library, unless they also happen to be staff here (rare but fine).
    (async () => {
      if (me.data && me.data.library_id === library.id) return; // real staff of this library
      if (startingRef.current) return;

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data: pa } = await supabase
        .from("platform_admins").select("id").eq("id", uid).maybeSingle();

      if (pa) {
        startingRef.current = true;
        // End any stale session pointing at a different library, then start ours.
        if (support.data && support.data.library_id !== library.id) {
          await supabase.rpc("end_support_session");
        }
        const { error } = await supabase.rpc("start_support_session", {
          p_library_id: library.id,
          p_reason: "Sign-in via branded page",
        });
        if (error) {
          setAutoStartFailed(true);
          toast.error(error.message ?? "Could not start support session");
          startingRef.current = false;
          return;
        }
        await qc.invalidateQueries({ queryKey: ["active-support-session"] });
        return;
      }

      // Not a platform admin and not staff here → look for another library
      // they belong to and send them there; only fall back to onboarding when
      // they truly have no staff row anywhere.
      const otherRow = (all.data ?? []).find((r) => r.library_slug && r.library_slug !== slug);
      if (me.data?.status === "disabled") {
        toast.error("Your access has been revoked");
        supabase.auth.signOut().then(() => router.navigate({ to: "/auth", replace: true }));
        return;
      }
      if (me.data?.library_status === "suspended") {
        toast.error("This library is suspended. Contact support.");
        supabase.auth.signOut().then(() => router.navigate({ to: "/auth", replace: true }));
        return;
      }
      if (otherRow?.library_slug) {
        toast.error(`You don't belong to ${library.name}. Redirecting to your library…`);
        router.navigate({
          to: "/$slug/app/dashboard",
          params: { slug: otherRow.library_slug },
          replace: true,
        });
        return;
      }
      router.navigate({ to: "/onboarding", replace: true });
    })();
  }, [me.data, me.isLoading, all.data, support.data, support.isLoading, isSupport, library.id, library.name, slug, router, qc]);

  if (me.isLoading || support.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isSupport && (!me.data || me.data.library_id !== library.id || me.data.library_status === "suspended")) {
    if (autoStartFailed) {
      return (
        <div className="min-h-screen flex items-center justify-center text-muted-foreground px-4 text-center">
          Could not open this library. Try again from the platform.
        </div>
      );
    }
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const effectiveRole: StaffRole = isSupport ? "admin" : (me.data!.role as StaffRole);
  
  const nav = baseNav.filter((n) => roleCan(effectiveRole, n.cap));

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <Link to="/$slug" params={{ slug }} className="px-5 py-6 flex items-center gap-2.5 border-b border-sidebar-border hover:bg-sidebar-accent/40 transition-colors">
          <LogoMark
            logoUrl={logoUrl}
            branding={(library.branding as LibraryBranding | null) ?? null}
            className="size-9 rounded-md flex items-center justify-center overflow-hidden"
            iconClassName="size-6"
            fallbackClassName="size-4.5"
          />

          <div className="min-w-0">
            <div className="font-semibold leading-none truncate">{library.name}</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono truncate">/{slug}</div>
          </div>
        </Link>
        {inSettings ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <Link
              to="/$slug/app/dashboard"
              params={{ slug }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              <ArrowLeft className="size-4" /> Admin
            </Link>
            {settingsGroups.map((group) => (
              <div key={group.id} className="space-y-1">
                <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onClick}
                        className={
                          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-left transition-colors " +
                          (item.active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "hover:bg-sidebar-accent text-sidebar-foreground")
                        }
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <nav className="flex-1 p-3 space-y-0.5">
            {nav.map((item) => {
              const resolved = item.to.replace("$slug", slug);
              const active = path === resolved || (item.to !== "/$slug/app/dashboard" && path.startsWith(resolved));
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} params={{ slug }}
                  className={"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                    (active ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "hover:bg-sidebar-accent text-sidebar-foreground")}>
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-1">
            <LibrarySwitcher currentSlug={slug} align="start" />
          </div>
          <div className="px-3 pt-1 pb-1 text-xs text-muted-foreground flex items-center justify-between">
            <span className="truncate">{isSupport ? "Support (platform)" : ""}</span>
            <Badge variant="outline" className="capitalize ml-2">{effectiveRole}</Badge>
          </div>
          <UserBubble slug={slug} onSignOut={onSignOut} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {isSupport && <SupportBanner />}
        {!isSupport && me.data?.library_status === "suspended" && (
          <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm flex items-center gap-2">
            <AlertTriangle className="size-4" /> This library is suspended.
          </div>
        )}
        <header className="md:hidden border-b px-4 h-14 flex items-center justify-between bg-sidebar">
          <Link to="/$slug" params={{ slug }} className="flex items-center gap-2 min-w-0">
            <LogoMark
              logoUrl={logoUrl}
              branding={(library.branding as LibraryBranding | null) ?? null}
              className="size-7 rounded flex items-center justify-center overflow-hidden"
              iconClassName="size-5"
              fallbackClassName="size-4"
            />

            <span className="font-semibold truncate">{library.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{effectiveRole}</Badge>
            <UserBubble slug={slug} onSignOut={onSignOut} align="end" />
          </div>
        </header>

        {inSettings ? (
          <nav className="md:hidden flex border-b bg-sidebar overflow-x-auto">
            <Link
              to="/$slug/app/dashboard"
              params={{ slug }}
              className="px-4 py-2.5 text-sm whitespace-nowrap text-muted-foreground flex items-center gap-1"
            >
              <ArrowLeft className="size-3.5" /> Admin
            </Link>
            {settingsGroups.flatMap((g) => g.items).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={
                  "px-4 py-2.5 text-sm whitespace-nowrap " +
                  (item.active ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground")
                }
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : (
          <nav className="md:hidden flex border-b bg-sidebar overflow-x-auto">
            {nav.map((item) => {
              const resolved = item.to.replace("$slug", slug);
              const active = path === resolved || (item.to !== "/$slug/app/dashboard" && path.startsWith(resolved));
              return (
                <Link key={item.to} to={item.to} params={{ slug }}
                  className={"px-4 py-2.5 text-sm whitespace-nowrap " + (active ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground")}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        {roleCan(effectiveRole, "manage_settings") && (
          <PublishButton slug={slug} variant="overlay" />
        )}
      </div>
    </div>
  );
}

function SupportBanner() {
  const router = useRouter();
  const qc = useQueryClient();
  async function endSession() {
    await supabase.rpc("end_support_session");
    qc.invalidateQueries({ queryKey: ["active-support-session"] });
    router.navigate({ to: "/platform", replace: true });
  }
  return (
    <div className="bg-warning/15 border-b border-warning/30 text-warning-foreground px-4 py-2 text-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-4" />
        <span>Support session active — you're acting as a platform admin.</span>
      </div>
      <Button size="sm" variant="outline" onClick={endSession}>End session</Button>
    </div>
  );
}
