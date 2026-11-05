const renderApiUrl = 'https://kokwetbck-v2.onrender.com/api';
const localApiUrl = 'http://127.0.0.1:8000/api';
const isLocalDevelopment = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API = (import.meta.env.VITE_API_URL || (isLocalDevelopment ? localApiUrl : renderApiUrl))
  .replace(/\/+$/, '');

export function resolveApiUrl(path) {
  return new URL(path, API).toString();
}

export function resolveMediaUrl(path) {
  return typeof path === 'string' && path.startsWith('/api/media/')
    ? resolveApiUrl(path)
    : path;
}

export async function getJson(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error('Unable to reach Kokwet services');
  return response.json();
}

export async function postJson(path, body) {
  const response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'Request could not be completed');
  if (!data) throw new Error('The server returned an empty response');
  return data;
}

export async function staffRequest(path, token, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'Request could not be completed');
  return data;
}

export async function staffUploadMedia(file, mediaKind, token, expectedContentType) {
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('media_kind', mediaKind);
  if (expectedContentType) body.append('expected_content_type', expectedContentType);
  const response = await fetch(`${API}/v1/staff/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'Media upload could not be completed');
  if (!data?.url) throw new Error('The server did not return a media URL');
  return data;
}

export async function postForm(path, body) {
  const response = await fetch(`${API}${path}`, { method: 'POST', body });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || 'Request could not be completed');
  if (!data) throw new Error('The server returned an empty response');
  return data;
}
