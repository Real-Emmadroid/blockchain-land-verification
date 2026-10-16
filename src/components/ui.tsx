import {
  useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import {
  ArrowSquareOut, Check, CheckCircle, Copy, FileArrowUp, Info, SpinnerGap, WarningCircle, X, XCircle,
} from "@phosphor-icons/react";
import { useConfig } from "../app-context";
import { checkFile, sha256Hex } from "../lib/file";
import { formatBytes, shortHash, shortTx } from "../lib/format";
import type { ChainStatus, PropertyStatus, TransferStatus, VerifyResult } from "../lib/types";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ---------- Buttons ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const buttonVariants = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover border border-transparent",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "bg-transparent text-brand border border-transparent hover:bg-brand-soft",
  danger: "bg-transparent text-bad border border-bad hover:bg-bad-bg",
};
const buttonSizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };

export function Button({ variant = "primary", size = "md", loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[background-color,transform,opacity] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
    >
      {loading && <SpinnerGap className="spin" size={16} weight="bold" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */
const controlClass =
  "w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted/80 transition-colors hover:border-muted focus:border-brand disabled:opacity-60";

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs font-medium text-bad" role="alert">{error}</p>}
    </div>
  );
}

type FieldProps = { label: string; error?: string; hint?: string };

export function TextInput({ label, error, hint, id, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fid}>
      <input id={fid} aria-invalid={Boolean(error)} {...rest} className={cx(controlClass, "h-10", error ? "border-bad" : "border-line", className)} />
    </Field>
  );
}

export function SelectInput({ label, error, hint, id, children, className, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fid}>
      <select id={fid} aria-invalid={Boolean(error)} {...rest} className={cx(controlClass, "h-10", error ? "border-bad" : "border-line", className)}>
        {children}
      </select>
    </Field>
  );
}

export function TextArea({ label, error, hint, id, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={fid}>
      <textarea id={fid} aria-invalid={Boolean(error)} rows={3} {...rest} className={cx(controlClass, "py-2", error ? "border-bad" : "border-line", className)} />
    </Field>
  );
}

/* ---------- Badges ---------- */
type Tone = "ok" | "warn" | "bad" | "neutral";
const tones: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  neutral: "bg-surface-2 text-muted",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export const ChainBadge = ({ status }: { status: ChainStatus }) => (
  <Badge tone={status === "confirmed" ? "ok" : status === "pending" ? "warn" : "bad"}>
    {status === "confirmed" ? "Confirmed" : status === "pending" ? "Pending" : "Failed"}
  </Badge>
);

export const TransferBadge = ({ status }: { status: TransferStatus }) => (
  <Badge tone={status === "completed" ? "ok" : status === "rejected" ? "bad" : "warn"}>
    {status === "pending" ? "Awaiting review" : status === "processing" ? "Processing" : status === "completed" ? "Completed" : "Rejected"}
  </Badge>
);

export const PropertyStatusBadge = ({ status }: { status: PropertyStatus }) => (
  <Badge tone={status === "registered" ? "ok" : "warn"}>{status === "registered" ? "Registered" : "Transfer pending"}</Badge>
);

export const ResultBadge = ({ result }: { result: VerifyResult }) => (
  <Badge tone={result === "authentic" ? "ok" : "bad"}>
    {result === "authentic" ? "Authentic" : result === "revoked" ? "Revoked" : "Not found"}
  </Badge>
);

/* ---------- Feedback ---------- */
export function Banner({ tone = "bad", title, children, onClose }: { tone?: "bad" | "warn" | "ok" | "info"; title?: string; children: ReactNode; onClose?: () => void }) {
  const palette = { bad: "bg-bad-bg text-bad", warn: "bg-warn-bg text-warn", ok: "bg-ok-bg text-ok", info: "bg-brand-soft text-ink" }[tone];
  const Icon = tone === "ok" ? CheckCircle : tone === "info" ? Info : tone === "warn" ? WarningCircle : XCircle;
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-xl px-4 py-3 text-sm", palette)}>
      <Icon size={20} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100">
          <X size={16} weight="bold" />
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-lg bg-surface-2", className)} aria-hidden />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-base font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Layout bits ---------- */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-xl border border-line bg-surface", className)}>{children}</section>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Dialog (native <dialog>: focus trap and Esc come for free) ---------- */
export function Dialog({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cx(
        "m-auto max-h-[92dvh] w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_-20px_rgba(8,40,28,0.45)] backdrop:bg-[#08241a]/55",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">{footer}</div>}
      </div>
    </dialog>
  );
}

/* ---------- Hashes, copy, links ---------- */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch { /* clipboard blocked */ }
      }}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
    >
      {done ? <Check size={15} weight="bold" className="text-ok" /> : <Copy size={15} />}
    </button>
  );
}

export function HashCell({ hash }: { hash: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="hash" title={hash}>{shortHash(hash)}</span>
      <CopyButton value={hash} label="Copy fingerprint" />
    </span>
  );
}

export function TxLink({ hash }: { hash: string | null }) {
  const config = useConfig();
  if (!hash) return <span className="text-muted">None yet</span>;
  const base = config?.explorerTxBase;
  if (!base) return <span className="hash">{shortTx(hash)}</span>;
  return (
    <a href={`${base}${hash}`} target="_blank" rel="noopener noreferrer" className="hash relative inline-flex items-center gap-1 text-brand underline decoration-brand/40 hover:decoration-brand">
      {shortTx(hash)}
      <ArrowSquareOut size={13} aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/* ---------- File picker with live fingerprint ---------- */
export function FileField({ label, file, onChange, error, hint, id }: { label: string; file: File | null; onChange: (f: File | null) => void; error?: string; hint?: string; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const [hash, setHash] = useState("");
  const [localError, setLocalError] = useState("");
  const [over, setOver] = useState(false);

  useEffect(() => {
    setHash("");
    if (!file) return;
    let live = true;
    sha256Hex(file).then((h) => live && setHash(h)).catch(() => live && setHash(""));
    return () => { live = false; };
  }, [file]);

  function pick(f: File | undefined) {
    if (!f) return;
    const problem = checkFile(f);
    setLocalError(problem ?? "");
    onChange(problem ? null : f);
  }

  const shownError = error || localError;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="text-[13px] font-semibold">{label}</label>
      <label
        htmlFor={fid}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
        className={cx(
          "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]",
          over ? "border-brand bg-brand-soft" : shownError ? "border-bad" : "border-line bg-surface hover:border-brand",
        )}
      >
        <FileArrowUp size={22} className="shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 flex-1">
          {file ? (
            <>
              <span className="block truncate font-medium">{file.name}</span>
              <span className="text-xs text-muted">{formatBytes(file.size)}. Select to change.</span>
            </>
          ) : (
            <span className="text-muted">Drop a file here or select one. PDF, PNG or JPG, up to 4 MB.</span>
          )}
        </span>
        <input id={fid} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {file && (
        <p className="text-xs text-muted">
          Fingerprint (SHA-256): <span className="hash break-all text-ink">{hash || "calculating..."}</span>
        </p>
      )}
      {hint && !shownError && <p className="text-xs text-muted">{hint}</p>}
      {shownError && <p className="text-xs font-medium text-bad" role="alert">{shownError}</p>}
    </div>
  );
}
