import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import { usePlayerSocket } from '../utils/usePlayerSocket';
import './SorryGatePage.css';

export default function SorryGatePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sig = searchParams.get('sig') || '';
  const code = searchParams.get('code') || '';

  usePlayerSocket({ sessionId, sig, code });

  const handleStart = () => {
    const params = new URLSearchParams(searchParams);
    params.set('flow', 'sold-out');
    navigate(`/play/${sessionId}/terms?${params.toString()}`);
  };

  const startButton = (
    <button
      type="button"
      className="sorry-gate-page__start-btn"
      onClick={handleStart}
      aria-label="開始遊戲"
    >
      <img src="/assets/Btn_Start.png" alt="" className="sorry-gate-page__start-img" />
    </button>
  );

  return (
    <PageLayout footerSrc="/assets/Deco1.png" footerOverlay={startButton}>
      <img src="/assets/Title.png" alt="Hunger Run 2026" className="page-layout__title sorry-gate-page__title" />
      <img src="/assets/Sorry.png" alt="是日禮品經已派發完畢" className="sorry-gate-page__sorry" />
      <img src="/assets/SorryChara.png" alt="" className="sorry-gate-page__chara" />
    </PageLayout>
  );
}
