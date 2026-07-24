import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sb, type Reader } from "@/lib/librarian";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeletionRequestDialog } from "@/components/deletion/DeletionRequestDialog";
import { DeletionRequestsCard } from "@/components/deletion/DeletionRequestsCard";
import { EmailSettingsEditor } from "@/components/email/EmailSettingsEditor";
import { useCurrentStaff, roleCan } from "@/lib/use-current-staff";


export const Route = createFileRoute("/$slug/app/readers")({
  head: () => ({ meta: [{ title: "Readers — LibrariOS" }] }),
  component: ReadersPage,
});

function ReadersPage() {
  const { slug } = Route.useParams();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Reader | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteReader, setDeleteReader] = useState<Reader | null>(null);
  const [openEmailConfig, setOpenEmailConfig] = useState(false);
  const staff = useCurrentStaff();
  const canManageEmails = roleCan(staff.data?.role, "manage_emails");



  const readers = useQuery({
    queryKey: ["readers"],
    queryFn: async () => {
      const { data, error } = await sb.from("readers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Reader[];
    },
  });

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return (readers.data ?? []).filter((r) =>
      !t ||
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(t) ||
      r.membership_number.toLowerCase().includes(t) ||
      (r.email ?? "").toLowerCase().includes(t) ||
      (r.phone ?? "").toLowerCase().includes(t)
    );
  }, [readers.data, q]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">Readers</h1>
          <p className="text-muted-foreground mt-1">{readers.data?.length ?? 0} member{readers.data?.length === 1 ? "" : "s"}.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageEmails && (
            <Button variant="outline" onClick={() => setOpenEmailConfig(true)} className="gap-2">
              <Settings2 className="size-4" /> Configure invitation email
            </Button>
          )}
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Register reader
          </Button>
        </div>
      </div>


      <Input placeholder="Search by name, membership #, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md mb-4" />

      <DeletionRequestsCard entityType="reader" />

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {readers.data?.length === 0 ? "No readers yet — register your first member." : "No matches."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr><Th>Name</Th><Th>Membership #</Th><Th>Email</Th><Th>Phone</Th><Th>Status</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <Td className="font-medium">
                    <Link to="/$slug/app/readers/$id" params={{ slug, id: r.id }} className="hover:underline">
                      {r.first_name} {r.last_name}
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs">{r.membership_number}</Td>
                  <Td className="text-muted-foreground">{r.email ?? "—"}</Td>
                  <Td className="text-muted-foreground">{r.phone ?? "—"}</Td>
                  <Td>{r.status === "active" ? <Badge variant="secondary">Active</Badge> : <Badge variant="destructive">Suspended</Badge>}</Td>
                  <Td className="text-right pr-2">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive"
                        onClick={() => setDeleteReader(r)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ReaderFormDialog open={open} onOpenChange={setOpen} editing={editing} />
      <EmailSettingsEditor
        open={openEmailConfig}
        onOpenChange={setOpenEmailConfig}
        templateKey="member-invite"
        scope="library"
        libraryId={staff.data?.library_id}
      />

      {deleteReader && (
        <DeletionRequestDialog
          open={!!deleteReader}
          onOpenChange={(o) => { if (!o) setDeleteReader(null); }}
          entityType="reader"
          entityId={deleteReader.id}
          entityLabel={`${deleteReader.first_name} ${deleteReader.last_name}`}
        />
      )}
    </div>
  );
}

function Th({ children }: any) { return <th className="py-3 px-4 font-medium text-muted-foreground">{children}</th>; }
function Td({ children, className = "" }: any) { return <td className={"py-3 px-4 " + className}>{children}</td>; }

type FormState = Partial<Reader> & { first_name: string; last_name: string };

function ReaderFormDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (b: boolean) => void; editing: Reader | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({ first_name: "", last_name: "" });

  useEffect(() => {
    if (open) setForm(editing ?? { first_name: "", last_name: "", email: "", phone: "", address: "", id_document_type: "", id_document_number: "", status: "active" });
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name?.trim() || !form.last_name?.trim()) throw new Error("First and last name are required");
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        id_document_type: form.id_document_type || null,
        id_document_number: form.id_document_number || null,
        status: form.status ?? "active",
      };
      if (editing) {
        const { error } = await sb.from("readers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: lib, error: le } = await sb.from("libraries").select("id").limit(1).single();
        if (le) throw le;
        const { error } = await sb.from("readers").insert({ ...payload, library_id: lib.id, membership_number: "" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Reader updated" : "Reader registered");
      qc.invalidateQueries({ queryKey: ["readers"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit reader" : "Register reader"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name *"><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></Field>
            <Field label="Last name *"><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Address"><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID document type">
              <Select value={form.id_document_type ?? ""} onValueChange={(v) => setForm({ ...form, id_document_type: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="driver_license">Driver license</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="ID document number"><Input value={form.id_document_number ?? ""} onChange={(e) => setForm({ ...form, id_document_number: e.target.value })} /></Field>
          </div>
          {editing && (
            <Field label="Status">
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save" : "Register"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
