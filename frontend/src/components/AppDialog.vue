<script setup>
import { computed, onMounted, onUnmounted, nextTick, watch, ref } from 'vue'
import { useDialogStore } from '../stores/dialog'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Info,
  X
} from 'lucide-vue-next'

const dialog = useDialogStore()
const confirmBtnRef = ref(null)

const isConfirm = computed(() => dialog.type === 'confirm')

const orbClass = computed(() => {
  switch (dialog.type) {
    case 'success':
      return 'orb-success'
    case 'error':
      return 'orb-error'
    case 'warning':
      return 'orb-warning'
    case 'confirm':
      return dialog.isDanger ? 'orb-danger' : 'orb-confirm'
    default:
      return 'orb-info'
  }
})

const handleKeydown = (e) => {
  if (!dialog.isOpen) return
  if (e.key === 'Escape') {
    dialog.handleCancel()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    dialog.handleConfirm()
  }
}

watch(
  () => dialog.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        confirmBtnRef.value?.focus()
      })
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="dialog.isOpen" class="custom-dialog-backdrop" @click="dialog.handleCancel">
        <div class="custom-dialog-box glass-card" @click.stop>
          <!-- Close Button (X) -->
          <button class="dialog-close-btn" @click="dialog.handleCancel" title="Tutup">
            <X :size="18" />
          </button>

          <!-- Icon Orb -->
          <div class="dialog-orb" :class="orbClass">
            <CheckCircle2 v-if="dialog.type === 'success'" :size="30" class="text-white" />
            <XCircle v-else-if="dialog.type === 'error'" :size="30" class="text-white" />
            <AlertTriangle v-else-if="dialog.type === 'warning'" :size="30" class="text-white" />
            <HelpCircle v-else-if="dialog.type === 'confirm'" :size="30" class="text-white" />
            <Info v-else :size="30" class="text-white" />
          </div>

          <!-- Title & Message -->
          <div class="dialog-content">
            <h3 class="dialog-title">{{ dialog.title }}</h3>
            <p class="dialog-message">{{ dialog.message }}</p>
          </div>

          <!-- Actions -->
          <div class="dialog-actions" :class="{ 'actions-split': isConfirm }">
            <button
              v-if="isConfirm"
              type="button"
              class="btn btn-secondary dialog-btn"
              @click="dialog.handleCancel"
            >
              {{ dialog.cancelText || 'Batal' }}
            </button>
            <button
              ref="confirmBtnRef"
              type="button"
              class="btn dialog-btn"
              :class="dialog.isDanger && isConfirm ? 'btn-danger' : 'btn-primary'"
              @click="dialog.handleConfirm"
            >
              {{ dialog.confirmText || (isConfirm ? 'Ya, Lanjutkan' : 'Mengerti') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.custom-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 6, 8, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 999999 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.custom-dialog-box {
  width: 100%;
  max-width: 440px;
  background: linear-gradient(180deg, rgba(28, 21, 24, 0.96) 0%, rgba(14, 11, 13, 0.98) 100%);
  border: 1px solid rgba(235, 137, 91, 0.35);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(218, 101, 86, 0.2);
  border-radius: var(--radius-xl, 20px);
  padding: 28px 24px 24px;
  position: relative;
  text-align: center;
}

.dialog-close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  background: transparent;
  border: none;
  color: var(--text-muted, #9e979a);
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-close-btn:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.08);
}

.dialog-orb {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.orb-success {
  background: radial-gradient(circle at 35% 35%, #34d399 0%, #10b981 60%, #047857 100%);
  box-shadow: 0 0 30px rgba(16, 185, 129, 0.45);
}

.orb-error {
  background: radial-gradient(circle at 35% 35%, #f87171 0%, #ef4444 60%, #b91c1c 100%);
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.45);
}

.orb-warning {
  background: radial-gradient(circle at 35% 35%, #fbbf24 0%, #f59e0b 60%, #d97706 100%);
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.45);
}

.orb-confirm, .orb-info {
  background: radial-gradient(circle at 35% 35%, var(--c-fd, #FDB773) 0%, var(--c-da, #DA6556) 55%, var(--c-a1, #A13854) 100%);
  box-shadow: 0 0 30px rgba(235, 137, 91, 0.45);
}

.orb-danger {
  background: radial-gradient(circle at 35% 35%, #fb7185 0%, #e11d48 60%, #9f1239 100%);
  box-shadow: 0 0 30px rgba(225, 29, 72, 0.45);
}

.dialog-content {
  margin-bottom: 24px;
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 8px;
}

.dialog-message {
  font-size: 0.92rem;
  color: var(--text-muted, #ccc);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.actions-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.dialog-btn {
  padding: 10px 18px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: var(--radius-md, 10px);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-danger {
  background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
  color: #FFFFFF;
  border: 1px solid rgba(244, 63, 94, 0.5);
  box-shadow: 0 4px 15px rgba(225, 29, 72, 0.35);
}

.btn-danger:hover {
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
  box-shadow: 0 6px 20px rgba(225, 29, 72, 0.5);
}

/* Transitions */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.22s ease;
}

.dialog-fade-enter-active .custom-dialog-box,
.dialog-fade-leave-active .custom-dialog-box {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .custom-dialog-box {
  opacity: 0;
  transform: scale(0.92) translateY(12px);
}

.dialog-fade-leave-to .custom-dialog-box {
  opacity: 0;
  transform: scale(0.95);
}
</style>
