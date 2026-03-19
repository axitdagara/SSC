import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Set up axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  register: (name, email, password) =>
    api.post('/auth/register', { name, email, password }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
};

export const playerService = {
  getCurrentPlayer: () => api.get('/players/me'),
  updateProfile: (data) => api.put('/players/me', data),
  updateCareerStats: (data) => api.put('/players/me/career-stats', data),
  getPlayer: (id) => api.get(`/players/${id}`),
  getAllPlayers: (skip = 0, limit = 50) =>
    api.get(`/players?skip=${skip}&limit=${limit}`),
  getPremiumPlayers: () => api.get('/players/premium'),
  getTopPerformers: (limit = 10) =>
    api.get(`/players/leaderboard/top-performers?limit=${limit}`),
  getTopWicketTakers: (limit = 10) =>
    api.get(`/players/leaderboard/by-wickets?limit=${limit}`),
};

export const premiumService = {
  upgradePremium: (days = 30) =>
    api.post('/premium/upgrade', { plan_days: days }),
  getPremiumStatus: () => api.get('/premium/status'),
  cancelPremium: () => api.post('/premium/cancel'),
  getPaymentHistory: () => api.get('/premium/payments'),
};

export const performanceService = {
  logPerformance: (data) => api.post('/performance', data),
  updateLog: (logId, data) => api.put(`/performance/${logId}`, data),
  deleteLog: (logId) => api.delete(`/performance/${logId}`),
  getMyLogs: (skip = 0, limit = 20) =>
    api.get(`/performance/my-logs?skip=${skip}&limit=${limit}`),
  getMatchHistory: (skip = 0, limit = 30) =>
    api.get(`/performance/match-history?skip=${skip}&limit=${limit}`),
  getPlayerLogs: (playerId, skip = 0, limit = 20) =>
    api.get(`/performance/player/${playerId}?skip=${skip}&limit=${limit}`),
  getPlayerStats: (playerId) => api.get(`/performance/stats/${playerId}`),
  getAiInsights: (playerId) => api.get(`/performance/ai-insights/${playerId}`),
};

export const dashboardService = {
  getOverview: () => api.get('/dashboard/overview'),
  getExtendedOverview: () => api.get('/dashboard/extended-overview'),
  getFeaturedPlayers: () => api.get('/dashboard/featured-players'),
  getRecentPlayers: () => api.get('/dashboard/recent-players'),
  getTopStats: () => api.get('/dashboard/top-stats'),
  getCharts: () => api.get('/dashboard/charts'),
  getTeamInsights: () => api.get('/dashboard/team-ai-insights'),
  getFundsSummary: () => api.get('/dashboard/funds-summary'),
};

export const adminService = {
  getAllUsers: (skip = 0, limit = 100) =>
    api.get(`/admin/users?skip=${skip}&limit=${limit}`),
  toggleUserPremium: (userId, days = 30) =>
    api.put(`/admin/users/${userId}/premium?days=${days}`),
  deactivateUser: (userId) => api.delete(`/admin/users/${userId}`),
  getSystemStats: () => api.get('/admin/stats'),
  getChatThreads: () => api.get('/admin/chats'),
  getChatThread: (userId) => api.get(`/admin/chats/${userId}`),
  sendAdminMessage: (userId, message) =>
    api.post(`/admin/chats/${userId}`, { message }),
  getMyChat: () => api.get('/admin/my-chat'),
  sendPlayerMessage: (message) => api.post('/admin/my-chat', { message }),
};

export const notificationService = {
  getMine: () => api.get('/notifications/me'),
  checkExpiry: () => api.post('/notifications/check-expiry'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const financeService = {
  getOverview: () => api.get('/finance/overview'),
  getPlayerPayments: () => api.get('/finance/player-payments'),
  getTransactions: () => api.get('/finance/transactions'),
  addGuestFundExpense: (payload) => api.post('/finance/guest-fund', payload),
  addManualCredit: (payload) => api.post('/finance/manual-credit', payload),
};

export const matchesService = {
  createMatch: (payload) => api.post('/matches', payload),
  listMatches: () => api.get('/matches'),
  getMatch: (matchId) => api.get(`/matches/${matchId}`),
  setupTeams: (matchId, payload) => api.post(`/matches/${matchId}/teams`, payload),
  startMatch: (matchId, payload) => api.post(`/matches/${matchId}/start`, payload),
  recordBall: (matchId, payload) => api.post(`/matches/${matchId}/ball`, payload),
  getScoreboard: (matchId, innings = 1) => api.get(`/matches/${matchId}/scoreboard?innings=${innings}`),
  completeMatch: (matchId) => api.post(`/matches/${matchId}/complete`),
};

export default api;
