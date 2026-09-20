const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn(`[api.js] Request to ${endpoint} failed:`, err.message);
    throw err;
  }
}

export const api = {
  getHealth: () => request('/health'),
  getUserProfile: (wallet) => request(`/users/${wallet}`),
  getLoans: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/loans${query ? `?${query}` : ''}`);
  },
  getUserLoans: (wallet) => request(`/loans/user/${wallet}`),
  getLoanById: (loanId) => request(`/loans/${loanId}`),
  getTransactions: (wallet) => request(`/transactions/${wallet}`),
  getAnalytics: () => request('/analytics'),
};
