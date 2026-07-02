import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * 玩家連線 Socket.io，通知 Game Client 有人掃描／進入流程。
 * 在 PlayGate（掃 QR 後）盡早呼叫，毋須等到條款頁。
 */
export function usePlayerSocket({ sessionId, sig, code, enabled = true, onError }) {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('player:join', { sessionId, sig, code });
    });

    socket.on('session:error', (data) => {
      onErrorRef.current?.(data);
    });

    return () => socket.disconnect();
  }, [sessionId, sig, code, enabled]);
}
