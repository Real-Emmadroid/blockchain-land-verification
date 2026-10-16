import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowsClockwise, Plugs, PlugsConnected, Rocket } from "@phosphor-icons/react";
import { Banner, Button, CopyButton, EmptyState, HashCell, Panel, PageHeader, ResultBadge, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import type { ChainStatusInfo } from "../lib/types";

const NETWORKS: Record<number, string> = { 11155111: "Sepolia test network", 1: "Ethereum mainnet" };

function Bars({ rows }: { rows: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="text-muted">{r.label}</span>
          <span className="h-2.5">
            <span className="block h-full rounded-full" style={{ width: `${Math.max((r.value / max) * 100, r.value ? 3 : 0)}%`, background: r.color, transition: "width 600ms cubic-bezier(0.16,1,0.3,1)" }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ChainStrip() {
  const { data, error, loading, reload } = useAsync(() => api.chainStatus());
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState("");
  const [fresh, setFresh] = useState<ChainStatusInfo | null>(null);
  const s = fresh ?? data;

  async function deploy() {
    setDeploying(true);
    setDeployError("");
    try {
      setFresh(await api.deploy());
    } catch (e) {
      setDeployError(e instanceof ApiError ? e.message : "Could not set up the contract.");
    } finally {
      setDeploying(false);
    }
  }

  if (loading && !s) return <Skeleton className="h-28 w-full" />;
  if (error && !s) return <Banner tone="warn" title="Blockchain status unavailable">{error.message}</Banner>;
  if (!s) return null;

  const zero = s.operatorBalanceEth !== null && Number(s.operatorBalanceEth) === 0;
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {s.connected ? <PlugsConnected size={26} className="text-ok" aria-hidden /> : <Plugs size={26} className="text-bad" aria-hidden />}
          <div>
            <h2 className="font-bold">{s.connected ? "Blockchain connected" : s.configured ? "Blockchain not reachable" : "Blockchain not configured"}</h2>
            <p className="text-sm text-muted">
              {s.connected && s.chainId ? `${NETWORKS[s.chainId] ?? `Chain ${s.chainId}`}, block ${s.blockNumber?.toLocaleString()}` : s.configured ? "The network did not respond." : "Set CHAIN_RPC_URL and OPERATOR_PRIVATE_KEY on the server."}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setFresh(null); reload(); }}>
          <ArrowsClockwise size={15} aria-hidden /> Refresh
        </Button>
      </div>

      {s.connected && (
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-muted">Contract</dt>
            <dd className="mt-0.5">{s.contractAddress ? <span className="inline-flex items-center gap-1"><span className="hash break-all">{s.contractAddress}</span><CopyButton value={s.contractAddress} label="Copy contract address" /></span> : "Not set up yet"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted">Operator wallet balance</dt>
            <dd className="mt-0.5 font-semibold">{s.operatorBalanceEth !== null ? `${Number(s.operatorBalanceEth).toFixed(4)} ETH` : "Unknown"}</dd>
          </div>
        </dl>
      )}

      <div className="mt-4 space-y-3">
        {s.configured && s.connected && !s.contractAddress && (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={deploy} loading={deploying}><Rocket size={17} weight="bold" aria-hidden /> Set up blockchain contract</Button>
            <span className="text-sm text-muted">Deploys the registry contract once. This can take up to a minute.</span>
          </div>
        )}
        {deployError && <Banner>{deployError}</Banner>}
        {s.contractOperatorMatches === false && (
          <Banner tone="bad" title="Wrong operator wallet">The configured wallet is not the operator of this contract, so writes will be rejected. Check OPERATOR_PRIVATE_KEY or CONTRACT_ADDRESS.</Banner>
        )}
        {zero && (
          <Banner tone="warn" title="The wallet has no test ETH">
            <p>Send test ETH to this address from a Sepolia faucet.</p>
            {s.operatorAddress && (
              <p className="mt-1 inline-flex items-center gap-1"><span className="hash break-all">{s.operatorAddress}</span><CopyButton value={s.operatorAddress} label="Copy wallet address" /></p>
            )}
          </Banner>
        )}
      </div>
    </Panel>
  );
}

export default function AdminDashboard() {
  const { data: o, error, loading, reload } = useAsync(() => api.overview());

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Registry activity and blockchain health." actions={<Link to="/admin/properties"><Button>Register property</Button></Link>} />
      <div className="space-y-8">
        <ChainStrip />

        {error && !o && <Banner title="Could not load the overview" onClose={undefined}>{error.message} <button onClick={reload} className="font-semibold underline">Try again</button></Banner>}

        {loading && !o ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          o && (
            <>
              <Panel>
                <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
                  {[
                    ["Properties", o.totals.properties],
                    ["Documents", o.totals.documents],
                    ["Owners", o.totals.owners],
                    ["Revoked documents", o.totals.revokedDocuments],
                  ].map(([label, n]) => (
                    <div key={label} className="px-5 py-5">
                      <dt className="text-sm text-muted">{label}</dt>
                      <dd className="mt-1 text-3xl font-extrabold tabular-nums">{n}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>

              <div className="grid gap-8 lg:grid-cols-2">
                <section>
                  <h2 className="mb-4 text-lg font-bold">Documents by chain status</h2>
                  <Bars rows={[
                    { label: "Confirmed", value: o.byChainStatus.confirmed, color: "var(--ok)" },
                    { label: "Pending", value: o.byChainStatus.pending, color: "var(--warn)" },
                    { label: "Failed", value: o.byChainStatus.failed, color: "var(--bad)" },
                  ]} />
                </section>
                <section>
                  <h2 className="mb-4 text-lg font-bold">Transfers</h2>
                  <Bars rows={[
                    { label: "Awaiting review", value: o.transfers.pending, color: "var(--warn)" },
                    { label: "Processing", value: o.transfers.processing, color: "var(--warn)" },
                    { label: "Completed", value: o.transfers.completed, color: "var(--ok)" },
                    { label: "Rejected", value: o.transfers.rejected, color: "var(--bad)" },
                  ]} />
                </section>
                <section>
                  <h2 className="mb-4 text-lg font-bold">Public checks</h2>
                  <Bars rows={[
                    { label: "Authentic", value: o.verifications.authentic, color: "var(--ok)" },
                    { label: "Revoked", value: o.verifications.revoked, color: "var(--bad)" },
                    { label: "Not found", value: o.verifications.not_found, color: "var(--bad)" },
                  ]} />
                </section>
                <section>
                  <h2 className="mb-4 text-lg font-bold">Latest checks that found nothing</h2>
                  <Panel>
                    {o.recentNotFound.length === 0 ? (
                      <EmptyState title="No failed checks yet">Fingerprints that match nothing on the registry will appear here.</EmptyState>
                    ) : (
                      <ul className="divide-y divide-line">
                        {o.recentNotFound.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                            <HashCell hash={r.sha256} />
                            <span className="flex items-center gap-3"><ResultBadge result={r.result} /><span className="text-muted">{formatDateTime(r.createdAt)}</span></span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </section>
              </div>
            </>
          )
        )}
      </div>
    </>
  );
}
