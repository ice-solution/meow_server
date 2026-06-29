import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, setAdminToken } from '../../utils/adminApi';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  if (loading && !overview) {
    return <div className="admin-page admin-page--loading">載入中…</div>;
  }

  const inv = overview?.inventory?.current;
  const players = overview?.players;

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
          <button type="button" className="admin-btn admin-btn--ghost" onClick={handleLogout}>
            登出
          </button>
        </div>
      </header>

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
            sub="Prize2.png · 100–400分"
          />
          <StatCard
            label="今日派發禮物 B"
            value={overview?.giftsDispatched?.B ?? 0}
            sub="Prize1.png · >400分"
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
                  <td>{row.giftNumber ? `No.${row.giftNumber}` : '—'}</td>
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
