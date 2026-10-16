import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { Banner, Button, ChainBadge, Dialog, EmptyState, FileField, Panel, PageHeader, PropertyStatusBadge, SelectInput, TableSkeleton, TextArea, TextInput, TxLink } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { toPayload } from "../lib/file";
import { useAsync } from "../lib/useAsync";
import { DOC_TYPE_LABELS, type DocType, type Doc, type Property, type Role } from "../lib/types";

export default function Properties({ role }: { role: Role }) {
  const base = role === "registrar" ? "/admin" : "/owner";
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useAsync(() => api.properties(term), [term]);

  return (
    <>
      <PageHeader
        title={role === "registrar" ? "Properties" : "My properties"}
        subtitle={role === "registrar" ? "Every registered property and its documents." : "Properties you own, with the documents that prove them."}
        actions={role === "registrar" && <Button onClick={() => setOpen(true)}><Plus size={16} weight="bold" aria-hidden /> Register property</Button>}
      />

      <div className="relative mb-4 max-w-md">
        <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="q" className="sr-only">Search properties</label>
        <input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by code, title or location"
          className="h-10 w-full rounded-lg border border-line bg-surface pl-10 pr-3 text-sm placeholder:text-muted/80 hover:border-muted focus:border-brand"
        />
      </div>

      {error && <div className="mb-4"><Banner>{error.message} <button className="font-semibold underline" onClick={reload}>Try again</button></Banner></div>}

      <Panel className="overflow-hidden">
        {loading && !data ? (
          <TableSkeleton />
        ) : data && data.length === 0 ? (
          <EmptyState
            title={term ? "No properties match that search" : role === "registrar" ? "No properties registered yet" : "You do not own any properties yet"}
            action={role === "registrar" && !term ? <Button onClick={() => setOpen(true)}>Register the first property</Button> : undefined}
          >
            {term ? "Try a different code, title or location." : role === "registrar" ? "Registering a property also records its first document on the blockchain." : "Properties appear here once the registrar records you as the owner."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                  {role === "registrar" && <th className="px-4 py-3">Owner</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data?.map((p: Property) => (
                  <tr key={p.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3"><Link to={`${base}/properties/${p.id}`} className="hash font-medium text-brand underline decoration-brand/40 hover:decoration-brand">{p.propertyCode}</Link></td>
                    <td className="px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3 capitalize">{p.propertyType}</td>
                    <td className="px-4 py-3 text-muted">{p.location}</td>
                    {role === "registrar" && <td className="px-4 py-3">{p.currentOwnerName}</td>}
                    <td className="px-4 py-3"><PropertyStatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.documentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {role === "registrar" && <RegisterDialog open={open} onClose={() => setOpen(false)} onDone={reload} base={base} />}
    </>
  );
}

function RegisterDialog({ open, onClose, onDone, base }: { open: boolean; onClose: () => void; onDone: () => void; base: string }) {
  const navigate = useNavigate();
  const owners = useAsync(() => api.users("owner"), []);
  const empty = { title: "", propertyType: "land", location: "", sizeSqm: "", description: "", ownerId: "", docType: "title_deed" as DocType };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<{ property: Property; document: Doc } | null>(null);
  const fields = error?.fields ?? {};
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  function close() {
    onClose();
    if (result) onDone();
    setTimeout(() => { setForm(empty); setFile(null); setError(null); setResult(null); }, 200);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError(new ApiError(422, "Choose the founding document.", [{ path: "fileBase64", message: "Choose the founding document." }])); return; }
    setBusy(true);
    try {
      const payload = await toPayload(file);
      setResult(
        await api.createProperty({
          title: form.title,
          propertyType: form.propertyType,
          location: form.location,
          sizeSqm: form.sizeSqm ? Number(form.sizeSqm) : undefined,
          description: form.description,
          ownerId: Number(form.ownerId),
          docType: form.docType,
          ...payload,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const d = result.document;
    return (
      <Dialog open={open} onClose={close} title="Property registered" footer={<><Button variant="secondary" onClick={close}>Close</Button><Button onClick={() => navigate(`${base}/properties/${result.property.id}`)}>Open property</Button></>}>
        <div className="space-y-3 text-sm">
          <p>
            <span className="hash text-base font-semibold">{result.property.propertyCode}</span> was saved for {result.property.currentOwnerName}.
          </p>
          <p className="flex items-center gap-2">Blockchain status: <ChainBadge status={d.chainStatus} /> {d.txHash && <TxLink hash={d.txHash} />}</p>
          {d.chainStatus === "pending" && <Banner tone="warn">The transaction was sent but is not confirmed yet. Open the property and use Refresh in a minute.</Banner>}
          {d.chainStatus === "failed" && <Banner>{d.chainError ?? "The blockchain write failed."} The property is saved. Open it and use Retry once the problem is fixed.</Banner>}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Register property"
      wide
      footer={<><Button variant="secondary" onClick={close} type="button">Cancel</Button><Button type="submit" form="register-form" loading={busy}>Register and record on chain</Button></>}
    >
      <form id="register-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {error && !error.details.length && <div className="sm:col-span-2"><Banner>{error.message}</Banner></div>}
        <div className="sm:col-span-2"><TextInput label="Title" value={form.title} onChange={set("title")} error={fields.title} placeholder="Plot 14, Ajah Layout" /></div>
        <SelectInput label="Type" value={form.propertyType} onChange={set("propertyType")} error={fields.propertyType}>
          <option value="land">Land</option>
          <option value="building">Building</option>
        </SelectInput>
        <TextInput label="Size (square metres)" type="number" min="0" step="any" value={form.sizeSqm} onChange={set("sizeSqm")} error={fields.sizeSqm} hint="Optional" />
        <div className="sm:col-span-2"><TextInput label="Location" value={form.location} onChange={set("location")} error={fields.location} placeholder="Ajah, Lekki, Lagos" /></div>
        <div className="sm:col-span-2"><TextArea label="Description" value={form.description} onChange={set("description")} error={fields.description} /></div>
        <SelectInput label="Owner" value={form.ownerId} onChange={set("ownerId")} error={fields.ownerId}>
          <option value="">{owners.loading ? "Loading owners..." : "Choose an owner"}</option>
          {owners.data?.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
        </SelectInput>
        <SelectInput label="Document type" value={form.docType} onChange={set("docType")} error={fields.docType}>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectInput>
        <div className="sm:col-span-2">
          <FileField label="Founding document" file={file} onChange={setFile} error={fields.fileBase64 || fields.fileName} />
        </div>
      </form>
    </Dialog>
  );
}

