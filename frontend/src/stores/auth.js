import { defineStore } from 'pinia';
import api from '../services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('lsb_token') || null,
    user: null,
    loading: false,
    error: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin',
    isMahasiswa: (state) => state.user?.role === 'mahasiswa',
  },

  actions: {
    async login(username, password) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.post('/auth/login', { username, password });
        this.token = res.data.accessToken;
        this.user = res.data.user;
        localStorage.setItem('lsb_token', this.token);
        return this.user;
      } catch (err) {
        this.error = err.response?.data?.message || 'Login gagal, periksa kredensial';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('lsb_token');
    },

    async fetchProfile() {
      if (!this.token) return null;
      try {
        const res = await api.get('/auth/profile');
        this.user = res.data.user;
        return this.user;
      } catch {
        this.logout();
        return null;
      }
    },
  },
});
