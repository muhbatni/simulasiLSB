<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import Navbar from './components/Navbar.vue'
import HeroVerifier from './components/HeroVerifier.vue'
import TheorySection from './components/TheorySection.vue'
import StudentPortal from './components/StudentPortal.vue'
import AdminStudio from './components/AdminStudio.vue'
import ResearchLab from './components/ResearchLab.vue'
import Footer from './components/Footer.vue'
import LoginModal from './components/LoginModal.vue'

const activeTab = ref('verify') // 'verify' | 'student' | 'admin' | 'lab'
const currentUser = ref(null)
const isLoginModalOpen = ref(false)

const changeTab = (tab) => {
  activeTab.value = tab
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const openLoginModal = () => {
  isLoginModalOpen.value = true
}

const closeLoginModal = () => {
  isLoginModalOpen.value = false
}

const handleLoginSuccess = (user) => {
  currentUser.value = user
  isLoginModalOpen.value = false

  // Bedakan routing dari role akun yang masuk
  if (user.role === 'admin') {
    activeTab.value = 'admin'
  } else {
    activeTab.value = 'student'
  }
}

const handleLogout = () => {
  localStorage.removeItem('lsb_token')
  currentUser.value = null
  activeTab.value = 'verify'
}

const checkExistingAuth = async () => {
  const token = localStorage.getItem('lsb_token')
  if (!token) return
  try {
    const res = await axios.get('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    currentUser.value = res.data.user
  } catch {
    localStorage.removeItem('lsb_token')
    currentUser.value = null
  }
}

onMounted(() => {
  checkExistingAuth()
})
</script>

<template>
  <div class="app-root">
    <!-- Background Vertical Slats & Glowing Aurora from ref1.jpg -->
    <div class="bg-slats-layer">
      <div v-for="i in 10" :key="i" class="slat-column"></div>
    </div>
    <div class="aurora-curtain-glow"></div>
    <div class="aurora-flame-strips"></div>

    <!-- Top Navigation Bar (Recognito Layout from ref1.jpg) -->
    <Navbar
      :active-tab="activeTab"
      :user="currentUser"
      @change-tab="changeTab"
      @open-login="openLoginModal"
      @logout="handleLogout"
    />

    <!-- Main Content by Active Tab -->
    <main class="main-body">
      <!-- 1. Home / Public Verification View -->
      <template v-if="activeTab === 'verify'">
        <HeroVerifier
          @navigate-tab="changeTab"
          @open-login="openLoginModal"
        />
        <TheorySection />
      </template>

      <!-- 2. Student Portal View -->
      <template v-else-if="activeTab === 'student'">
        <StudentPortal
          :user="currentUser"
          :initial-query="currentUser?.role === 'mahasiswa' ? currentUser.username : ''"
          @open-login="openLoginModal"
        />
      </template>

      <!-- 3. Admin Studio View -->
      <template v-else-if="activeTab === 'admin'">
        <AdminStudio
          :user="currentUser"
          @login-success="handleLoginSuccess"
        />
      </template>

      <!-- 4. R&D Lab (Bab 3.1.4.4 Compliance) -->
      <template v-else-if="activeTab === 'lab'">
        <ResearchLab />
      </template>
    </main>

    <!-- Unified Single Login Modal -->
    <LoginModal
      :is-open="isLoginModalOpen"
      @close="closeLoginModal"
      @login-success="handleLoginSuccess"
    />

    <!-- Footer with Academic & Author Credentials -->
    <Footer />
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: var(--bg-body);
}

.main-body {
  flex: 1;
  position: relative;
  z-index: 1;
}
</style>
