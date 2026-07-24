import { createFileRoute, Outlet, notFound, Link } from "@tanstack/react-router";
import { fetchLibraryBySlug } from "@/lib/use-tenant-library";
import { useApplyBranding, type LibraryBranding } from "@/lib/branding";
import { Library as LibraryIcon } from "lucide-react";

// Tenant wrapper. PUBLIC — no auth gate here.
// - `/{slug}`         → public home page (src/routes/$slug/index.tsx)
// - `/{slug}/login`   → redirects into the staff app sign-in
// - `/{slug}/app/...` → staff app (gated in src/routes/$slug/app/route.tsx)
// - `/{slug}/account` → RESERVED for the member area (Prompt 2). Do not use.

export const Route = createFileRoute("/$slug")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const lib = await fetchLibraryBySlug(params.slug);
    if (!lib) throw notFound();
    return { tenantLibrary: lib };
  },
  notFoundComponent: NotFoundLibrary,
  component: TenantWrapper,
});

function TenantWrapper() {
  const { tenantLibrary } = Route.useRouteContext();
  const branding = ((tenantLibrary as any).branding as LibraryBranding | null) ?? null;
  useApplyBranding(branding, tenantLibrary.brand_color);
  return <Outlet />;
}


function NotFoundLibrary() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md text-center">
        <div className="size-12 mx-auto rounded-md bg-muted flex items-center justify-center mb-4">
          <LibraryIcon className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold">Library not found</h1>
        <p className="text-muted-foreground mt-2">
          No library exists at this URL. Check the link or go to the home page.
        </p>
        <Link to="/" className="inline-flex mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
          Go home
        </Link>
      </div>
    </div>
  );
}
