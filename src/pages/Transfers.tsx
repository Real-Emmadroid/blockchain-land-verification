import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowsClockwise, Check, X } from "@phosphor-icons/react";
import { useAuth } from "../app-context";
import { Banner, Button, Dialog, EmptyState, FileField, Panel, PageHeader, SelectInput, TableSkeleton, TextArea, TransferBadge, TxLink } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { toPayload } from "../lib/file";
import { formatDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import type { Role, Transfer } from "../lib/types";

export default function Transfers({ role }: { role: Role }) {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useAsync(() => api.transfers(status || undefined), [status]);
  const [approve, setApprove] = useState<Transfer | null>(null);
  const [reject, setReject] = useState<Transfer | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "bad"; text: string } | null>(null);
  const base = role === "registrar" ? "/admin" : "/owner";

  async function check(t: Transfer) {
    setBusyId(t.id);
    setNotice(null);
    try {
      const fresh = await api.syncTransfer(t.id);
      setNotice(
        fresh.status === "completed"
          ? { tone: "ok", text: `Transfer of ${fresh.propertyCode} is complete.` }
          : fresh.status === "processing"
            ? { tone: "warn", text: "The network has not confirmed the transaction yet. Try again in a minute." }
            : { tone: "bad", text: "The blockchain rejected the transaction. The request is back to awaiting review." },
      );
      await reload();
    } catch (e) {
      setNotice({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle={role === "registrar" ? "Ownership change requests from owners." : "Requests you sent or received."}
        actions={
          role === "registrar" && (
            <div className="w-48">
              <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Awaiting review</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </SelectInput>
            </div>
          )
        }
      />
      {error && <div className="mb-4"><Banner>{error.message}</Banner></div>}
      {notice && <div className="mb-4"><Banner tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Banner></div>}

      <Panel className="overflow-hidden">
        {loading && !data ? (
          <TableSkeleton />
        ) : data && data.length === 0 ? (
          <EmptyState title="No transfer requests">
            {role === "registrar" ? "Requests appear here when an owner asks to transfer a property." : "Open one of your properties and choose Request transfer to start."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">From and to</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested</th>
                  {role === "registrar" && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {data?.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3">
                      <Link to={`${base}/properties/${t.propertyId}`} className="hash font-medium text-brand underline decoration-brand/40 hover:decoration-brand">{t.propertyCode}</Link>
                      <p className="text-muted">{t.propertyTitle}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {t.fromOwnerName} <ArrowRight size={14} className="text-muted" aria-label="to" /> {t.toOwnerName}
                        {role === "owner" && <span className="text-xs font-normal text-muted">({t.fromOwnerId === user?.id ? "sent" : "received"})</span>}
                      </p>
                      {t.note && <p className="mt-0.5 max-w-xs text-xs text-muted">Note: {t.note}</p>}
                      {t.status === "rejected" && t.rejectionReason && <p className="mt-0.5 max-w-xs text-xs text-bad">Reason: {t.rejectionReason}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <TransferBadge status={t.status} />
                      {t.txHash && <p className="mt-1.5"><TxLink hash={t.txHash} /></p>}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(t.createdAt)}</td>
                    {role === "registrar" && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {t.status === "pending" && (
                            <>
                              <Button size="sm" onClick={() => setApprove(t)}><Check size={15} weight="bold" aria-hidden /> Approve</Button>
                              <Button size="sm" variant="danger" onClick={() => setReject(t)}><X size={15} weight="bold" aria-hidden /> Reject</Button>
                            </>
                          )}
                          {t.status === "processing" && (
                            <Button size="sm" variant="secondary" loading={busyId === t.id} onClick={() => check(t)}>
                              <ArrowsClockwise size={15} aria-hidden /> Check status
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ApproveDialog transfer={approve} onClose={() => setApprove(null)} onDone={(t) => {
        setNotice(t.status === "completed" ? { tone: "ok", text: `Ownership of ${t.propertyCode} moved to ${t.toOwnerName}.` } : { tone: "warn", text: "The transfer was sent to the blockchain and is not confirmed yet. Use Check status in a minute." });
        reload();
      }} />
      <RejectDialog transfer={reject} onClose={() => setReject(null)} onDone={() => { setNotice({ tone: "ok", text: "The request was rejected." }); reload(); }} />
    </>
  );
}

function ApproveDialog({ transfer, onClose, onDone }: { transfer: Transfer | null; onClose: () => void; onDone: (t: Transfer) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function close() {
    onClose();
    setFile(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!transfer) return;
    if (!file) { setError(new ApiError(422, "Attach the signed deed.", [{ path: "fileBase64", message: "The signed deed is required to approve." }])); return; }
    setBusy(true);
    setError(null);
    try {
      const t = await api.decideTransfer(transfer.id, { decision: "approve", docType: "deed_of_assignment", ...(await toPayload(file)) });
      close();
      onDone(t);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(transfer)} onClose={close} title="Approve transfer" footer={<><Button variant="secondary" type="button" onClick={close}>Cancel</Button><Button type="submit" form="approve" loading={busy}>Approve and record on chain</Button></>}>
      <form id="approve" onSubmit={submit} className="space-y-4" noValidate>
        {transfer && <p className="text-sm">Move <span className="hash font-semibold">{transfer.propertyCode}</span> from <b>{transfer.fromOwnerName}</b> to <b>{transfer.toOwnerName}</b>.</p>}
        {error && !error.details.length && <Banner>{error.message}</Banner>}
        <FileField label="Signed deed of assignment" file={file} onChange={setFile} error={error?.fields.fileBase64 || error?.fields.fileName} hint="The deed is registered as a document and its fingerprint is recorded with the transfer." />
      </form>
    </Dialog>
  );
}

function RejectDialog({ transfer, onClose, onDone }: { transfer: Transfer | null; onClose: () => void; onDone: () => void }) {
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
    if (!transfer) return;
    if (!reason.trim()) { setError(new ApiError(422, "Give a reason.", [{ path: "reason", message: "A reason is required." }])); return; }
    setBusy(true);
    setError(null);
    try {
      await api.decideTransfer(transfer.id, { decision: "reject", reason: reason.trim() });
      close();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(transfer)} onClose={close} title="Reject transfer" footer={<><Button variant="secondary" type="button" onClick={close}>Cancel</Button><Button variant="danger" type="submit" form="reject" loading={busy}>Reject request</Button></>}>
      <form id="reject" onSubmit={submit} className="space-y-4" noValidate>
        {error && !error.details.length && <Banner>{error.message}</Banner>}
        <TextArea label="Reason" hint="The owner will see this." value={reason} onChange={(e) => setReason(e.target.value)} error={error?.fields.reason} />
      </form>
    </Dialog>
  );
}
