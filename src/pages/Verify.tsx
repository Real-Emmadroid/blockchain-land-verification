import { useRef, useState } from "react";
import { ArrowCounterClockwise, CheckCircle, FileMagnifyingGlass, Prohibit, SealQuestion, ShieldCheck } from "@phosphor-icons/react";
import { Banner, Button, CopyButton, TxLink } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { sha256Hex } from "../lib/file";
import { formatDate } from "../lib/format";
import { DOC_TYPE_LABELS, type VerifyResponse } from "../lib/types";

const MAX_CHECK_BYTES = 50 * 1024 * 1024;

type Phase = { name: "idle" } | { name: "hashing" } | { name: "checking"; sha256: string } | { name: "done"; result: VerifyResponse } | { name: "error"; message: string; tone: "bad" | "warn" };

export default function Verify() {
  const [mode, setMode] = useState<"file" | "hash">("file");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [fileName, setFileName] = useState("");
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = phase.name === "hashing" || phase.name === "checking";

  async function check(sha256: string) {
    setPhase({ name: "checking", sha256 });
    try {
      setPhase({ name: "done", result: await api.verify(sha256) });
    } catch (e) {
      const err = e as ApiError;
      setPhase({
        name: "error",
        tone: err.status === 503 || err.status === 0 ? "warn" : "bad",
        message:
          err.status === 503
            ? `${err.message} Your fingerprint was not checked, so no result was recorded.`
            : err.message,
      });
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_CHECK_BYTES) {
      setPhase({ name: "error", tone: "bad", message: "That file is larger than 50 MB. Choose the document itself, not an archive." });
      return;
    }
    setFileName(file.name);
    setPhase({ name: "hashing" });
    try {
      await check(await sha256Hex(file));
    } catch {
      setPhase({ name: "error", tone: "bad", message: "This browser could not read the file. Try again or paste the fingerprint instead." });
    }
  }

  function onPaste(e: React.FormEvent) {
    e.preventDefault();
    const value = pasted.trim().toLowerCase().replace(/^0x/, "");
    if (!/^[a-f0-9]{64}$/.test(value)) {
      setPasteError("A fingerprint is exactly 64 characters, using 0-9 and a-f.");
      return;
    }
    setPasteError("");
    setFileName("");
    check(value);
  }

  function reset() {
    setPhase({ name: "idle" });
    setFileName("");
    setPasted("");
    setPasteError("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Verify a document</h1>
      <p className="mt-3 flex items-start gap-2 text-muted">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        Your file never leaves your device. Only its fingerprint is checked.
      </p>

      {phase.name !== "done" && (
        <>
          <div role="tablist" aria-label="How to check" className="mt-8 inline-flex rounded-lg border border-line bg-surface p-1 text-sm font-semibold">
            {(["file", "hash"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => { setMode(m); setPasteError(""); }}
                className={`rounded-md px-4 py-1.5 transition-colors ${mode === m ? "bg-brand text-brand-ink" : "text-muted hover:text-ink"}`}
              >
                {m === "file" ? "Choose a file" : "Paste a fingerprint"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {mode === "file" ? (
              <label
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]); }}
                className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
                  over ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand"
                }`}
              >
                <FileMagnifyingGlass size={44} className="text-brand" aria-hidden />
                <span className="text-lg font-bold">{busy ? "Checking..." : "Drop the document here"}</span>
                <span className="text-sm text-muted">
                  {busy && fileName ? fileName : "or select it from your device. Any PDF or image."}
                </span>
                {!busy && <span className="mt-1 inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold">Choose a file</span>}
                <input ref={inputRef} type="file" disabled={busy} className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            ) : (
              <form onSubmit={onPaste} className="rounded-xl border border-line bg-surface p-5" noValidate>
                <label htmlFor="hash" className="text-[13px] font-semibold">Document fingerprint (SHA-256)</label>
                <input
                  id="hash"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={Boolean(pasteError)}
                  placeholder="64 characters, for example 9f86d081..."
                  className={`hash mt-1.5 h-11 w-full rounded-lg border bg-surface px-3 text-ink placeholder:text-muted/80 hover:border-muted focus:border-brand ${pasteError ? "border-bad" : "border-line"}`}
                />
                {pasteError && <p className="mt-1.5 text-xs font-medium text-bad" role="alert">{pasteError}</p>}
                <Button type="submit" loading={busy} className="mt-4">Check fingerprint</Button>
              </form>
            )}
          </div>
        </>
      )}

      {busy && (
        <p className="mt-6 text-sm text-muted" role="status">
          {phase.name === "hashing" ? "Calculating the fingerprint on your device..." : "Comparing with the registry..."}
        </p>
      )}

      {phase.name === "error" && (
        <div className="mt-6">
          <Banner tone={phase.tone} title={phase.tone === "warn" ? "The registry could not be reached" : "The check did not complete"}>
            {phase.message}
          </Banner>
        </div>
      )}

      {phase.name === "done" && <ResultCard result={phase.result} fileName={fileName} onReset={reset} />}
    </div>
  );
}

const VIEW = {
  authentic: {
    icon: CheckCircle,
    word: "AUTHENTIC",
    text: "This exact document is registered and has not been withdrawn.",
    head: "bg-ok-bg text-ok",
    ring: "border-ok/40",
  },
  revoked: {
    icon: Prohibit,
    word: "REVOKED",
    text: "This document was registered, then withdrawn by the registrar. Do not rely on it.",
    head: "bg-bad-bg text-bad",
    ring: "border-bad/40",
  },
  not_found: {
    icon: SealQuestion,
    word: "NOT FOUND",
    text: "This document is not registered. It may be forged, altered or not yet registered.",
    head: "bg-bad-bg text-bad",
    ring: "border-bad/40",
  },
} as const;

function ResultCard({ result, fileName, onReset }: { result: VerifyResponse; fileName: string; onReset: () => void }) {
  const v = VIEW[result.result];
  const Icon = v.icon;
  return (
    <div className={`rise mt-8 overflow-hidden rounded-xl border-2 bg-surface ${v.ring}`} role="status" aria-live="polite">
      <div className={`flex items-center gap-4 px-6 py-6 ${v.head}`}>
        <Icon size={56} weight="fill" aria-hidden className="shrink-0" />
        <div>
          <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{v.word}</p>
          <p className="mt-1 text-[15px] font-medium">{v.text}</p>
        </div>
      </div>
      <dl className="grid gap-x-8 gap-y-4 px-6 py-6 text-sm sm:grid-cols-2">
        {fileName && <Row label="File checked" value={fileName} />}
        {result.propertyCode && <Row label="Property code" value={<span className="hash text-sm">{result.propertyCode}</span>} />}
        {result.docType && <Row label="Document type" value={DOC_TYPE_LABELS[result.docType] ?? result.docType} />}
        {result.registeredAt && <Row label="Registered on" value={formatDate(result.registeredAt)} />}
        {result.result === "revoked" && result.revokedAt && <Row label="Revoked on" value={formatDate(result.revokedAt)} />}
        {result.result === "revoked" && result.revokeReason && <Row label="Reason given" value={result.revokeReason} wide />}
        {result.txHash && <Row label="Registration transaction" value={<TxLink hash={result.txHash} />} />}
        <Row
          label="Fingerprint (SHA-256)"
          wide
          value={
            <span className="inline-flex items-start gap-1">
              <span className="hash break-all">{result.sha256}</span>
              <CopyButton value={result.sha256} label="Copy fingerprint" />
            </span>
          }
        />
      </dl>
      <div className="border-t border-line bg-surface-2/60 px-6 py-4">
        <Button variant="secondary" onClick={onReset}>
          <ArrowCounterClockwise size={16} weight="bold" aria-hidden /> Check another document
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
