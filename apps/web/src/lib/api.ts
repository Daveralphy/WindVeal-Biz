export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>, public body?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "include", headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "network", "Can't reach WindVeal. Check your connection and try again.");
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? "Something went wrong. Please try again.", e?.details, data);
  }
  return data as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>("GET", url),
  post: <T = any>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  patch: <T = any>(url: string, body?: unknown) => request<T>("PATCH", url, body ?? {}),
  put: <T = any>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}),
  del: <T = any>(url: string) => request<T>("DELETE", url),
  /** Upload a single file. `query` becomes URL params (folderId, kind, linkType, linkId…). */
  upload: <T = any>(url: string, file: File, query: Record<string, string | undefined> = {}) => {
    const fd = new FormData();
    fd.append("file", file);
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined) as [string, string][]).toString();
    return request<T>("POST", qs ? `${url}?${qs}` : url, fd);
  },
};

/** Builds a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
}

export const fileUrl = (id: string, download = false) => `/api/files/${id}/content${download ? "?download=1" : ""}`;
export const publicFileUrl = (id: string) => `/api/public/files/${id}`;
