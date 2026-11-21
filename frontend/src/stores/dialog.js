import { defineStore } from 'pinia';

export const useDialogStore = defineStore('dialog', {
  state: () => ({
    isOpen: false,
    type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'confirm'
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Batal',
    isDanger: false,
    _resolve: null,
  }),

  actions: {
    alert(message, options = {}) {
      return new Promise((resolve) => {
        this.isOpen = true;
        this.message = String(message || '');
        this.type = options.type || 'info';
        this.title = options.title || (
          this.type === 'success' ? 'Berhasil' :
          this.type === 'error' ? 'Terjadi Kesalahan' :
          this.type === 'warning' ? 'Peringatan' : 'Pemberitahuan Sistem'
        );
        this.confirmText = options.confirmText || 'Mengerti';
        this.cancelText = '';
        this.isDanger = false;
        this._resolve = resolve;
      });
    },

    success(message, title = 'Berhasil') {
      return this.alert(message, { type: 'success', title, confirmText: 'OK' });
    },

    error(message, title = 'Terjadi Kesalahan') {
      return this.alert(message, { type: 'error', title, confirmText: 'Tutup' });
    },

    warning(message, title = 'Peringatan') {
      return this.alert(message, { type: 'warning', title, confirmText: 'Mengerti' });
    },

    info(message, title = 'Informasi') {
      return this.alert(message, { type: 'info', title, confirmText: 'OK' });
    },

    confirm(message, options = {}) {
      return new Promise((resolve) => {
        this.isOpen = true;
        this.message = String(message || '');
        this.type = 'confirm';
        this.title = options.title || 'Konfirmasi Tindakan';
        this.confirmText = options.confirmText || 'Ya, Lanjutkan';
        this.cancelText = options.cancelText || 'Batal';
        this.isDanger = options.isDanger ?? true;
        this._resolve = resolve;
      });
    },

    handleConfirm() {
      const res = this._resolve;
      this.isOpen = false;
      this._resolve = null;
      if (res) res(true);
    },

    handleCancel() {
      const res = this._resolve;
      this.isOpen = false;
      this._resolve = null;
      if (res) res(false);
    },
  },
});
