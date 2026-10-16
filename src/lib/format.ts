const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "");
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : "");

/** First 10 and last 6 characters, as used for transaction hashes. */
export const shortTx = (h: string) => (h.length > 18 ? `${h.slice(0, 10)}...${h.slice(-6)}` : h);
/** Fingerprints are shown as first 10 and last 8 characters. */
export const shortHash = (h: string) => (h.length > 20 ? `${h.slice(0, 10)}...${h.slice(-8)}` : h);

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
