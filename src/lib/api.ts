import type {
  AppConfig, ChainStatusInfo, Doc, OwnershipEntry, Overview, Property, SessionUser, Transfer, User,
  VerificationLogItem, VerifyResponse, DocType,
} from "./types";

const TOKEN_KEY = "lvs_token";

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
  /** Field-level messages from a 422 response, keyed by field name. */
  get fields(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.path, d.message]));
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "The server may be waking up. Please try again in a moment.");
  }

  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    if (res.status === 401 && auth && token) {
      tokenStore.clear();
      onUnauthorized();
    }
    const message =
      data?.error ??
      (res.status >= 500 ? "The server did not respond in time. Please try again in a moment." : "The request failed.");
    throw new ApiError(res.status, message, data?.details ?? []);
  }
  return data as T;
}

const get = <T,>(p: string) => request<T>("GET", p);
const post = <T,>(p: string, b?: unknown, auth = true) => request<T>("POST", p, b ?? {}, auth);
const patch = <T,>(p: string, b: unknown) => request<T>("PATCH", p, b);

const qs = (params: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

export interface FilePayload { fileName: string; fileType: string; fileBase64: string }

export const api = {
  login: (email: string, password: string) =>
    post<{ token: string; user: SessionUser }>("/auth/login", { email, password }, false),
  me: () => get<SessionUser>("/auth/me"),
  config: () => request<AppConfig>("GET", "/config", undefined, false),
  verify: (sha256: string) => post<VerifyResponse>("/verify", { sha256 }, false),

  users: (role?: string) => get<User[]>(`/users${qs({ role })}`),
  createUser: (b: { name: string; email: string; password: string; role: string; identifier: string }) => post<User>("/users", b),
  updateUser: (id: number, b: { name?: string; isActive?: boolean }) => patch<User>(`/users/${id}`, b),

  properties: (q?: string) => get<Property[]>(`/properties${qs({ q })}`),
  property: (id: number) => get<{ property: Property; documents: Doc[]; history: OwnershipEntry[] }>(`/properties/${id}`),
  createProperty: (b: {
    title: string; propertyType: string; location: string; sizeSqm?: number; description: string;
    ownerId: number; docType: DocType;
  } & FilePayload) => post<{ property: Property; document: Doc }>("/properties", b),
  addDocument: (id: number, b: { docType: DocType } & FilePayload) => post<Doc>(`/properties/${id}/documents`, b),
  requestTransfer: (id: number, b: { toEmail: string; note?: string }) => post<Transfer>(`/properties/${id}/transfers`, b),

  documentFile: (id: number) => get<FilePayload>(`/documents/${id}/file`),
  revoke: (id: number, reason: string) => post<Doc>(`/documents/${id}/revoke`, { reason }),
  syncDocument: (id: number) => post<Doc>(`/documents/${id}/sync`),

  transfers: (status?: string) => get<Transfer[]>(`/transfers${qs({ status })}`),
  decideTransfer: (id: number, b: { decision: "approve" | "reject"; reason?: string; docType?: DocType } & Partial<FilePayload>) =>
    patch<Transfer>(`/transfers/${id}`, b),
  syncTransfer: (id: number) => post<Transfer>(`/transfers/${id}/sync`),

  verifications: (result?: string, limit?: number) => get<VerificationLogItem[]>(`/verifications${qs({ result, limit })}`),
  overview: () => get<Overview>("/reports/overview"),
  chainStatus: () => get<ChainStatusInfo>("/chain/status"),
  deploy: () => post<ChainStatusInfo>("/chain/deploy"),
};
