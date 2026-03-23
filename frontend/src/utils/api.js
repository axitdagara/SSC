import axios from 'axios';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  firebaseAuth,
  firebaseDb,
  firebaseGoogleProvider,
  isFirebaseConfigured,
} from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Set up axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('token');

  if (isFirebaseConfigured && firebaseAuth?.currentUser) {
    const firebaseToken = await firebaseAuth.currentUser.getIdToken();
    if (firebaseToken) {
      token = firebaseToken;
      localStorage.setItem('token', firebaseToken);
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const hydrateLocalUserFromBackend = async (accessToken) => {
  if (accessToken) {
    localStorage.setItem('token', accessToken);
  }

  try {
    const profile = await api.get('/players/me');
    localStorage.setItem('user', JSON.stringify(profile.data));
    window.dispatchEvent(new Event('authchange'));

    return {
      access_token: accessToken,
      token_type: 'bearer',
      user: profile.data,
    };
  } catch (error) {
    // If backend profile fetch fails, create a minimal user object from Firebase user state.
    if (isFirebaseConfigured && firebaseAuth?.currentUser) {
      const firebaseUser = firebaseAuth.currentUser;

      if (firebaseUser) {
        const minimalUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'player'),
          role: 'player',
          is_active: true,
        };
        
        localStorage.setItem('user', JSON.stringify(minimalUser));
        window.dispatchEvent(new Event('authchange'));
        
        return {
          access_token: accessToken,
          token_type: 'bearer',
          user: minimalUser,
        };
      }
    }
    
    // Re-throw the original error if fallback also fails
    throw error;
  }
};

export const authService = {
  register: async (name, email, password) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return api.post('/auth/register', { name, email, password });
    }

    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }

      if (firebaseDb) {
        await setDoc(
          doc(firebaseDb, 'users', cred.user.uid),
          {
            uid: cred.user.uid,
            email,
            name: name || email.split('@')[0],
            role: 'player',
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      const accessToken = await cred.user.getIdToken();
      return { data: await hydrateLocalUserFromBackend(accessToken) };
    } catch (error) {
      const message = error?.message || 'Registration failed';
      throw { response: { data: { detail: message } } };
    }

  },

  login: async (email, password) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      return api.post('/auth/login', { email, password });
    }

    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const accessToken = await cred.user.getIdToken();
      return { data: await hydrateLocalUserFromBackend(accessToken) };
    } catch (error) {
      throw { response: { data: { detail: error?.message || 'Login failed' } } };
    }
  },

  loginWithGoogle: async () => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      throw { response: { data: { detail: 'Firebase is not configured' } } };
    }

    try {
      const cred = await signInWithPopup(firebaseAuth, firebaseGoogleProvider);

      if (firebaseDb) {
        await setDoc(
          doc(firebaseDb, 'users', cred.user.uid),
          {
            uid: cred.user.uid,
            email: cred.user.email,
            name: cred.user.displayName || (cred.user.email ? cred.user.email.split('@')[0] : 'player'),
            role: 'player',
            lastLoginAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      const accessToken = await cred.user.getIdToken();
      return { data: await hydrateLocalUserFromBackend(accessToken) };
    } catch (error) {
      throw { response: { data: { detail: error?.message || 'Google login failed' } } };
    }
  },

  completeSocialLogin: async () => {
    if (!isFirebaseConfigured || !firebaseAuth?.currentUser) {
      return null;
    }

    const accessToken = await firebaseAuth.currentUser.getIdToken();
    if (!accessToken) {
      return null;
    }

    return { data: await hydrateLocalUserFromBackend(accessToken) };
  },

  logout: async () => {
    if (isFirebaseConfigured && firebaseAuth) {
      await signOut(firebaseAuth);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('authchange'));
  },
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
