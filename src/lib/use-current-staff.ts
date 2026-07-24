import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLibrarySlugFromUrl } from "@/lib/tenant";

export type StaffRole = "owner" | "super_admin" | "admin" | "librarian" | "assistant";

export const STAFF_ROLE_RANK: Record<StaffRole, number> = {
  owner: 5,
  super_admin: 4,
  admin: 3,
  librarian: 2,
  assistant: 1,
};

export const staffRoleLabel = (r: StaffRole): string =>
  r === "owner" ? "Owner"
  : r === "super_admin" ? "Super admin"
  : r === "admin" ? "Admin"
  : r === "librarian" ? "Librarian"
  : "Assistant";

export type CurrentStaff = {
  id: string;
  library_id: string;
  email: string | null;
  full_name: string | null;
  role: StaffRole;
  status: "active" | "invited" | "disabled";
  library_status: "active" | "suspended" | null;
  library_name: string | null;
  library_slug: string | null;
};

export const LAST_LIB_KEY = "lastLibrarySlug";

async function fetchAllStaff(): Promise<CurrentStaff[]> {
  const { data, error } = await supabase.rpc("get_current_staff");
  if (error) throw error;
  return ((data ?? []) as CurrentStaff[]);
}

/** Full list of libraries the signed-in user is staff in. */
export function useAllStaff() {
  return useQuery({
    queryKey: ["current-staff-all"],
    queryFn: fetchAllStaff,
    staleTime: 60_000,
  });
}

/**
 * Backwards-compatible single-row hook. Resolves to the row matching the
 * current URL slug if present, otherwise the only row (when there is just
 * one), otherwise null.
 */
export function useCurrentStaff() {
  const all = useAllStaff();
  const slug = getLibrarySlugFromUrl();
  const list = all.data ?? [];
  const active = (slug && list.find((r) => r.library_slug === slug))
    || (list.length === 1 ? list[0] : null);
  return { ...all, data: active as CurrentStaff | null };
}

export function pickPreferredSlug(rows: CurrentStaff[]): string | null {
  if (rows.length === 0) return null;
  if (typeof window !== "undefined") {
    const last = window.localStorage.getItem(LAST_LIB_KEY);
    if (last && rows.find((r) => r.library_slug === last)) return last;
  }
  return rows[0].library_slug;
}

export function rememberLibrarySlug(slug: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_LIB_KEY, slug);
  }
}

export type Capability =
  | "view" | "circulation" | "manage_reservations"
  | "manage_books" | "manage_readers"
  | "delete_books" | "delete_readers"
  | "request_deletion" | "approve_deletions"
  | "manage_settings" | "manage_branding" | "manage_emails"
  | "manage_staff" | "manage_admins" | "manage_super_admins"
  | "manage_billing" | "manage_slug" | "delete_library";

const ALL: StaffRole[] = ["owner", "super_admin", "admin", "librarian", "assistant"];
const ADMIN_UP: StaffRole[] = ["owner", "super_admin", "admin"];
const LIBRARIAN_UP: StaffRole[] = ["owner", "super_admin", "admin", "librarian"];

const MATRIX: Record<Capability, StaffRole[]> = {
  view: ALL,
  circulation: ALL,
  manage_reservations: ALL,
  manage_books: ALL,
  manage_readers: ALL,
  request_deletion: ALL,
  delete_books: LIBRARIAN_UP,
  delete_readers: LIBRARIAN_UP,
  approve_deletions: LIBRARIAN_UP,
  manage_settings: ADMIN_UP,
  manage_branding: ADMIN_UP,
  manage_emails: ADMIN_UP,
  manage_staff: ADMIN_UP,
  manage_admins: ["owner", "super_admin"],
  manage_super_admins: ["owner"],
  manage_billing: ["owner"],
  manage_slug: ["owner"],
  delete_library: ["owner"],
};

export function roleCan(role: StaffRole | undefined | null, cap: Capability): boolean {
  if (!role) return false;
  return MATRIX[cap].includes(role);
}

/** Roles the given actor is allowed to assign/manage. */
export function assignableRoles(actor: StaffRole | undefined | null): StaffRole[] {
  if (!actor) return [];
  const rank = STAFF_ROLE_RANK[actor];
  const out: StaffRole[] = [];
  if (rank > STAFF_ROLE_RANK.super_admin) out.push("super_admin");
  if (rank > STAFF_ROLE_RANK.admin) out.push("admin");
  if (rank > STAFF_ROLE_RANK.librarian) out.push("librarian");
  if (rank > STAFF_ROLE_RANK.assistant) out.push("assistant");
  return out;
}
