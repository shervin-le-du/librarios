import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { pickPreferredSlug, rememberLibrarySlug, type CurrentStaff } from "@/lib/use-current-staff";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — LibrariOS" }] }),
  component: AuthPage,
});

async function fetchStaff(): Promise<CurrentStaff[]> {
  const { data } = await supabase.rpc("get_current_staff");
  return ((data ?? []) as CurrentStaff[]);
}

async function redirectToUserHome(navigate: ReturnType<typeof useNavigate>) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (uid) {
    const { data: pa } = await supabase
      .from("platform_admins").select("id").eq("id", uid).maybeSingle();
    if (pa) { navigate({ to: "/platform", replace: true }); return; }
  }
  let rows = await fetchStaff();
  // Retry once — session/RLS can lag briefly right after signInWithPassword.
  if (rows.length === 0) {
    await new Promise((r) => setTimeout(r, 400));
    rows = await fetchStaff();
  }
  if (rows.length === 0) { navigate({ to: "/onboarding", replace: true }); return; }
  const slug = pickPreferredSlug(rows);
  if (slug) {
    rememberLibrarySlug(slug);
    navigate({ to: "/$slug/app/dashboard", params: { slug }, replace: true });
  } else navigate({ to: "/onboarding", replace: true });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectToUserHome(navigate);
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        } else {
          toast.success("Welcome to LibrariOS");
          navigate({ to: "/onboarding", replace: true });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await redirectToUserHome(navigate);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="size-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-none">LibrariOS</h1>
            <p className="text-xs text-muted-foreground mt-1">Calm library management</p>
          </div>
        </div>

        <Card className="p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Sign in to manage your library." : "You'll set up your library next."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary font-medium hover:underline">
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/" className="hover:underline">← Back home</Link>
        </p>
      </div>
    </div>
  );
}
