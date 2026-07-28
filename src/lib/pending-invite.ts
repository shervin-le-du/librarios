export type PendingInvite = {
  kind: "staff" | "owner" | "platform";
  token: string;
  libName?: string;
  libSlug?: string;
};

const KEY = "librarios.pending-invite";

// Signing up for an owner invite can require an email confirmation before a
// session exists. Supabase's confirmation link only honours redirect URLs that
// are on the project allow-list, so it may land the user on "/" with the
// invitation token gone. Keeping the token here lets the app send them back to
// the invitation instead of the "create a library from scratch" onboarding.
export function savePendingInvite(invite: PendingInvite) {
  try {
    localStorage.setItem(KEY, JSON.stringify(invite));
  } catch {
    /* storage unavailable — the emailRedirectTo URL is the primary path */
  }
}

export function readPendingInvite(): PendingInvite | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInvite;
    if (!parsed?.token || !["staff", "owner", "platform"].includes(parsed.kind)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
