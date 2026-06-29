import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import './GameClientPage.css';

const SECTION_ID = import.meta.env.VITE_SECTION_ID;
const CLIENT_ID = import.meta.env.VITE_GAME_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GAME_CLIENT_SECRET;

export default function GameClientPage() {
  const [sessionId, setSessionId] = useState(null);
  const [sectionId, setSectionId] = useState(null);
  const [playUrl, setPlayUrl] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [status, setStatus] = useState('created');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const createSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    const sid = SECTION_ID || new URLSearchParams(window.location.search).get('sectionId');
    if (!sid) {
      setError('請設定 VITE_SECTION_ID 或在 URL 加上 ?sectionId=...');
      setLoading(false);
      return;
    }
    if (!CLIENT_ID || !CLIENT_SECRET) {
      setError('請設定 VITE_GAME_CLIENT_ID 及 VITE_GAME_CLIENT_SECRET');
      setLoading(false);
      return;
    }

    try {
      const loginRes = await fetch('/api/game-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
      });
      if (!loginRes.ok) throw new Error('Game client 登入失敗');
      const loginData = await loginRes.json();
      const token = loginData.data.token;

      const res = await fetch(`/api/games/${sid}/info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('無法建立 session');
      const { data } = await res.json();

      setSectionId(sid);
      setSessionId(data.session._id);
      setPlayUrl(data.qr.joinUrl);
      setQrImageUrl(data.qr.imageUrl);
      setStatus('created');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    createSession();
  }, [createSession]);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('gameClient:join', { sessionId, sectionId });
    });

    socket.on('session:updated', (data) => {
      if (data.sessionId === sessionId) {
        setStatus(data.status);
      }
    });

    socket.on('session:bound', (data) => {
      if (data.sessionId === sessionId) {
        setStatus('connected');
        console.log('[GameClient] session:bound', data);
      }
    });

    socket.on('session:game-start', (data) => {
      if (data.sessionId === sessionId) {
        setStatus('playing');
        console.log('[GameClient] session:game-start', data);
      }
    });

    return () => socket.disconnect();
  }, [sessionId, sectionId]);

  const statusLabel = {
    created: '等待玩家掃描 QR Code…',
    connected: '玩家已連接',
    terms_accepted: '玩家已同意條款',
    registered: '玩家已登記電郵',
    playing: '遊戲進行中',
    finished: '遊戲完成',
    completed: '遊戲完成',
    expired: 'Session 已過期',
  };

  return (
    <div className="game-client">
      <div className="game-client__inner">
        <img src="/assets/Logo.png" alt="Hunger Run 2026" className="game-client__logo" />
        <h1 className="game-client__title">Game Client — QR Code</h1>

        {loading && <p className="game-client__status">載入中…</p>}
        {error && (
          <div className="game-client__error">
            <p>{error}</p>
            <button type="button" onClick={createSession}>重試</button>
          </div>
        )}

        {!loading && !error && playUrl && (
          <>
            <div className="game-client__qr">
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="QR Code" width={280} height={280} />
              ) : (
                <p>{playUrl}</p>
              )}
            </div>
            <p className="game-client__url">{playUrl}</p>
            <p className="game-client__status">{statusLabel[status] || status}</p>
            <button type="button" className="game-client__refresh" onClick={createSession}>
              產生新 QR Code
            </button>
          </>
        )}
      </div>
    </div>
  );
}
