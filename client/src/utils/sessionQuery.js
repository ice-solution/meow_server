export function useSessionQuery() {
  const params = new URLSearchParams(window.location.search);
  const sig = params.get('sig') || '';
  const code = params.get('code') || '';
  const query = sig ? `?sig=${encodeURIComponent(sig)}${code ? `&code=${encodeURIComponent(code)}` : ''}` : '';
  return { sig, code, query };
}

export function sessionApiUrl(sessionId, path = '', sig, code) {
  const qs = new URLSearchParams();
  if (sig) qs.set('sig', sig);
  if (code) qs.set('code', code);
  const q = qs.toString();
  return `/api/sessions/${sessionId}${path}${q ? `?${q}` : ''}`;
}
