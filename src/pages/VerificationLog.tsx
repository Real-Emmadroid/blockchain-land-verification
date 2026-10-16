import { useState } from "react";
import { Banner, EmptyState, HashCell, Panel, PageHeader, ResultBadge, SelectInput, TableSkeleton } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export default function VerificationLog() {
  const [result, setResult] = useState("");
  const { data, error, loading } = useAsync(() => api.verifications(result || undefined, 100), [result]);

  return (
    <>
      <PageHeader
        title="Verification log"
        subtitle="Public checks, newest first. Only the fingerprint and result are kept, never who asked."
        actions={
          <div className="w-48">
            <SelectInput label="Result" value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">All results</option>
              <option value="authentic">Authentic</option>
              <option value="revoked">Revoked</option>
              <option value="not_found">Not found</option>
            </SelectInput>
          </div>
        }
      />
      {error && <div className="mb-4"><Banner>{error.message}</Banner></div>}
      <Panel className="overflow-hidden">
        {loading && !data ? (
          <TableSkeleton />
        ) : data && data.length === 0 ? (
          <EmptyState title="No checks recorded">Checks made on the public Verify page appear here.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Fingerprint</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data?.map((r) => (
                  <tr key={r.id} className={r.result === "not_found" ? "bg-bad-bg/60" : ""}>
                    <td className="px-4 py-2.5"><HashCell hash={r.sha256} /></td>
                    <td className="px-4 py-2.5"><ResultBadge result={r.result} /></td>
                    <td className="px-4 py-2.5 text-muted">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
