import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { useAuth } from "../app-context";
import { Badge, Banner, Button, Dialog, EmptyState, Panel, PageHeader, SelectInput, TableSkeleton, TextInput } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export default function Users() {
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.users());
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  async function toggle(id: number, isActive: boolean) {
    setBusyId(id);
    setNotice("");
    try {
      await api.updateUser(id, { isActive });
      await reload();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Registrars and property owners." actions={<Button onClick={() => setOpen(true)}><Plus size={16} weight="bold" aria-hidden /> Add user</Button>} />
      {error && <div className="mb-4"><Banner>{error.message}</Banner></div>}
      {notice && <div className="mb-4"><Banner onClose={() => setNotice("")}>{notice}</Banner></div>}
      <Panel className="overflow-hidden">
        {loading && !data ? (
          <TableSkeleton />
        ) : data && data.length === 0 ? (
          <EmptyState title="No users" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Identifier</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data?.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-muted">(you)</span>}</td>
                    <td className="px-4 py-3 text-muted">{u.email}</td>
                    <td className="px-4 py-3 hash">{u.identifier}</td>
                    <td className="px-4 py-3 capitalize">{u.role}</td>
                    <td className="px-4 py-3"><Badge tone={u.isActive ? "ok" : "neutral"}>{u.isActive ? "Active" : "Deactivated"}</Badge></td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== me?.id && (
                        <Button size="sm" variant={u.isActive ? "danger" : "secondary"} loading={busyId === u.id} onClick={() => toggle(u.id, !u.isActive)}>
                          {u.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <AddUserDialog open={open} onClose={() => setOpen(false)} onDone={reload} />
    </>
  );
}

function AddUserDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const empty = { name: "", email: "", password: "", role: "owner", identifier: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fields = error?.fields ?? {};
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  function close() {
    onClose();
    setForm(empty);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser(form);
      close();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Add user" footer={<><Button variant="secondary" type="button" onClick={close}>Cancel</Button><Button type="submit" form="add-user" loading={busy}>Create user</Button></>}>
      <form id="add-user" onSubmit={submit} className="space-y-4" noValidate>
        {error && !error.details.length && <Banner>{error.message}</Banner>}
        <TextInput label="Full name" value={form.name} onChange={set("name")} error={fields.name} autoComplete="off" />
        <TextInput label="Email" type="email" value={form.email} onChange={set("email")} error={fields.email} autoComplete="off" />
        <TextInput label="Temporary password" type="password" value={form.password} onChange={set("password")} error={fields.password} hint="At least 8 characters" autoComplete="new-password" />
        <SelectInput label="Role" value={form.role} onChange={set("role")} error={fields.role}>
          <option value="owner">Owner</option>
          <option value="registrar">Registrar</option>
        </SelectInput>
        <TextInput label="Identifier" value={form.identifier} onChange={set("identifier")} error={fields.identifier} hint="National ID number or staff number" />
      </form>
    </Dialog>
  );
}
