<script setup>
import { ref } from 'vue'
import { ShieldCheck, UserCheck, Terminal, Award, LogIn, LogOut, CheckCircle2, Lock } from 'lucide-vue-next'

const props = defineProps({
  activeTab: { type: String, default: 'verify' },
  user: { type: Object, default: null }
})

const emit = defineEmits(['change-tab', 'open-login', 'logout'])
</script>

<template>
  <header class="navbar-container">
    <div class="nav-inner container">
      <!-- Left: Brand Logo (Recognito Style from ref1.jpg) -->
      <div class="brand-group" @click="emit('change-tab', 'verify')">
        <div class="brand-glyph">
          <div class="glyph-circle"></div>
        </div>
        <div class="brand-name">
          <span class="brand-text">SertifikatSec</span>
          <span class="brand-dot">.</span>
        </div>
      </div>

      <!-- Center: Floating Glass Pill Nav Menu (ref1.jpg) -->
      <nav class="floating-pill-nav">
        <button
          class="pill-nav-item"
          :class="{ active: activeTab === 'verify' }"
          @click="emit('change-tab', 'verify')"
        >
          <span>Home</span>
        </button>

        <button
          class="pill-nav-item"
          :class="{ active: activeTab === 'student' }"
          @click="emit('change-tab', 'student')"
        >
          <span>Mahasiswa</span>
        </button>

        <button
          v-if="user && user.role === 'admin'"
          class="pill-nav-item"
          :class="{ active: activeTab === 'admin' }"
          @click="emit('change-tab', 'admin')"
        >
          <span>Admin Studio</span>
        </button>

        <button
          class="pill-nav-item"
          :class="{ active: activeTab === 'lab' }"
          @click="emit('change-tab', 'lab')"
        >
          <span>Lab Riset</span>
          <span class="nav-micro-dot"></span>
        </button>
      </nav>

      <!-- Right: Unified Action CTA Button (ref1.jpg 'Join Beta' Style) -->
      <div class="nav-right-cta">
        <template v-if="user">
          <div class="logged-user-pill" @click="emit('change-tab', user.role === 'admin' ? 'admin' : 'student')">
            <div class="user-avatar-circle">{{ user.name.charAt(0) }}</div>
            <div class="user-text-meta">
              <span class="user-name-label">{{ user.name.split(' ')[0] }}</span>
              <span class="user-role-badge" :class="user.role">{{ user.role.toUpperCase() }}</span>
            </div>
          </div>
          <button class="logout-icon-btn" @click="emit('logout')" title="Keluar">
            <LogOut :size="15" />
          </button>
        </template>
        <template v-else>
          <button class="btn btn-white-pill nav-cta-btn" @click="emit('open-login')">
            <span>Masuk Akun</span>
          </button>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.navbar-container {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 16px 0;
  background: rgba(8, 7, 8, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

/* Brand Glyph (Overlapping glowing rings like in ref1.jpg) */
.brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-glyph {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--c-fd) 0%, var(--c-eb) 50%, var(--c-da) 100%);
  box-shadow: 0 0 12px rgba(235, 137, 91, 0.6);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.glyph-circle {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #090708;
  position: absolute;
  left: 2px;
}

.brand-name {
  font-size: 1.22rem;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: -0.3px;
}

.brand-dot {
  color: var(--c-eb);
}

/* Floating Glass Pill Navigation Bar (Exact center pill from ref1.jpg) */
.floating-pill-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(22, 17, 19, 0.7);
  padding: 5px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.pill-nav-item {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 500;
  padding: 6px 16px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.pill-nav-item:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.06);
}

.pill-nav-item.active {
  background: rgba(255, 255, 255, 0.12);
  color: #FFFFFF;
  font-weight: 700;
}

.nav-micro-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-fd);
  box-shadow: 0 0 5px var(--c-fd);
}

/* Right CTA */
.nav-right-cta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-cta-btn {
  font-size: 0.86rem;
  padding: 8px 20px;
}

.logged-user-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 12px 4px 6px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.2s ease;
}

.logged-user-pill:hover {
  border-color: var(--c-eb);
}

.user-avatar-circle {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--grad-primary);
  color: #FFFFFF;
  font-weight: 800;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-text-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-name-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #FFFFFF;
}

.user-role-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
}

.user-role-badge.admin {
  background: rgba(218, 101, 86, 0.3);
  color: var(--c-fd);
}

.user-role-badge.mahasiswa {
  background: rgba(16, 185, 129, 0.25);
  color: #34D399;
}

.logout-icon-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-icon-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #F87171;
  border-color: rgba(239, 68, 68, 0.4);
}

@media (max-width: 820px) {
  .floating-pill-nav {
    display: none;
  }
}
</style>
