import { Link } from "react-router-dom";
import { useAuth } from "../app-context";
import { Banner, ChainBadge, EmptyState, HashCell, Panel, PageHeader, Skeleton, TxLink } from "../components/ui";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { DOC_TYPE_LABELS } from "../lib/types";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const props = useAsync(() => api.properties());
  const transfers = useAsync(() => api.transfers());
  const docs = useAsync(async () => {
    const list = await api.properties();
    const details = await Promise.all(list.slice(0, 5).map((p) => api.property(p.id)));
    return details
      .flatMap((d) => d.documents)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
  });

  const waiting = transfers.data?.filter((t) => t.status === "pending" || t.status === "processing").length;
  const error = props.error ?? transfers.error;

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name.split(" ")[0] ?? ""}`} subtitle="Your properties and the documents that prove them." />
      {error && <div className="mb-6"><Banner>{error.message}</Banner></div>}

      <Panel className="mb-8">
        <dl className="grid grid-cols-2 divide-x divide-line">
          <Link to="/owner/properties" className="px-5 py-5 hover:bg-surface-2/50">
            <dt className="text-sm text-muted">Properties owned</dt>
            <dd className="mt-1 text-3xl font-extrabold tabular-nums">{props.data ? props.data.length : <Skeleton className="h-9 w-10" />}</dd>
          </Link>
          <Link to="/owner/transfers" className="px-5 py-5 hover:bg-surface-2/50">
            <dt className="text-sm text-muted">Transfers in progress</dt>
            <dd className="mt-1 text-3xl font-extrabold tabular-nums">{waiting ?? <Skeleton className="h-9 w-10" />}</dd>
          </Link>
        </dl>
      </Panel>

      <h2 className="mb-3 text-lg font-bold">Recent documents</h2>
      <Panel>
        {docs.loading && !docs.data ? (
          <div className="space-y-3 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : !docs.data || docs.data.length === 0 ? (
          <EmptyState title="No documents yet">Documents appear once the registrar records a property in your name.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {docs.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{DOC_TYPE_LABELS[d.docType]}</p>
                  <Link to={`/owner/properties/${d.propertyId}`} className="hash text-brand underline decoration-brand/40 hover:decoration-brand">{d.propertyCode}</Link>
                  <span className="ml-2 text-muted">{formatDate(d.createdAt)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <HashCell hash={d.sha256} />
                  <ChainBadge status={d.chainStatus} />
                  <TxLink hash={d.txHash} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
