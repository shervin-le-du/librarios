// Tenant URL identity — single resolver.
// Flip ROUTING_MODE to 'subdomain' to address libraries as `slug.host` instead of `/slug/...`.
// All other code MUST consume the slug via getLibrarySlugFromUrl().

export type RoutingMode = "path" | "subdomain";
export const ROUTING_MODE: RoutingMode = "path";

export const RESERVED_SLUGS = [
  "www", "app", "api", "admin", "mail", "static", "assets",
  "auth", "login", "signup", "dashboard", "support",
  "onboarding", "accept-invite",
];

const PLATFORM_HOSTS = new Set(["www", "app", "apex"]);

/**
 * Returns the current library slug from the URL, or null when we're on the
 * platform context (apex / signup / onboarding / etc).
 *
 * - path mode:      first path segment, ignoring known platform paths
 * - subdomain mode: first hostname label, ignoring www/app/apex
 */
export function getLibrarySlugFromUrl(opts?: { pathname?: string; hostname?: string }): string | null {
  const pathname = opts?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const hostname = opts?.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");

  if (ROUTING_MODE === "subdomain") {
    const labels = hostname.split(".");
    const first = labels[0]?.toLowerCase();
    if (!first || PLATFORM_HOSTS.has(first) || labels.length < 3) return null;
    return isValidSlug(first) ? first : null;
  }

  // path mode
  const seg = pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase();
  if (!seg) return null;
  if (RESERVED_SLUGS.includes(seg)) return null;
  return isValidSlug(seg) ? seg : null;
}

export function slugify(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/^-+|-+$/g, "");
}

export function isValidSlug(s: string): boolean {
  if (!s) return false;
  if (s.length < 3 || s.length > 30) return false;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s)) return false;
  return true;
}

export function validateSlug(s: string): string | null {
  if (!s) return "Slug is required.";
  if (s.length < 3 || s.length > 30) return "Must be 3–30 characters.";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s))
    return "Only lowercase letters, numbers, and hyphens (no leading/trailing hyphen).";
  if (RESERVED_SLUGS.includes(s)) return "That word is reserved.";
  return null;
}
