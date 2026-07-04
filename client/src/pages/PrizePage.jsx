import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { formatGiftNumberLabel } from '../utils/giftNumber';
import './PrizePage.css';

export default function PrizePage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const qs = sig ? `?sig=${encodeURIComponent(sig)}` : '';
        const res = await fetch(`/api/games/sessions/${sessionId}/result${qs}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || '無法載入結果');
        }
        const { data } = await res.json();
        setResult(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId, sig]);

  if (loading) {
    return <div className="prize-page prize-page--loading">載入中…</div>;
  }

  if (error || !result) {
    return (
      <PageLayout footerSrc="/assets/Deco4.png">
        <div className="prize-page__error">{error || '找不到結果'}</div>
      </PageLayout>
    );
  }

  const hasPrize = result.hasPrize && result.prizeAsset;

  return (
    <PageLayout
      mainClassName="page-layout__main--prize"
      footerSrc="/assets/Deco4.png"
      footerExtra={
        hasPrize && result.giftNumber ? (
          <p className="prize-page__number">{formatGiftNumberLabel(result.giftNumber)}</p>
        ) : null
      }
    >
      <div className="prize-page__body">
        <img src="/assets/Logo.png" alt="Logo" className="page-layout__logo" />
        <img src="/assets/Title.png" alt="Hunger Run 2026" className="page-layout__title" />

        {hasPrize ? (
          <>
            <img src="/assets/Congrats.png" alt="恭喜您獲得" className="prize-page__congrats" />
            <div className="prize-page__prize-wrap">
              <img
                src={`/assets/${result.prizeAsset}`}
                alt={result.prizeName || '獎品'}
                className="prize-page__prize"
              />
            </div>
            <img src="/assets/ShowScreenshots.png" alt="換領說明" className="prize-page__screenshot-hint" />
          </>
        ) : (
          <img src="/assets/Sorry.png" alt="未能獲獎" className="prize-page__sorry" />
        )}
      </div>
    </PageLayout>
  );
}
