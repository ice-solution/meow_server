import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import PageLayout from '../components/PageLayout';
import { sessionApiUrl } from '../utils/sessionQuery';
import './WaitingPage.css';

export default function WaitingPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';
  const code = searchParams.get('code') || '';

  useEffect(() => {
    if (!sessionId) return;

    const socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('player:join', { sessionId, sig, code });
    });

    return () => socket.disconnect();
  }, [sessionId, sig, code]);

  useEffect(() => {
    async function keepAlive() {
      try {
        await fetch(sessionApiUrl(sessionId, '', sig, code));
      } catch {
        // ignore
      }
    }
    keepAlive();
  }, [sessionId, sig, code]);

  return (
    <PageLayout footerSrc="/assets/Deco3.png">
      <img src="/assets/Logo.png" alt="Logo" className="page-layout__logo" />
      <img src="/assets/Title.png" alt="Hunger Run 2026" className="page-layout__title" />

      <img
        src="/assets/inst.png"
        alt="請於主屏幕上閱讀遊戲玩法及禮品"
        className="waiting-page__instruction"
      />
    </PageLayout>
  );
}
