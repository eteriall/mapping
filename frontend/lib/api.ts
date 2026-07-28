import type { Workspace } from "@/lib/types";

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`/api${path}`, {
    cache: "no-store",
    ...options,
    headers,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      // The status text remains the most useful available error.
    }
    throw new Error(detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function loadWorkspace(projectId: string): Promise<Workspace> {
  return apiRequest<Workspace>(`/projects/${projectId}/workspace`);
}
