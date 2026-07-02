const TOKEN_KEY = 'weow_admin_token';

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function adminFetch(path, options = {}) {
  const token = getAdminToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/admin-panel${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    setAdminToken(null);
    throw new Error(data.message || '未登入');
  }
  if (!res.ok) {
    throw new Error(data.message || '請求失敗');
  }
  return data;
}

export const adminApi = {
  login(username, password) {
    return adminFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me() {
    return adminFetch('/me');
  },
  overview(dateKey) {
    const q = dateKey ? `?dateKey=${encodeURIComponent(dateKey)}` : '';
    return adminFetch(`/overview${q}`);
  },
  emails({ dateKey, page, limit } = {}) {
    const params = new URLSearchParams();
    if (dateKey) params.set('dateKey', dateKey);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const q = params.toString();
    return adminFetch(`/emails${q ? `?${q}` : ''}`);
  },
  dailyHistory(days = 7) {
    return adminFetch(`/daily-history?days=${days}`);
  },
  getCounters() {
    return adminFetch('/counters');
  },
  updateCounters(payload) {
    return adminFetch('/counters', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  getGiftScoreSettings() {
    return adminFetch('/gift-score-settings');
  },
  updateGiftScoreSettings(payload) {
    return adminFetch('/gift-score-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
