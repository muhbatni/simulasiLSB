<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
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
  RefreshCw
} from '@lucide/vue'

const props = defineProps({
  initialQuery: { type: String, default: '09020623041' }
})

const searchQuery = ref(props.initialQuery || '09020623041') // Default NIM author proposal
const certificates = ref([])
const isLoading = ref(false)
const selectedPreviewCert = ref(null)

const searchCertificates = async () => {
  if (!searchQuery.value.trim()) return
  isLoading.value = true
  try {
    const res = await axios.get(`/api/certificates/search?q=${encodeURIComponent(searchQuery.value.trim())}`)
    certificates.value = res.data
  } catch (err) {
    console.error('Gagal mencari sertifikat:', err)
  } finally {
    isLoading.value = false
  }
}

const loadAllCertificates = async () => {
  isLoading.value = true
  try {
    const res = await axios.get('/api/certificates')
    certificates.value = res.data
  } catch (err) {
    console.error('Gagal memuat sertifikat:', err)
  } finally {
    isLoading.value = false
  }
}

const openPreview = (cert) => {
  selectedPreviewCert.value = cert
}

const closePreview = () => {
  selectedPreviewCert.value = null
}

const setQueryAndSearch = (query) => {
  searchQuery.value = query
  searchCertificates()
}

onMounted(() => {
  searchCertificates()
})
</script>

<template>
  <section class="portal-section">
    <div class="container">
      <!-- Portal Header Banner -->
      <div class="portal-header">
        <div class="badge badge-brand">
          <Award :size="14" />
          <span>PORTAL MAHASISWA &amp; PESERTA</span>
        </div>
        <h2 class="portal-title">Pencarian &amp; Pengunduhan E-Sertifikat Lossless</h2>
        <p class="portal-desc">
          Cari e-sertifikat Anda menggunakan Nomor Induk Mahasiswa (NIM) atau Nomor Sertifikat.
          Berkas diunduh dalam format <strong>PNG Lossless murni</strong> bit-exact tanpa kompresi pihak ketiga.
        </p>

        <!-- Search Input Bar (Triv.co.id Style) -->
        <div class="search-bar-wrap glass-card">
          <div class="search-input-box">
            <Search :size="20" class="search-icon" />
            <input
              type="text"
              v-model="searchQuery"
              class="search-input"
              placeholder="Masukkan NIM (contoh: 09020623041) atau Nomor Sertifikat..."
              @keyup.enter="searchCertificates"
            />
          </div>
          <button class="btn btn-primary search-btn" :disabled="isLoading" @click="searchCertificates">
            <RefreshCw v-if="isLoading" :size="16" class="spin-icon" />
            <Search v-else :size="16" />
            <span>Cari Sertifikat</span>
          </button>
        </div>

        <!-- Quick Filter Chips -->
        <div class="quick-chips">
          <span class="chips-label">NIM Cepat:</span>
          <button class="chip-btn" @click="setQueryAndSearch('09020623041')">
            09020623041 (Muh. Batni M.)
          </button>
          <button class="chip-btn" @click="setQueryAndSearch('09020623088')">
            09020623088 (Aisyah Putri M.)
          </button>
          <button class="chip-btn" @click="loadAllCertificates">
            Tampilkan Semua
          </button>
        </div>
      </div>

      <!-- Results Grid -->
      <div class="results-area">
        <div v-if="isLoading" class="loading-state">
          <RefreshCw :size="32" class="spin-icon" />
          <p>Mencari arsip e-sertifikat berkeamanan LSB...</p>
        </div>

        <div v-else-if="certificates.length === 0" class="empty-state glass-card">
          <Award :size="48" class="empty-icon" />
          <h3>Tidak Ada Sertifikat Ditemukan</h3>
          <p>Tidak ditemukan data sertifikat untuk kata kunci "{{ searchQuery }}". Pastikan NIM atau nomor sertifikat telah terdaftar.</p>
          <button class="btn btn-secondary btn-sm" @click="loadAllCertificates">Lihat Semua Data</button>
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
              <p class="recipient-id">NIM / ID: <strong>{{ cert.recipientIdentifier }}</strong></p>

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

              <!-- Certificate Number Pill -->
              <div class="cert-number-bar">
                <span class="k">No. Sertifikat:</span>
                <span class="v">{{ cert.certificateNumber }}</span>
              </div>
            </div>

            <!-- Card Actions -->
            <div class="cert-card-footer">
              <button class="btn btn-secondary btn-sm" @click="openPreview(cert)">
                <Eye :size="15" />
                <span>Pratinjau</span>
              </button>
              <a
                :href="`/api/certificates/${cert.id}/download`"
                download
                class="btn btn-primary btn-sm"
              >
                <Download :size="15" />
                <span>Unduh PNG Asli</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <div v-if="selectedPreviewCert" class="modal-backdrop" @click="closePreview">
      <div class="modal-dialog glass-card" @click.stop>
        <div class="modal-header">
          <div class="modal-title-group">
            <Award :size="20" class="text-gold" />
            <h3 class="modal-title">{{ selectedPreviewCert.recipientName }}</h3>
          </div>
          <button class="close-btn" @click="closePreview">&times;</button>
        </div>

        <div class="modal-body">
          <div class="modal-img-wrap">
            <img
              :src="`/api/certificates/${selectedPreviewCert.id}/download`"
              alt="Sertifikat Digital Asli"
              class="modal-cert-img"
            />
          </div>

          <div class="modal-meta-grid">
            <div class="m-item">
              <span class="k">Kegiatan</span>
              <span class="v">{{ selectedPreviewCert.eventName }}</span>
            </div>
            <div class="m-item">
              <span class="k">Nomor Sertifikat</span>
              <span class="v text-gold">{{ selectedPreviewCert.certificateNumber }}</span>
            </div>
            <div class="m-item">
              <span class="k">Segel Hash SHA-256</span>
              <span class="v code-box">{{ selectedPreviewCert.sha256Hash }}</span>
            </div>
            <div class="m-item">
              <span class="k">Kualitas Citra Stego</span>
              <span class="v">PSNR: <strong>{{ selectedPreviewCert.psnr }} dB</strong> (MSE: {{ selectedPreviewCert.mse }})</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closePreview">Tutup</button>
          <a
            :href="`/api/certificates/${selectedPreviewCert.id}/download`"
            download
            class="btn btn-primary"
          >
            <Download :size="16" />
            <span>Unduh Berkas PNG Lossless</span>
          </a>
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
  gap: 14px;
}

.portal-title {
  font-size: 2.2rem;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: -0.5px;
}

.portal-desc {
  font-size: 1rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.search-bar-wrap {
  width: 100%;
  max-width: 700px;
  margin-top: 10px;
  padding: 8px 8px 8px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
}

.search-input-box {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.search-icon {
  color: var(--c-fd);
}

.search-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: #FFFFFF;
  font-family: var(--font-sans);
  font-size: 1rem;
}

.search-btn {
  padding: 12px 24px;
}

.quick-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 4px;
}

.chips-label {
  font-size: 0.78rem;
  color: var(--text-faint);
  font-weight: 600;
}

.chip-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  color: var(--c-fd);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chip-btn:hover {
  background: rgba(218, 101, 86, 0.2);
  border-color: var(--c-da);
}

/* Results */
.certs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
}

.cert-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(218, 101, 86, 0.2);
  background: var(--grad-dark-card);
}

.cert-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.cert-role {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--c-fd);
  background: rgba(253, 183, 115, 0.12);
  padding: 3px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(253, 183, 115, 0.25);
}

.recipient-name {
  font-size: 1.28rem;
  font-weight: 800;
  color: #FFFFFF;
}

.recipient-id {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-bottom: 14px;
}

.event-info-box {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.event-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.4;
  margin-bottom: 8px;
}

.event-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.76rem;
  color: var(--text-faint);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.meta-item.highlight {
  color: var(--c-fd);
  font-weight: 700;
  font-family: var(--font-mono);
}

.cert-number-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.76rem;
  background: rgba(218, 101, 86, 0.08);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  margin-bottom: 20px;
}

.cert-number-bar .k {
  color: var(--text-muted);
}

.cert-number-bar .v {
  color: var(--c-fd);
  font-family: var(--font-mono);
  font-weight: 700;
}

.cert-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.cert-card-footer .btn {
  flex: 1;
}

/* Modal Preview */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-dialog {
  max-width: 850px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  background: #171315;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
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

.text-gold {
  color: var(--c-fd);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.8rem;
  color: var(--text-muted);
  cursor: pointer;
}

.close-btn:hover {
  color: #FFFFFF;
}

.modal-img-wrap {
  width: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 18px;
}

.modal-cert-img {
  width: 100%;
  display: block;
}

.modal-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 20px;
}

.m-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.m-item .k {
  font-size: 0.72rem;
  color: var(--text-faint);
  font-weight: 700;
  text-transform: uppercase;
}

.m-item .v {
  font-size: 0.9rem;
  font-weight: 600;
  color: #FFFFFF;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.empty-icon {
  color: var(--c-da);
  opacity: 0.6;
}

.spin-icon {
  animation: spin 1s infinite linear;
}
</style>
