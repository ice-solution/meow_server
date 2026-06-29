import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import PageLayout from '../components/PageLayout';
import { sessionApiUrl } from '../utils/sessionQuery';
import { proceedAfterTerms, resolvePostTermsPath } from '../utils/playFlow';
import './TermsPage.css';

const TERMS_TEXT = `1. 恒基陽光物業管理有限公司為是次活動之主辦機構。
2. 卡路里提款機為自助裝置，參加者須自行注意安全，並建議穿著合適鞋履及服裝參與活動。
3. 每位顧客參與次數不限，但每日只限領獎乙次，並必須於即日內前往商場禮賓部 (服務時間 - 上午10時30分至晚上7時30分)領取獎品乙份。參加者請自律遵守。如有違反活動條款及細則，作出不誠實參與或以任何形式作弊，一經發現，主辦機構有權取消參加者資格。
4. 十二歲或以下的參加者，必須由十八歲或以上人士陪同下方可參加。
5. 參加者輪候期間，請尊重其他參加者。請勿推撞或擠擁其他參加者，也請勿超前或插隊。敬請與同行的親友一起排隊，遲來者不得插隊，如參加者於輪候期間離隊，則須重新排隊輪候。
6. 卡路里提款裝置設有台階，參加者請小心上落，注意安全。請勿蓄意破壞卡路里提款機及相關腳踏裝置。
7. 參加者需提供電郵地址作活動登記之用，電郵地址只供主辦機構處理本活動使用。資料將予以保密並不作其他用途。
8. 請小心保管隨身個人物品及時刻照顧同行之兒童。
9. 任何人士 (不論是否受藥物或酒精影響) 如在參與活動期間，騷擾其他參加者或拒絕遵守主辦單位已列明之條款及規則，工作人員和管理處職員有權要求違規者即時離場。
10. 參加者明白及同意在參與這項活動過程中可能會有一定的意外風險，如遇上任何事故或因參加者的疏忽、健康或體能狀況不足，而引致傷亡或財物損失，主辦單位概不承擔任何責任。
11. 患有心臟病、高血壓、癲癇症、身體不適、受藥物或酒精影響等人士，以及孕婦不建議參與此遊戲。
12. 參加者如蓄意破壞場內設施而引致發生任何故障或損壞，主辦單位保留權利向該參加者索償維修費用。
13. 參加者須同意主辦單位使用其參與此活動所拍攝之照片/錄像作是次活動的宣傳及推廣用途。
14. 主辦單位保留權利在不作事先通知下取消、暫停、延遲舉行活動、或更改任何條款和規則。因該取消、暫停、延遲或更改而引致的任何直接或間接的損失或後果，主辦單位概不負責。
15. 主辦機構、所有協辦單位及承辦商及主辦商場任何員工均不能參與是次活動，以示公允。
16. 如有任何爭議，主辦單位擁有最終決定權。`;

export default function TermsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';
  const code = searchParams.get('code') || '';
  const flow = searchParams.get('flow') || '';
  const queryStr = searchParams.toString();
  const scrollRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  const checkScrollBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    setScrolledToBottom(atBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScrollBottom();
    el.addEventListener('scroll', checkScrollBottom);
    return () => el.removeEventListener('scroll', checkScrollBottom);
  }, [checkScrollBottom]);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(sessionApiUrl(sessionId, '', sig, code));
        if (!res.ok) return;
        const data = await res.json();
        const next = resolvePostTermsPath(data);
        if (next) {
          navigate(`/play/${sessionId}/${next}${queryStr ? `?${queryStr}` : ''}`, { replace: true });
        }
      } catch {
        // ignore
      }
    }
    checkSession();
  }, [sessionId, navigate, sig, code, queryStr, flow]);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io({ path: '/socket.io' });

    socket.on('connect', () => {
      socket.emit('player:join', { sessionId, sig, code });
    });

    socket.on('session:error', (data) => {
      setSessionError(data.error);
    });

    return () => socket.disconnect();
  }, [sessionId, sig, code]);

  const handleCheckboxClick = async () => {
    if (!scrolledToBottom || agreed || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(sessionApiUrl(sessionId, '/accept-terms', sig, code), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow: flow || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '提交失敗');
      }
      setAgreed(true);
      setTimeout(async () => {
        try {
          await proceedAfterTerms({ sessionId, sig, code, navigate });
        } catch (err) {
          setSessionError(err.message);
        }
      }, 400);
    } catch (err) {
      setSessionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionError) {
    return (
      <PageLayout>
        <div className="terms-page__error">
          <p>{sessionError}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout mainClassName="page-layout__main--terms">
      <img src="/assets/Logo.png" alt="Logo" className="page-layout__logo" />
      <img src="/assets/Title.png" alt="Hunger Run 2026" className="page-layout__title" />
      <img src="/assets/Inst_TandC.png" alt="條款及細則說明" className="terms-page__inst" />

      <div className="terms-page__box" ref={scrollRef}>
        <div className="terms-page__text">
          {TERMS_TEXT.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      <div className="terms-page__agree-section">
        <button
          type="button"
          className={`terms-page__checkbox ${!scrolledToBottom ? 'terms-page__checkbox--disabled' : ''} ${agreed ? 'terms-page__checkbox--checked' : ''}`}
          onClick={handleCheckboxClick}
          disabled={!scrolledToBottom || agreed || submitting}
          aria-label="同意活動條款、細則及確定參與"
        >
          <img src="/assets/TandC_Checkbox.png" alt="" className="terms-page__checkbox-img" />
          {agreed && (
            <span className="terms-page__paw-wrap" aria-hidden="true">
              <img src="/assets/Paw.png" alt="" className="terms-page__paw" />
            </span>
          )}
        </button>
        {!scrolledToBottom && (
          <p className="terms-page__hint">請先閱讀並捲動至條款底部</p>
        )}
      </div>
    </PageLayout>
  );
}
