import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

function useSignedAvatar(path: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar-signed", path],
    enabled: !!path,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("user-avatars").createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function useAuthUser() {
  const [state, setState] = useState<{
    userId: string | null; email: string; fullName: string; avatarPath: string | null;
  }>({ userId: null, email: "", fullName: "", avatarPath: null });
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setState({
        userId: u.id,
        email: u.email ?? "",
        fullName: (u.user_metadata?.full_name as string | undefined) ?? "",
        avatarPath: (u.user_metadata?.avatar_path as string | undefined) ?? null,
      });
    });
  }, []);
  return [state, setState] as const;
}

export function ProfileSection() {
  const qc = useQueryClient();
  const [user, setUser] = useAuthUser();
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = useSignedAvatar(user.avatarPath);

  useEffect(() => { setFullName(user.fullName); }, [user.fullName]);

  async function saveName() {
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["current-staff-all"] });
      toast.success("Profile updated");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingName(false); }
  }

  async function onUpload(file: File) {
    if (!user.userId) return;
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("user-avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    if (user.avatarPath && user.avatarPath !== path) {
      await supabase.storage.from("user-avatars").remove([user.avatarPath]);
    }
    const { error } = await supabase.auth.updateUser({ data: { avatar_path: path } });
    if (error) { toast.error(error.message); return; }
    setUser((s) => ({ ...s, avatarPath: path }));
    qc.invalidateQueries({ queryKey: ["avatar-signed"] });
    toast.success("Photo updated");
  }

  async function removeAvatar() {
    if (!user.avatarPath) return;
    await supabase.storage.from("user-avatars").remove([user.avatarPath]);
    await supabase.auth.updateUser({ data: { avatar_path: null } });
    setUser((s) => ({ ...s, avatarPath: null }));
    toast.success("Photo removed");
  }

  return (
    <section id="profile" className="space-y-6 scroll-mt-20">
      <div>
        <h2 className="text-2xl font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Your name and photo.</p>
      </div>

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-4">Photo</h3>
        <div className="flex items-center gap-5">
          <div className="size-20 rounded-full border bg-muted overflow-hidden flex items-center justify-center">
            {avatar.data ? (
              <img src={avatar.data} alt="Avatar" className="object-cover w-full h-full" />
            ) : (
              <UserIcon className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Upload photo
            </Button>
            {user.avatarPath && (
              <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>
                <X className="size-4" /> Remove
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold">Identity</h3>
        <div className="space-y-1.5">
          <Label htmlFor="prof-email">Email</Label>
          <Input id="prof-email" value={user.email} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prof-name">Full name</Label>
          <Input id="prof-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={saveName} disabled={savingName}>{savingName ? "Saving…" : "Save"}</Button>
        </div>
      </Card>
    </section>
  );
}

export function SecuritySection() {
  const [user] = useAuthUser();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPwd !== confirmPwd) { toast.error("Passwords don't match"); return; }
    setSavingPwd(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd });
      if (signErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      toast.success("Password changed");
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingPwd(false); }
  }

  return (
    <section id="security" className="space-y-6 scroll-mt-20">
      <div>
        <h2 className="text-2xl font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground mt-1">Change your password.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={changePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pwd-current">Current password</Label>
            <Input id="pwd-current" type="password" required value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pwd-new">New password</Label>
              <Input id="pwd-new" type="password" minLength={6} required value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-confirm">Confirm new password</Label>
              <Input id="pwd-confirm" type="password" minLength={6} required value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPwd}>{savingPwd ? "Updating…" : "Update password"}</Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
