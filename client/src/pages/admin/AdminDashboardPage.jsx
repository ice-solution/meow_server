import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, setAdminToken } from '../../utils/adminApi';
import { formatGiftNumberLabel } from '../../utils/giftNumber';
import './AdminDashboardPage.css';

function StatCard({ label, value, sub }) {
  return (
    <div className="admin-stat">
      <p className="admin-stat__label">{label}</p>
      <p className="admin-stat__value">{value}</p>
      {sub && <p className="admin-stat__sub">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [dateKey, setDateKey] = useState('');
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [emails, setEmails] = useState({ items: [], total: 0 });
  const [emailPage, setEmailPage] = useState(1);
  const [counterA, setCounterA] = useState('');
  const [counterB, setCounterB] = useState('');
  const [minPrizeScore, setMinPrizeScore] = useState('');
  const [giftAMaxScore, setGiftAMaxScore] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingScores, setSavingScores] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearStep, setClearStep] = useState(1);
  const [clearPhrase, setClearPhrase] = useState('');
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, hist, em] = await Promise.all([
        adminApi.overview(dateKey || undefined),
        adminApi.dailyHistory(7),
        adminApi.emails({ dateKey: dateKey || undefined, page: emailPage, limit: 30 }),
      ]);
      setOverview(ov.data);
      setHistory(hist.data);
      setEmails(em.data);
      setCounterA(String(ov.data.counters.giftNumberA));
      setCounterB(String(ov.data.counters.giftNumberB));
      setMinPrizeScore(String(ov.data.scoreSettings?.minPrizeScore ?? 100));
      setGiftAMaxScore(String(ov.data.scoreSettings?.giftAMaxScore ?? 400));
      if (!dateKey) setDateKey(ov.data.dateKey);
    } catch (err) {
      setError(err.message);
      if (err.message.includes('登入')) navigate('/admin/login', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [dateKey, emailPage, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = () => {
    setAdminToken(null);
    navigate('/admin/login', { replace: true });
  };

  const handleSaveCounters = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await adminApi.updateCounters({
        giftNumberA: Number(counterA),
        giftNumberB: Number(counterB),
      });
      setCounterA(String(data.giftNumberA));
      setCounterB(String(data.giftNumberB));
      setMessage('序號已更新');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScoreSettings = async (e) => {
    e.preventDefault();
    setSavingScores(true);
    setMessage('');
    setError('');
    try {
      const { data } = await adminApi.updateGiftScoreSettings({
        minPrizeScore: Number(minPrizeScore),
        giftAMaxScore: Number(giftAMaxScore),
      });
      setMinPrizeScore(String(data.minPrizeScore));
      setGiftAMaxScore(String(data.giftAMaxScore));
      setMessage('分數門檻已更新');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingScores(false);
    }
  };

  const handleSendClientEmail = async () => {
    if (!window.confirm('確定要立即發送全部 Email 用戶列表 CSV 給客戶？')) {
      return;
    }
    setSendingEmail(true);
    setMessage('');
    setError('');
    try {
      const res = await adminApi.sendClientEmail();
      setMessage(res.message || '電郵已發送');
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    setMessage('');
    setError('');
    try {
      const { filename } = await adminApi.downloadEmailCsv();
      setMessage(`已下載 ${filename}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const openClearModal = () => {
    setClearStep(1);
    setClearPhrase('');
    setClearModalOpen(true);
  };

  const closeClearModal = () => {
    if (clearing) return;
    setClearModalOpen(false);
    setClearStep(1);
    setClearPhrase('');
  };

  const handleClearData = async () => {
    if (clearPhrase !== '清除所有資料') {
      setError('請輸入正確的確認文字');
      return;
    }
    setClearing(true);
    setMessage('');
    setError('');
    try {
      const res = await adminApi.clearData({
        confirmStep1: 'true',
        confirmStep2: 'true',
        confirmPhrase: clearPhrase,
      });
      setMessage(res.message || '資料已清除');
      setClearModalOpen(false);
      setClearStep(1);
      setClearPhrase('');
      setEmailPage(1);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  if (loading && !overview) {
    return <div className="admin-page admin-page--loading">載入中…</div>;
  }

  const inv = overview?.inventory?.current;
  const players = overview?.players;
  const scoreRules = overview?.scoreSettings?.rules;
  const noPrizeMax = Math.max(0, Number(minPrizeScore || 0) - 1);
  const giftBMin = Number(giftAMaxScore || 0) + 1;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>WeOW Admin</h1>
          <p>Hunger Run 2026 · 香港時間 {overview?.dateKey}</p>
        </div>
        <div className="admin-header__actions">
          <label className="admin-header__date">
            查詢日期
            <input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          </label>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={load}>
            重新整理
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
          >
            {downloadingCsv ? '下載中…' : '下載 CSV'}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={handleSendClientEmail}
            disabled={sendingEmail}
          >
            {sendingEmail ? '發送中…' : '發送客戶電郵'}
          </button>
          <button type="button" className="admin-btn admin-btn--danger" onClick={openClearModal}>
            清除資料
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={handleLogout}>
            登出
          </button>
        </div>
      </header>

      {clearModalOpen && (
        <div className="admin-modal" role="dialog" aria-modal="true">
          <div className="admin-modal__backdrop" onClick={closeClearModal} />
          <div className="admin-modal__panel">
            <h3>清除所有資料</h3>
            {clearStep === 1 && (
              <>
                <p>第一次確認：此操作會刪除所有 Email 登記、派發禮物記錄、遊戲 session 及每日庫存。</p>
                <p className="admin-modal__warn">禮物分數門檻設定不會被清除。</p>
                <div className="admin-modal__actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={closeClearModal}>
                    取消
                  </button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => setClearStep(2)}>
                    我了解，繼續
                  </button>
                </div>
              </>
            )}
            {clearStep === 2 && (
              <>
                <p>第二次確認：序號會重設為 0、0，下一份禮物將由 000001 開始。</p>
                <p className="admin-modal__warn">此操作無法復原。</p>
                <div className="admin-modal__actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setClearStep(1)}>
                    返回
                  </button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => setClearStep(3)}>
                    仍要繼續
                  </button>
                </div>
              </>
            )}
            {clearStep === 3 && (
              <>
                <p>第三次確認：請輸入「清除所有資料」以完成清除。</p>
                <label className="admin-modal__input">
                  確認文字
                  <input
                    type="text"
                    value={clearPhrase}
                    onChange={(e) => setClearPhrase(e.target.value)}
                    placeholder="清除所有資料"
                    autoComplete="off"
                  />
                </label>
                <div className="admin-modal__actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setClearStep(2)}>
                    返回
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={handleClearData}
                    disabled={clearing || clearPhrase !== '清除所有資料'}
                  >
                    {clearing ? '清除中…' : '確認清除所有資料'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && <p className="admin-alert admin-alert--error">{error}</p>}
      {message && <p className="admin-alert admin-alert--ok">{message}</p>}

      <section className="admin-section">
        <h2>今日總覽</h2>
        <div className="admin-stats">
          <StatCard
            label="今日登記人數"
            value={players?.registrations ?? 0}
            sub={`不重複 email：${players?.uniqueEmails ?? 0}`}
          />
          <StatCard
            label="今日完成遊戲"
            value={players?.gamesCompleted ?? 0}
          />
          <StatCard
            label="今日派發禮物 A"
            value={overview?.giftsDispatched?.A ?? 0}
            sub={`Prize2.png · ${scoreRules?.giftA ?? `${minPrizeScore}–${giftAMaxScore}`}分`}
          />
          <StatCard
            label="今日派發禮物 B"
            value={overview?.giftsDispatched?.B ?? 0}
            sub={`Prize1.png · ${scoreRules?.giftB ?? `${giftBMin}+`}分`}
          />
          <StatCard
            label="禮物 A 餘額"
            value={inv?.giftARemaining ?? 0}
            sub={`已派：${inv?.giftAIssued ?? 0}`}
          />
          <StatCard
            label="禮物 B 餘額"
            value={inv?.giftBRemaining ?? 0}
            sub={`已派：${inv?.giftBIssued ?? 0}`}
          />
          <StatCard
            label="累計可派餘額"
            value={inv?.totalRemaining ?? 0}
            sub={
              inv?.withinHours
                ? `派發中 ${inv.distributionStart}–${inv.distributionEnd}`
                : `非派發時段 ${inv?.distributionStart}–${inv?.distributionEnd}`
            }
          />
        </div>
      </section>

      <section className="admin-section">
        <h2>禮物分數門檻</h2>
        <p className="admin-hint">
          設定達標分數區間。低於「最低領獎分數」不派獎；介乎最低至禮物 A 最高分（含）派禮物 A；再高派禮物 B。
        </p>
        <form className="admin-counter-form admin-score-form" onSubmit={handleSaveScoreSettings}>
          <label>
            最低領獎分數
            <input
              type="number"
              min="0"
              step="1"
              value={minPrizeScore}
              onChange={(e) => setMinPrizeScore(e.target.value)}
            />
          </label>
          <label>
            禮物 A 最高分（含）
            <input
              type="number"
              min="0"
              step="1"
              value={giftAMaxScore}
              onChange={(e) => setGiftAMaxScore(e.target.value)}
            />
          </label>
          <div className="admin-score-form__preview">
            <p>無獎：0–{noPrizeMax} 分</p>
            <p>禮物 A（Prize2）：{minPrizeScore || '—'}–{giftAMaxScore || '—'} 分</p>
            <p>禮物 B（Prize1）：{giftBMin || '—'}+ 分</p>
          </div>
          <button type="submit" className="admin-btn" disabled={savingScores}>
            {savingScores ? '儲存中…' : '儲存分數門檻'}
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>禮物序號設定</h2>
        <p className="admin-hint">
          設定目前最後已派發編號（整數）。下次派發將為該數字 +1，格式 000001。
        </p>
        <form className="admin-counter-form" onSubmit={handleSaveCounters}>
          <label>
            禮物 A 序號
            <input
              type="number"
              min="0"
              value={counterA}
              onChange={(e) => setCounterA(e.target.value)}
            />
            <span className="admin-counter-form__preview">
              顯示：{String(counterA || 0).padStart(6, '0')}
            </span>
          </label>
          <label>
            禮物 B 序號
            <input
              type="number"
              min="0"
              value={counterB}
              onChange={(e) => setCounterB(e.target.value)}
            />
            <span className="admin-counter-form__preview">
              顯示：{String(counterB || 0).padStart(6, '0')}
            </span>
          </label>
          <button type="submit" className="admin-btn" disabled={saving}>
            {saving ? '儲存中…' : '儲存序號'}
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>近 7 日統計</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>登記</th>
                <th>不重複 Email</th>
                <th>派發 A</th>
                <th>派發 B</th>
                <th>A 餘額</th>
                <th>B 餘額</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.dateKey}>
                  <td>{row.dateKey}</td>
                  <td>{row.players.registrations}</td>
                  <td>{row.players.uniqueEmails}</td>
                  <td>{row.giftAIssued}</td>
                  <td>{row.giftBIssued}</td>
                  <td>{row.giftARemaining}</td>
                  <td>{row.giftBRemaining}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-table__empty">
                    暫無資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section__head">
          <h2>Email 用戶列表</h2>
          <span>共 {emails.total} 筆</span>
        </div>
        <p className="admin-hint">
          每日 00:00（香港時間）會自動將全部 Email 用戶列表 CSV 發送至客戶電郵；亦可使用上方「發送客戶電郵」人手發送。
        </p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>日期</th>
                <th>可領獎</th>
                <th>分數</th>
                <th>禮物</th>
                <th>編號</th>
                <th>狀態</th>
                <th>登記時間</th>
              </tr>
            </thead>
            <tbody>
              {emails.items.map((row) => (
                <tr key={`${row.sessionId}-${row.email}`}>
                  <td>{row.email}</td>
                  <td>{row.dateKey}</td>
                  <td>{row.canClaimPrize ? '是' : '否'}</td>
                  <td>{row.score ?? '—'}</td>
                  <td>{row.giftType ?? '—'}</td>
                  <td>{formatGiftNumberLabel(row.giftNumber) || '—'}</td>
                  <td>{row.giftStatus ?? '—'}</td>
                  <td>{row.registeredAt ? new Date(row.registeredAt).toLocaleString('zh-HK') : '—'}</td>
                </tr>
              ))}
              {emails.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="admin-table__empty">
                    暫無資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={emailPage <= 1}
            onClick={() => setEmailPage((p) => p - 1)}
          >
            上一頁
          </button>
          <span>第 {emailPage} 頁</span>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={emails.items.length < 30}
            onClick={() => setEmailPage((p) => p + 1)}
          >
            下一頁
          </button>
        </div>
      </section>
    </div>
  );
}
