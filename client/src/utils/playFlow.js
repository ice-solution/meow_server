export async function proceedAfterTerms({ sessionId, sig, code, navigate }) {
  const params = new URLSearchParams();
  if (sig) params.set('sig', sig);
  if (code) params.set('code', code);
  const query = params.toString();
  navigate(`/play/${sessionId}/email${query ? `?${query}` : ''}`, { replace: true });
}

export function resolvePostTermsPath(session) {
  if (session.status === 'playing') {
    return 'waiting';
  }
  if (session.status === 'registered' || session.status === 'terms_accepted') {
    return 'email';
  }
  return null;
}
