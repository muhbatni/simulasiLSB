<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '../services/api'
import { useDialogStore } from '../stores/dialog'
import {
  Search,
  Download,
  Eye,
  Award,
  Calendar,
  CheckCircle2,
  FileCheck,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Lock,
  LogIn,
  AlertTriangle,
  UserCheck
} from 'lucide-vue-next'

const props = defineProps({
  user: { type: Object, default: null },
  initialQuery: { type: String, default: '' },
})

const emit = defineEmits(['open-login'])
const dialog = useDialogStore()

const searchQuery = ref(props.initialQuery || '')
const certificates = ref([])
const isLoading = ref(false)
const selectedPreviewCert = ref(null)
const previewImageUrl = ref(null)

// Server-side Verification State (F-08 Skenario 4)
const isVerifyingStored = ref(false)
const storedVerificationResult = ref(null)

const loadMyCertificates = async () => {
  if (!localStorage.getItem('lsb_token')) {
    certificates.value = []
    return
  }

  isLoading.value = true
  try {
    const qParam = searchQuery.value.trim() ? `?q=${encodeURIComponent(searchQuery.value.trim())}` : ''
    const res = await api.get(`/me/certificates${qParam}`)
    certificates.value = res.data
  } catch (err) {
    console.error('Gagal memuat sertifikat mahasiswa:', err)
    certificates.value = []
  } finally {
    isLoading.value = false
  }
}

const openPreview = async (cert) => {
  selectedPreviewCert.value = cert
  storedVerificationResult.value = null
  previewImageUrl.value = null

  try {
    const res = await api.get(`/certificates/${cert.id}/download`, {
      responseType: 'blob',
    })
    previewImageUrl.value = URL.createObjectURL(res.data)
  } catch (e) {
    console.warn('Gagal memuat pratinjau gambar:', e)
  }
}

const closePreview = () => {
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value)
  }
  selectedPreviewCert.value = null
  storedVerificationResult.value = null
  previewImageUrl.value = null
}

const downloadCertificate = async (cert) => {
  try {
    const res = await api.get(`/certificates/${cert.id}/download`, {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'image/png' }))
    const link = document.createElement('a')
    link.href = url
    const safeFilename = `Sertifikat-${cert.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${cert.certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`
    link.setAttribute('download', safeFilename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    dialog.error(err.response?.data?.message || 'Gagal mengunduh berkas sertifikat')
  }
}

// F-08 Skenario 4: Klik Verifikasi untuk mengekstrak dan memvalidasi berkas tersimpan
const verifyStoredCertificate = async (certId) => {
  isVerifyingStored.value = true
  storedVerificationResult.value = null
  try {
    const res = await api.post(`/me/certificates/${certId}/verify`, {})
    storedVerificationResult.value = res.data
  } catch (err) {
    dialog.error(err.response?.data?.message || 'Gagal memverifikasi berkas sertifikat di peladen')
  } finally {
    isVerifyingStored.value = false
  }
}

watch(
  () => props.user,
  () => {
    loadMyCertificates()
  }
)

onMounted(() => {
  loadMyCertificates()
})
</script>

<template>
  <section class="portal-section">
    <div class="container">
      <!-- Portal Header Banner -->
      <div class="portal-header">
        <div class="badge badge-brand">
          <UserCheck :size="14" />
          <span>PORTAL MAHASISWA &bull; SERTIFIKAT SAYA (F-08)</span>
        </div>
        <h2 class="portal-title">Arsip E-Sertifikat Mahasiswa Terverifikasi</h2>
        <p class="portal-desc">
          Akses resmi mahasiswa untuk mencari, memeriksa keaslian matematis (LSB + SHA-256), serta mengunduh berkas e-sertifikat PNG asli.
        </p>

        <!-- If Not Logged In -->
        <div v-if="!user" class="login-prompt-card glass-card">
          <Lock :size="32" class="text-gold" />
          <h3 class="lp-title">Silakan Masuk untuk Mengakses Sertifikat Saya</h3>
          <p class="lp-sub">
            Sesuai aturan keamanan (F-08), mahasiswa hanya dapat melihat dan mengunduh sertifikat miliknya sendiri berdasarkan NIM akun.
          </p>
          <button class="btn btn-primary" @click="emit('open-login')">
            <LogIn :size="16" />
            <span>Masuk dengan Akun NIM</span>
          </button>
        </div>

        <!-- Search Bar if Logged In -->
        <div v-else class="search-bar-wrap glass-card">
          <div class="search-input-box">
            <Search :size="20" class="search-icon" />
            <input
              type="text"
              v-model="searchQuery"
              class="search-input"
              placeholder="Cari berdasarkan Nomor Sertifikat atau Nama Kegiatan..."
              @keyup.enter="loadMyCertificates"
            />
          </div>
          <button class="btn btn-primary search-btn" :disabled="isLoading" @click="loadMyCertificates">
            <RefreshCw v-if="isLoading" :size="16" class="spin-icon" />
            <Search v-else :size="16" />
            <span>Cari</span>
          </button>
        </div>

        <!-- Logged in Student Info Strip -->
        <div v-if="user" class="student-info-strip">
          <span>Akun Aktif: <strong>{{ user.name }}</strong> (NIM: <span class="text-gold font-mono">{{ user.username }}</span>)</span>
        </div>
      </div>

      <!-- Results Area -->
      <div v-if="user" class="results-area">
        <div v-if="isLoading" class="loading-state">
          <RefreshCw :size="32" class="spin-icon" />
          <p>Memuat arsip e-sertifikat Anda dari peladen...</p>
        </div>

        <div v-else-if="certificates.length === 0" class="empty-state glass-card">
          <Award :size="48" class="empty-icon" />
          <h3>Tidak Ada Sertifikat Ditemukan</h3>
          <p>
            Tidak ditemukan e-sertifikat terbit untuk akun NIM <strong>{{ user.username }}</strong>.
            Jika Anda telah mengikuti kegiatan, pastikan admin fakultas telah menerbitkan sertifikat Anda.
          </p>
        </div>

        <div v-else class="certs-grid">
          <div
            v-for="cert in certificates"
            :key="cert.id"
            class="cert-card glass-card"
          >
            <!-- Card Ribbon & Badge -->
            <div class="cert-card-top">
              <span class="badge badge-valid">
                <CheckCircle2 :size="12" />
                <span>LSB + SHA-256 Valid</span>
              </span>
              <span class="cert-role">{{ cert.recipientRole }}</span>
            </div>

            <!-- Card Body -->
            <div class="cert-card-body">
              <h4 class="recipient-name">{{ cert.recipientName }}</h4>
              <p class="recipient-id">NIM: <strong class="font-mono text-gold">{{ cert.recipientIdentifier }}</strong></p>

              <div class="event-info-box">
                <p class="event-title">{{ cert.eventName }}</p>
                <div class="event-meta">
                  <span class="meta-item">
                    <Calendar :size="13" />
                    <span>{{ cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString('id-ID') : '2026' }}</span>
                  </span>
                  <span class="meta-item highlight">
                    <Award :size="13" />
                    <span>PSNR: {{ cert.psnr }} dB</span>
                  </span>
                </div>
              </div>

              <div class="cert-number-bar">
                <span class="k">No. Sertifikat:</span>
                <span class="v font-mono">{{ cert.certificateNumber }}</span>
              </div>
            </div>

            <!-- Card Actions -->
            <div class="cert-card-footer">
              <button class="btn btn-secondary btn-sm" @click="openPreview(cert)">
                <Eye :size="14" />
                <span>Detail &amp; Verifikasi</span>
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                @click="downloadCertificate(cert)"
              >
                <Download :size="14" />
                <span>Unduh PNG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview & Verification Modal (F-08 Skenario 3 & 4) -->
    <div v-if="selectedPreviewCert" class="modal-backdrop" @click="closePreview">
      <div class="modal-dialog glass-card" @click.stop style="max-width: 800px;">
        <div class="modal-header">
          <div class="modal-title-group">
            <Award :size="20" class="text-gold" />
            <h3 class="modal-title">{{ selectedPreviewCert.recipientName }}</h3>
          </div>
          <button class="close-btn" @click="closePreview">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Image Preview -->
          <div class="modal-img-wrap">
            <img
              v-if="previewImageUrl"
              :src="previewImageUrl"
              alt="Sertifikat Digital Asli"
              class="modal-cert-img"
            />
            <div v-else class="preview-loading-spinner" style="padding: 40px; text-align: center; color: var(--text-muted);">
              Memuat pratinjau sertifikat...
            </div>
          </div>

          <!-- Metadata Grid -->
          <div class="modal-meta-grid">
            <div class="m-item">
              <span class="k">Kegiatan</span>
              <span class="v">{{ selectedPreviewCert.eventName }}</span>
            </div>
            <div class="m-item">
              <span class="k">Nomor Sertifikat</span>
              <span class="v text-gold font-mono">{{ selectedPreviewCert.certificateNumber }}</span>
            </div>
            <div class="m-item">
              <span class="k">Peran Partisipasi</span>
              <span class="v">{{ selectedPreviewCert.recipientRole }}</span>
            </div>
            <div class="m-item">
              <span class="k">Mutu Citra Steganografi</span>
              <span class="v">PSNR: <strong class="text-emerald">{{ selectedPreviewCert.psnr }} dB</strong> (MSE: {{ selectedPreviewCert.mse }})</span>
            </div>
            <div class="m-item" style="grid-column: span 2;">
              <span class="k">Segel Integritas Kriptografis (SHA-256 Digest Tersimpan)</span>
              <span class="v code-box">{{ selectedPreviewCert.sha256Hash }}</span>
            </div>
          </div>

          <!-- Verification Action Ribbon (F-08 Skenario 4) -->
          <div class="verif-check-box">
            <div class="vcb-top">
              <div>
                <h4 class="vcb-title">Uji Keabsahan Berkas di Peladen (F-08 Skenario 4)</h4>
                <p class="vcb-sub">Sistem akan mengekstrak bit LSB berkas tersimpan dan menghitung ulang hash SHA-256 deterministik.</p>
              </div>
              <button
                class="btn btn-secondary btn-sm"
                :disabled="isVerifyingStored"
                @click="verifyStoredCertificate(selectedPreviewCert.id)"
              >
                <RefreshCw v-if="isVerifyingStored" :size="14" class="spin-icon" />
                <ShieldCheck v-else :size="14" />
                <span>{{ isVerifyingStored ? 'Mengekstrak LSB...' : 'Verifikasi Integritas Sekarang' }}</span>
              </button>
            </div>

            <!-- Verification Outcome -->
            <div v-if="storedVerificationResult" class="vcb-result" :class="{ 'is-valid': storedVerificationResult.isValid }">
              <CheckCircle2 v-if="storedVerificationResult.isValid" :size="18" class="text-emerald" />
              <AlertTriangle v-else :size="18" class="text-danger" />
              <div>
                <strong :class="storedVerificationResult.isValid ? 'text-emerald' : 'text-danger'">
                  {{ storedVerificationResult.message }}
                </strong>
                <p class="text-xs text-muted">
                  Waktu ekstraksi LSB: {{ storedVerificationResult.executionTimeMs }} ms &bull; Hash Match: {{ storedVerificationResult.hashMatch ? 'Cocok Sempurna (256-bit)' : 'Tidak Cocok' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Lossless Warning Note from Spec -->
          <div class="download-warning-strip">
            <AlertTriangle :size="16" class="text-gold" />
            <span>Penting: Simpan sebagai berkas dokumen asli. Hindari mengirim via foto WhatsApp/medsos karena kompresi merusak data keaslian LSB.</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closePreview">Tutup</button>
          <button
            type="button"
            class="btn btn-primary"
            @click="downloadCertificate(selectedPreviewCert)"
          >
            <Download :size="16" />
            <span>Unduh Berkas PNG Lossless</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.portal-section {
  padding: 50px 0 80px;
}

.portal-header {
  text-align: center;
  max-width: 800px;
  margin: 0 auto 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.portal-title {
  font-size: 2.2rem;
  font-weight: 800;
  color: #FFFFFF;
  margin: 12px 0 8px;
}

.portal-desc {
  font-size: 0.92rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 24px;
}

.login-prompt-card {
  padding: 32px;
  text-align: center;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.lp-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #FFFFFF;
}

.lp-sub {
  font-size: 0.84rem;
  color: var(--text-muted);
}

.student-info-strip {
  margin-top: 14px;
  font-size: 0.85rem;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.04);
  padding: 6px 16px;
  border-radius: var(--radius-pill);
}

.search-bar-wrap {
  display: flex;
  align-items: center;
  padding: 6px 8px 6px 16px;
  gap: 12px;
  width: 100%;
  max-width: 600px;
}

.search-input-box {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.search-icon {
  color: var(--c-eb);
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: #FFFFFF;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  width: 100%;
}

.certs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.cert-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.cert-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.cert-role {
  font-size: 0.75rem;
  color: var(--c-fd);
  font-weight: 700;
}

.recipient-name {
  font-size: 1.15rem;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 4px;
}

.recipient-id {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.event-info-box {
  background: rgba(255, 255, 255, 0.03);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.event-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #E2E8F0;
  margin-bottom: 6px;
}

.event-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--text-muted);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-item.highlight {
  color: #34D399;
  font-weight: 700;
}

.cert-number-bar {
  font-size: 0.74rem;
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 16px;
}

.cert-number-bar .k {
  color: var(--text-faint);
}

.cert-number-bar .v {
  color: var(--c-fd);
}

.cert-card-footer {
  display: flex;
  gap: 8px;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-dialog {
  width: 100%;
  padding: 24px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modal-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: #FFFFFF;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.6rem;
  cursor: pointer;
}

.modal-img-wrap {
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-cert-img {
  width: 100%;
  display: block;
}

.modal-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

.m-item {
  background: rgba(255, 255, 255, 0.03);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
}

.m-item .k {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.m-item .v {
  font-size: 0.92rem;
  color: #FFFFFF;
  font-weight: 600;
}

.code-box {
  font-family: monospace;
  font-size: 0.72rem;
  word-break: break-all;
}

.verif-check-box {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  padding: 14px;
  margin-bottom: 14px;
}

.vcb-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.vcb-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 2px;
}

.vcb-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.vcb-result {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 10px;
}

.vcb-result.is-valid {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.download-warning-strip {
  padding: 8px 12px;
  background: rgba(253, 183, 115, 0.08);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--c-fd);
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

@media (max-width: 900px) {
  .certs-grid {
    grid-template-columns: 1fr;
  }
}
</style>
