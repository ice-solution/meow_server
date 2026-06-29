import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { sessionApiUrl } from '../utils/sessionQuery';
import { resolvePostTermsPath } from '../utils/playFlow';
import TermsPage from './TermsPage';

export default function PlayGatePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';
  const code = searchParams.get('code') || '';
  const queryStr = searchParams.toString();
  const [loading, setLoading] = useState(true);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    async function gate() {
      try {
        const sessionRes = await fetch(sessionApiUrl(sessionId, '', sig, code));
        if (!sessionRes.ok) {
          navigate(`/play/${sessionId}/error${queryStr ? `?${queryStr}` : ''}`, { replace: true });
          return;
        }

        const session = await sessionRes.json();
        const next = resolvePostTermsPath(session);
        if (next) {
          navigate(`/play/${sessionId}/${next}${queryStr ? `?${queryStr}` : ''}`, { replace: true });
          return;
        }

        if (session.playFlow === 'sold-out' && (session.status === 'created' || session.status === 'connected')) {
          navigate(`/play/${sessionId}/sold-out${queryStr ? `?${queryStr}` : ''}`, { replace: true });
          return;
        }

        const giftRes = await fetch('/api/games/gift-availability');
        if (!giftRes.ok) {
          setShowTerms(true);
          return;
        }

        const { data: gifts } = await giftRes.json();
        if (gifts.reason === 'sold_out') {
          navigate(`/play/${sessionId}/sold-out${queryStr ? `?${queryStr}` : ''}`, { replace: true });
          return;
        }

        setShowTerms(true);
      } catch {
        setShowTerms(true);
      } finally {
        setLoading(false);
      }
    }

    gate();
  }, [sessionId, navigate, sig, code, queryStr]);

  if (loading) {
    return <div className="play-gate play-gate--loading">載入中…</div>;
  }

  if (showTerms) {
    return <TermsPage />;
  }

  return null;
}
