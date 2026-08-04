import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, LogOut, User as UserIcon } from "lucide-react";

function initials(name: string, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function UserBubble({
  slug,
  onSignOut,
  align = "start",
  settingsHref,
  role,
}: {
  slug?: string;
  onSignOut: () => void;
  align?: "start" | "center" | "end";
  settingsHref?: string;
  role?: string;
}) {
  const [user, setUser] = useState<{ email: string; fullName: string; avatarPath: string | null }>({
    email: "", fullName: "", avatarPath: null,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setUser({
        email: u.email ?? "",
        fullName: (u.user_metadata?.full_name as string | undefined) ?? "",
        avatarPath: (u.user_metadata?.avatar_path as string | undefined) ?? null,
      });
    });
  }, []);

  const avatar = useQuery({
    queryKey: ["avatar-signed", user.avatarPath],
    enabled: !!user.avatarPath,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("user-avatars").createSignedUrl(user.avatarPath!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  const label = user.fullName || user.email || "Account";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-3 rounded-md px-2 py-2 hover:bg-sidebar-accent transition-colors text-left"
          aria-label="Open account menu"
        >
          <div className="size-9 rounded-full bg-muted border overflow-hidden flex items-center justify-center text-xs font-medium shrink-0">
            {avatar.data ? (
              <img src={avatar.data} alt="" className="w-full h-full object-cover" />
            ) : user.email ? (
              <span>{initials(user.fullName, user.email)}</span>
            ) : (
              <UserIcon className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate leading-tight">{label}</div>
            {role && (
              <Badge
                variant="outline"
                className="capitalize shrink-0 px-1.5 py-0 text-[10px] font-medium leading-4 h-4 w-fit"
              >
                {role}
              </Badge>
            )}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} side="top" className="w-64 p-2">
        <div className="px-2 py-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signed in as</div>
          <div className="text-sm truncate">{user.email}</div>
        </div>
        <div className="h-px bg-border my-1" />
        {settingsHref ? (
          <a
            href={settingsHref}
            className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
          >
            <Settings className="size-4" /> Settings
          </a>
        ) : slug ? (
          <Link
            to="/$slug/app/settings"
            params={{ slug }}
            className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
          >
            <Settings className="size-4" /> Settings
          </Link>
        ) : (
          <Link
            to="/platform/settings"
            className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
          >
            <Settings className="size-4" /> Settings
          </Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 py-2 h-auto font-normal"
          onClick={onSignOut}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
