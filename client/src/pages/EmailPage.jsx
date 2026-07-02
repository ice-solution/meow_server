import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { sessionApiUrl } from '../utils/sessionQuery';
import { resolvePostTermsPath } from '../utils/playFlow';
import './EmailPage.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';
  const code = searchParams.get('code') || '';
  const queryStr = searchParams.toString();
  const [email, setEmail] = useState('');
  const [errorType, setErrorType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [duplicatePendingEmail, setDuplicatePendingEmail] = useState(null);
  const [hideDuplicateImage, setHideDuplicateImage] = useState(false);

  const isValidEmail = EMAIL_RE.test(email.trim());
  const hasInvalidError = errorType === 'invalid' || errorType === 'unreachable';
  const showDuplicateWarning =
    duplicatePendingEmail !== null &&
    duplicatePendingEmail === email.trim() &&
    !hideDuplicateImage;
  const canStart =
    !hasInvalidError &&
    (registered ? true : isValidEmail);

  const wordImageSrc =
    showDuplicateWarning
      ? '/assets/Email_Registered.png'
      : hasInvalidError
        ? '/assets/Email_Invalid.png'
        : '/assets/Email_Word.png';

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(sessionApiUrl(sessionId, '', sig, code));
        if (!res.ok) {
          setErrorType('session');
          return;
        }
        const data = await res.json();
        const next = resolvePostTermsPath(data);
        if (next === 'waiting') {
          navigate(`/play/${sessionId}/waiting${queryStr ? `?${queryStr}` : ''}`, { replace: true });
          return;
        }
        if (data.status === 'waiting' || data.status === 'connected' || data.status === 'created') {
          navigate(`/play/${sessionId}${queryStr ? `?${queryStr}` : ''}`, { replace: true });
          return;
        }
        if (data.status === 'playing') {
          navigate(`/play/${sessionId}/waiting${queryStr ? `?${queryStr}` : ''}`, { replace: true });
          return;
        }
        if (data.status === 'registered') {
          setRegistered(true);
          if (data.email) setEmail(data.email);
          if (data.canClaimPrize === false) {
            setDuplicatePendingEmail(data.email || null);
          }
        }
      } catch {
        setErrorType('session');
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, [sessionId, navigate, sig, code, queryStr]);

  const proceedToGame = async () => {
    const res = await fetch(sessionApiUrl(sessionId, '/start-game', sig, code), {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '無法開始遊戲');
    }
    navigate(`/play/${sessionId}/waiting${queryStr ? `?${queryStr}` : ''}`, { replace: true });
  };

  const handleSubmit = async () => {
    if (registered) {
      if (submitting) return;
      setSubmitting(true);
      try {
        await proceedToGame();
      } catch {
        setErrorType('session');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!isValidEmail || submitting) return;

    setSubmitting(true);
    if (!duplicatePendingEmail) {
      setErrorType(null);
    }

    const trimmedEmail = email.trim();
    const acceptDuplicate =
      duplicatePendingEmail !== null && duplicatePendingEmail === trimmedEmail;

    try {
      const res = await fetch(sessionApiUrl(sessionId, '/register-email', sig, code), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          sig,
          code,
          acceptDuplicate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'invalid_email') {
          setErrorType('invalid');
        } else if (data.error === 'email_unreachable') {
          setErrorType('unreachable');
        } else {
          setErrorType('session');
        }
        return;
      }

      if (data.warning === 'already_registered') {
        setDuplicatePendingEmail(trimmedEmail);
        setHideDuplicateImage(false);
        return;
      }

      setDuplicatePendingEmail(null);
      setHideDuplicateImage(false);
      setRegistered(true);
      await proceedToGame();
    } catch {
      setErrorType('session');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="email-page email-page--loading">載入中…</div>;
  }

  if (errorType === 'session') {
    return (
      <PageLayout>
        <div className="email-page__error">連線失敗，請重新掃描 QR Code</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <img src="/assets/Logo.png" alt="Logo" className="page-layout__logo" />
      <img src="/assets/Title.png" alt="Hunger Run 2026" className="page-layout__title" />
      <img src="/assets/Inst_Email.png" alt="請輸入電郵地址" className="email-page__inst" />

      <div className="email-page__field-wrap">
        <img src="/assets/EmailField.png" alt="" className="email-page__field-bg" />
        <input
          type="email"
          className="email-page__input"
          placeholder="example@email.com"
          value={email}
          onChange={(e) => {
            const next = e.target.value;
            setEmail(next);
            if (errorType === 'invalid' || errorType === 'unreachable') {
              setErrorType(null);
            }
            if (duplicatePendingEmail && next.trim() !== duplicatePendingEmail) {
              setDuplicatePendingEmail(null);
              setHideDuplicateImage(false);
            }
          }}
          onFocus={() => {
            if (duplicatePendingEmail) {
              setHideDuplicateImage(true);
            }
          }}
          autoComplete="email"
          inputMode="email"
          readOnly={registered}
        />
      </div>

      <img
        src={wordImageSrc}
        alt={
          showDuplicateWarning
            ? '電郵今日已登記'
            : hasInvalidError
              ? '電郵地址無效'
              : '活動說明'
        }
        className="email-page__word"
      />

      <button
        type="button"
        className="email-page__start-btn"
        onClick={handleSubmit}
        disabled={!canStart || submitting}
        aria-label="開始遊戲"
      >
        <img
          src={canStart ? '/assets/Btn_Start.png' : '/assets/Btn_Start_Dim.png'}
          alt=""
          className="email-page__start-img"
        />
      </button>
    </PageLayout>
  );
}
