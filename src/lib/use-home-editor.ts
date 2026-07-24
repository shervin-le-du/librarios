import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HomePageConfig } from "@/lib/use-current-library";
import { toast } from "sonner";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useHomeEditor(libraryId: string | undefined, initial: HomePageConfig | null | undefined) {
  const qc = useQueryClient();
  const currentRef = useRef<HomePageConfig>({ ...(initial ?? {}) });
  // Sync ref when server data changes (initial only diverges on first mount usually).
  const syncedRef = useRef(false);
  if (!syncedRef.current && initial) {
    currentRef.current = { ...initial };
    syncedRef.current = true;
  }

  const [state, setState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);

  const flush = useCallback(async () => {
    if (!libraryId) return;
    const snapshot = { ...currentRef.current };
    setState("saving");
    try {
      const { error } = await supabase
        .from("libraries")
        .update({ home_page_config: snapshot })
        .eq("id", libraryId);
      if (error) throw error;
      setState("saved");
      qc.invalidateQueries({ queryKey: ["current-library"] });
      qc.invalidateQueries({ queryKey: ["public-home"] });
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1600);
    } catch (e: any) {
      setState("error");
      toast.error(e?.message ?? "Could not save");
    }
  }, [libraryId, qc]);

  const save = useCallback(
    (patch: Partial<HomePageConfig>, { debounce = 500 }: { debounce?: number } = {}) => {
      currentRef.current = { ...currentRef.current, ...patch };
      setState("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        inflightRef.current = flush();
      }, debounce);
    },
    [flush],
  );

  return { save, state };
}
