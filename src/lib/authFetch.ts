/**
 * Utility wrapper around native `fetch` that automatically injects
 * the fresh Bearer token from localStorage (if present) into request headers.
 * Ensures consistent authentication across HMR refreshes and client-side requests.
 */

export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
  
  if (!token) {
    return fetch(input, init);
  }

  const headers = new Headers(init?.headers || {});
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
