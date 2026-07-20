// Use relative URLs so Vite proxy forwards /api/* to the backend.
// This means only the frontend port needs to be exposed (no firewall issues).
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

export function authHeader(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseErrorMessage(r: Response): Promise<string> {
  try {
    const body = await r.json();
    return body.error || body.title || body.message || `Request failed (${r.status})`;
  } catch {
    return `Request failed (${r.status})`;
  }
}

function handleUnauthorized() {
  localStorage.removeItem("streamvault_jwt");
  localStorage.removeItem("streamvault_user_key");
  localStorage.removeItem("streamvault_user_profile");
  // Use a custom event so React can handle the redirect gracefully
  window.dispatchEvent(new Event("auth-expired"));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(input, init);
      if (!TRANSIENT_STATUS_CODES.has(response.status) || attempt >= retries) {
        return response;
      }
    } catch (error) {
      // Retry network/proxy startup races (common during local backend restart).
      if (attempt >= retries) {
        throw error;
      }
    }

    attempt += 1;
    await sleep(250 * attempt);
  }
}

export async function get<T>(path: string, token?: string, options?: { silent401?: boolean }) {
  const r = await fetchWithRetry(`${API_BASE}${path}`, { headers: { ...authHeader(token) } });
  if (r.status === 401) {
    if (!options?.silent401) handleUnauthorized();
    throw new Error("Session expired");
  }
  if (!r.ok) throw new Error(await parseErrorMessage(r));
  return r.json() as Promise<T>;
}

export async function post<T>(path: string, body: unknown, token?: string) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(body),
  });
  if (r.status === 401) { handleUnauthorized(); throw new Error("Session expired"); }
  if (!r.ok) throw new Error(await parseErrorMessage(r));
  return r.json() as Promise<T>;
}

export async function del(path: string, token?: string) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { ...authHeader(token) },
  });
  if (r.status === 401) { handleUnauthorized(); throw new Error("Session expired"); }
  if (!r.ok && r.status !== 204) throw new Error(await parseErrorMessage(r));
}