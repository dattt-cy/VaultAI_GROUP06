export const API_BASE = '';

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  return res;
}

export const apiGet = (url: string) => apiFetch(url);

export const apiPost = (url: string, body?: unknown) =>
  apiFetch(url, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiPatch = (url: string, body?: unknown) =>
  apiFetch(url, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiPut = (url: string, body?: unknown) =>
  apiFetch(url, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

export const apiDelete = (url: string) => apiFetch(url, { method: 'DELETE' });
