import { getAccessToken } from "./token";

type ApiErrorBody = {
  message?: string;
  error?: string;
};

function toApiPath(path: string): string {
  if (path.startsWith("/api/")) return path;
  if (path === "/api") return path;
  if (path.startsWith("/")) return `/api${path}`;
  return `/api/${path}`;
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as ApiErrorBody | unknown;
      if (typeof data === "object" && data && ("message" in data || "error" in data)) {
        const message = (data as ApiErrorBody).message ?? (data as ApiErrorBody).error;
        if (message) return message;
      }
      return JSON.stringify(data);
    }

    return await response.text();
  } catch {
    return response.statusText;
  }
}

async function apiRequest<T>(
  method: "GET" | "POST" |  "PATCH",
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const accessToken = token ?? getAccessToken();

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(toApiPath(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new Error(`API ${method} ${path} failed: ${message}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  // Useful for edge cases where backend returns plain text.
  return (await response.text()) as unknown as T;
}

export function apiGet<T>(path: string, token?: string | null): Promise<T> {
  return apiRequest<T>("GET", path, undefined, token);
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  return apiRequest<T>("POST", path, body, token);
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  return apiRequest<T>("PATCH", path, body, token);
}