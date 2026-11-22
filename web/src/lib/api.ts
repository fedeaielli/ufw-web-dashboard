export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  })

  if (response.status === 401) {
    window.location.href = "/login"
    throw new Error("Session expired")
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.details?.join(", ") || `Request failed (${response.status})`)
  }
  return data as T
}

export async function mutate<T>(path: string, method: "POST" | "DELETE", body?: unknown): Promise<T> {
  const { token } = await api<{ token: string }>("/api/csrf-token")
  return api<T>(path, {
    method,
    headers: { "X-CSRF-Token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
