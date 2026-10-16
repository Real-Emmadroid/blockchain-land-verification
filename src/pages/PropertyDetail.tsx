import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowsClockwise, DownloadSimple, Plus, ProhibitInset, ShareNetwork } from "@phosphor-icons/react";
import { useAuth } from "../app-context";
import { Badge, Banner, Button, ChainBadge, Dialog, EmptyState, FileField, HashCell, Panel, PropertyStatusBadge, SelectInput, Skeleton, TextArea, TextInput, TxLink } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { downloadPayload, toPayload } from "../lib/file";
import { formatBytes, formatDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { DOC_TYPE_LABELS, type Doc, type DocType, type Role } from "../lib/types";

export default function PropertyDetail({ role }: { role: Role }) {
  const { id } = useParams();
  const { user } = useAuth();
  const base = role === "registrar" ? "/admin" : "/owner";
  const { data, error, loading, reload } = useAsync(() => api.property(Number(id)), [id]);
  const [notice, setNotice] = useState<{ tone: "bad" | "warn" | "ok"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [revokeDoc, setRevokeDoc] = useState<Doc | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  async function download(d: Doc) {
    setBusyId(d.id);
    setNotice(null);
    try {
      downloadPayload(await api.documentFile(d.id));
    } catch (e) {
      setNotice({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  async function sync(d: Doc) {
    setBusyId(d.id);
    setNotice(null);
    try {
      const fresh = await api.syncDocument(d.id);
      if (fresh.chainStatus === "confirmed") setNotice({ tone: "ok", text: "The document is now confirmed on the blockchain." });
      else if (fresh.chainStatus === "pending") setNotice({ tone: "warn", text: "Still waiting for the network to confirm. Try again in a minute." });
      else setNotice({ tone: "bad", text: fresh.chainError ?? "The blockchain write failed again." });
      await reload();
    } catch (e) {
      setNotice({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <>
        <BackLink to={`${base}/properties`} />
        <Banner>{error?.message ?? "Property not found."}</Banner>
      </>
    );
  }

  const { property: p, documents, history } = data;
  const isOwner = role === "owner" && user?.id === p.currentOwnerId;

  return (
    <>
      <BackLink to={`${base}/properties`} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="hash text-sm text-muted">{p.propertyCode}</p>
          <h1 className="mt-0.5 text-2xl font-bold sm:text-[1.75rem]">{p.title}</h1>
          <div className="mt-2"><PropertyStatusBadge status={p.status} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {role === "registrar" && <Button onClick={() => setAddOpen(true)}><Plus size={16} weight="bold" aria-hidden /> Add document</Button>}
          {isOwner && p.status === "registered" && (
            <Button onClick={() => setTransferOpen(true)}><ShareNetwork size={16} weight="bold" aria-hidden /> Request transfer</Button>
          )}
        </div>
      </div>

      {isOwner && p.status === "transfer_pending" && (
        <div className="mb-6"><Banner tone="warn" title="A transfer is in progress">The registrar is reviewing the request. You can follow it under Transfers.</Banner></div>
      )}
      {notice && <div className="mb-6"><Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Banner></div>}

      <Panel className="mb-8 p-5">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Type" value={<span className="capitalize">{p.propertyType}</span>} />
          <Fact label="Location" value={p.location} />
          <Fact label="Size" value={p.sizeSqm ? `${p.sizeSqm.toLocaleString()} m²` : "Not recorded"} />
          <Fact label="Current owner" value={p.currentOwnerName} />
          <Fact label="Registered on" value={formatDate(p.createdAt)} />
          {p.description && <div className="sm:col-span-2 lg:col-span-3"><Fact label="Description" value={p.description} /></div>}
        </dl>
      </Panel>

      <h2 className="mb-3 text-lg font-bold">Documents</h2>
      <Panel className="mb-10 overflow-hidden">
        {documents.length === 0 ? (
          <EmptyState title="No documents yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Fingerprint</th>
                  <th className="px-4 py-3">Blockchain</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{DOC_TYPE_LABELS[d.docType]}</p>
                      <p className="max-w-[16rem] truncate text-xs text-muted" title={d.fileName}>{d.fileName} ({formatBytes(d.fileSize)})</p>
                      <p className="text-xs text-muted">{formatDate(d.createdAt)}, by {d.uploadedByName}</p>
                    </td>
                    <td className="px-4 py-3"><HashCell hash={d.sha256} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ChainBadge status={d.chainStatus} />
                        {d.revoked && <Badge tone="bad">Revoked</Badge>}
                      </div>
                      {d.revoked && d.revokeReason && <p className="mt-1.5 max-w-[16rem] text-xs text-bad">Reason: {d.revokeReason}</p>}
                      {d.chainStatus === "failed" && d.chainError && role === "registrar" && <p className="mt-1.5 max-w-[16rem] text-xs text-bad">{d.chainError}</p>}
                    </td>
                    <td className="px-4 py-3"><TxLink hash={d.txHash} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="secondary" loading={busyId === d.id} onClick={() => download(d)}>
                          <DownloadSimple size={15} aria-hidden /> Download
                        </Button>
                        {role === "registrar" && d.chainStatus !== "confirmed" && (
                          <Button size="sm" variant="secondary" loading={busyId === d.id} onClick={() => sync(d)}>
                            <ArrowsClockwise size={15} aria-hidden /> {d.chainStatus === "failed" ? "Retry" : "Refresh"}
                          </Button>
                        )}
                        {role === "registrar" && !d.revoked && d.chainStatus === "confirmed" && (
                          <Button size="sm" variant="danger" onClick={() => setRevokeDoc(d)}>
                            <ProhibitInset size={15} aria-hidden /> Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <h2 className="mb-4 text-lg font-bold">Ownership history</h2>
      <ol className="relative ml-3 space-y-6 border-l border-line pb-2">
        {[...history].reverse().map((h, i) => (
          <li key={`${h.ownerId}-${h.since}-${i}`} className="relative pl-6">
            <span className={`absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-bg ${i === 0 ? "bg-brand" : "bg-line"}`} aria-hidden />
            <p className="font-semibold">{h.ownerName} {i === 0 && <span className="ml-1 text-xs font-medium text-brand">Current owner</span>}</p>
            <p className="text-sm text-muted">Since {formatDate(h.since)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              {h.deedSha256 && <span className="inline-flex items-center gap-1 text-muted">Deed <HashCell hash={h.deedSha256} /></span>}
              {h.txHash && <span className="inline-flex items-center gap-1 text-muted">Transaction <TxLink hash={h.txHash} /></span>}
            </div>
          </li>
        ))}
      </ol>

      {role === "registrar" && <AddDocumentDialog open={addOpen} onClose={() => setAddOpen(false)} propertyId={p.id} onDone={(d) => { setNotice(d.chainStatus === "failed" ? { tone: "bad", text: `Saved, but the blockchain write failed: ${d.chainError}. Use Retry on the document.` } : d.chainStatus === "pending" ? { tone: "warn", text: "Document saved. The blockchain has not confirmed it yet. Use Refresh in a minute." } : { tone: "ok", text: "Document saved and confirmed on the blockchain." }); reload(); }} />}
      {role === "registrar" && <RevokeDialog doc={revokeDoc} onClose={() => setRevokeDoc(null)} onDone={() => { setNotice({ tone: "ok", text: "The document has been revoked on the blockchain." }); reload(); }} />}
      {isOwner && <TransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} propertyId={p.id} onDone={() => { setNotice({ tone: "ok", text: "Transfer request sent to the registrar." }); reload(); }} />}
    </>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
      <ArrowLeft size={15} weight="bold" aria-hidden /> Back to properties
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function AddDocumentDialog({ open, onClose, propertyId, onDone }: { open: boolean; onClose: () => void; propertyId: number; onDone: (d: Doc) => void }) {
  const [docType, setDocType] = useState<DocType>("survey_plan");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fields = error?.fields ?? {};

  function close() {
    onClose();
    setFile(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError(new ApiError(422, "Choose a file.", [{ path: "fileBase64", message: "Choose a file." }])); return; }
    setBusy(true);
    setError(null);
    try {
      const d = await api.addDocument(propertyId, { docType, ...(await toPayload(file)) });
      close();
      onDone(d);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Add document" footer={<><Button variant="secondary" onClick={close} type="button">Cancel</Button><Button type="submit" form="add-doc" loading={busy}>Upload and record</Button></>}>
      <form id="add-doc" onSubmit={submit} className="space-y-4" noValidate>
        {error && !error.details.length && <Banner>{error.message}</Banner>}
        <SelectInput label="Document type" value={docType} onChange={(e) => setDocType(e.target.value as DocType)} error={fields.docType}>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectInput>
        <FileField label="File" file={file} onChange={setFile} error={fields.fileBase64 || fields.fileName} />
      </form>
    </Dialog>
  );
}

function RevokeDialog({ doc, onClose, onDone }: { doc: Doc | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function close() {
    onClose();
    setReason("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      await api.revoke(doc.id, reason);
      close();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(doc)} onClose={close} title="Revoke document" footer={<><Button variant="secondary" onClick={close} type="button">Keep document</Button><Button variant="danger" type="submit" form="revoke" loading={busy}>Revoke on blockchain</Button></>}>
      <form id="revoke" onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-muted">Anyone who checks this document will see it as revoked, with your reason. The record is never deleted. This cannot be undone.</p>
        {error && !error.details.length && <Banner>{error.message}</Banner>}
        <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={error?.fields.reason} placeholder="For example: superseded by a new title deed" />
      </form>
    </Dialog>
  );
}

function TransferDialog({ open, onClose, propertyId, onDone }: { open: boolean; onClose: () => void; propertyId: number; onDone: () => void }) {
  const [toEmail, setToEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function close() {
    onClose();
    setToEmail("");
    setNote("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestTransfer(propertyId, { toEmail: toEmail.trim(), note: note.trim() || undefined });
      close();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Request transfer" footer={<><Button variant="secondary" onClick={close} type="button">Cancel</Button><Button type="submit" form="transfer" loading={busy}>Send request</Button></>}>
      <form id="transfer" onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-muted">The registrar reviews the request and records the signed deed. The new owner needs an owner account.</p>
        {error && !error.details.length && <Banner>{error.message}</Banner>}
        <TextInput label="New owner's email" type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} error={error?.fields.toEmail} placeholder="name@example.com" />
        <TextArea label="Note to the registrar" hint="Optional" value={note} onChange={(e) => setNote(e.target.value)} error={error?.fields.note} />
      </form>
    </Dialog>
  );
}
