<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  Lock,
  User,
  KeyRound,
  LogIn,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  UserCheck
} from 'lucide-vue-next'

const props = defineProps({
  isOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'login-success'])

const authStore = useAuthStore()
const username = ref('admin')
const password = ref('123')
const isLoading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (!username.value.trim()) {
    errorMessage.value = 'Silakan masukkan Username atau NIM Anda.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const user = await authStore.login(username.value.trim(), password.value.trim())
    emit('login-success', user)
    emit('close')
  } catch (err) {
    errorMessage.value = authStore.error || 'Login gagal. Periksa kredensial akun Anda.'
  } finally {
    isLoading.value = false
  }
}

const quickSelectUser = (u) => {
  username.value = u
  password.value = '123'
  errorMessage.value = ''
}
</script>

<template>
  <div v-if="isOpen" class="login-modal-backdrop" @click="emit('close')">
    <div class="login-modal-box glass-card" @click.stop>
      <!-- Close Button -->
      <button class="modal-close-btn" @click="emit('close')">&times;</button>

      <!-- Modal Header (Inspired by ref1.jpg) -->
      <div class="modal-header-visual">
        <div class="emblem-orb">
          <ShieldCheck :size="28" class="text-white" />
        </div>
        <h3 class="modal-title">Masuk ke Sistem</h3>
        <p class="modal-sub">
          Satu pintu masuk terpadu. Peran (Admin atau Mahasiswa) otomatis ditentukan berdasarkan akun/NIM yang Anda masukkan.
        </p>
      </div>

      <!-- Single Unified Form -->
      <form @submit.prevent="handleLogin" class="unified-login-form">
        <div class="form-group">
          <label class="form-label">Username atau NIM Mahasiswa</label>
          <div class="input-icon-wrap">
            <User :size="18" class="input-icon" />
            <input
              type="text"
              v-model="username"
              class="form-input with-icon"
              placeholder="Contoh: admin atau 09020623041"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <div class="label-row">
            <label class="form-label">Kata Sandi</label>
            <span class="password-fixed-badge">Password tetap: <strong>123</strong></span>
          </div>
          <div class="input-icon-wrap">
            <KeyRound :size="18" class="input-icon" />
            <input
              type="password"
              v-model="password"
              class="form-input with-icon"
              placeholder="123"
              required
            />
          </div>
        </div>

        <!-- Quick Select Chips for Convenience -->
        <div class="quick-user-chips">
          <span class="quick-hint">Pilih Akun Cepat:</span>
          <button
            type="button"
            class="user-chip"
            :class="{ active: username === 'admin' }"
            @click="quickSelectUser('admin')"
          >
            <ShieldCheck :size="12" />
            <span>Admin Fakultas (`admin`)</span>
          </button>
          <button
            type="button"
            class="user-chip"
            :class="{ active: username === '09020623041' }"
            @click="quickSelectUser('09020623041')"
          >
            <UserCheck :size="12" />
            <span>Mahasiswa (`09020623041`)</span>
          </button>
        </div>

        <!-- Error Alert -->
        <div v-if="errorMessage" class="error-alert">
          <AlertTriangle :size="16" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Submit Button -->
        <button type="submit" class="btn btn-white-pill btn-block submit-login-btn" :disabled="isLoading">
          <span v-if="isLoading">Memverifikasi Akun...</span>
          <span v-else>Masuk Sekarang</span>
        </button>
      </form>

      <!-- Footer Info -->
      <div class="login-modal-foot">
        <span class="foot-lock">🔒 Terkoneksi Kriptografi SHA-256 &amp; JWT Guard</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: modalFadeIn 0.25s ease;
}

@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.login-modal-box {
  width: 100%;
  max-width: 450px;
  background: linear-gradient(180deg, rgba(28, 21, 24, 0.95) 0%, rgba(14, 11, 13, 0.98) 100%);
  border: 1px solid rgba(235, 137, 91, 0.35);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(218, 101, 86, 0.2);
  border-radius: var(--radius-xl);
  padding: 32px 28px;
  position: relative;
}

.modal-close-btn {
  position: absolute;
  top: 16px;
  right: 20px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  color: #FFFFFF;
}

.modal-header-visual {
  text-align: center;
  margin-bottom: 24px;
}

.emblem-orb {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, var(--c-fd) 0%, var(--c-da) 50%, var(--c-a1) 100%);
  box-shadow: 0 0 25px rgba(235, 137, 91, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 6px;
}

.modal-sub {
  font-size: 0.84rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.unified-login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.password-fixed-badge {
  font-size: 0.72rem;
  color: var(--c-fd);
  background: rgba(253, 183, 115, 0.12);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(253, 183, 115, 0.25);
}

.input-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: var(--c-eb);
  pointer-events: none;
}

.form-input.with-icon {
  padding-left: 44px;
  background: #110D0F;
  border-color: rgba(255, 255, 255, 0.1);
}

.form-input.with-icon:focus {
  border-color: var(--c-eb);
  box-shadow: 0 0 0 3px rgba(235, 137, 91, 0.2);
}

.quick-user-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: -4px;
}

.quick-hint {
  font-size: 0.74rem;
  color: var(--text-faint);
  font-weight: 600;
}

.user-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s ease;
}

.user-chip:hover, .user-chip.active {
  background: rgba(235, 137, 91, 0.18);
  border-color: var(--c-eb);
  color: #FFFFFF;
}

.error-alert {
  padding: 10px 14px;
  background: var(--color-danger-bg);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: var(--radius-md);
  color: #FCA5A5;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-login-btn {
  width: 100%;
  padding: 13px;
  font-size: 0.95rem;
  margin-top: 6px;
}

.login-modal-foot {
  text-align: center;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.foot-lock {
  font-size: 0.72rem;
  color: var(--text-faint);
}
</style>
