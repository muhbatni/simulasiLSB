<script setup>
import { ref } from 'vue'
import api from '../services/api'
import confetti from 'canvas-confetti'
import {
  UploadCloud,
  ShieldCheck,
  AlertTriangle,
  FileX,
  KeyRound,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Lock,
  Cpu,
  Layers,
  Zap
} from 'lucide-vue-next'

const emit = defineEmits(['navigate-tab', 'open-login'])

const selectedFile = ref(null)
const previewUrl = ref(null)
const isDragging = ref(false)
const isVerifying = ref(false)
const verificationResult = ref(null)
const errorMessage = ref('')
const fileInput = ref(null)
const verifierSectionRef = ref(null)

const scrollToVerifier = () => {
  if (verifierSectionRef.value) {
    verifierSectionRef.value.scrollIntoView({ behavior: 'smooth' })
  }
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) processFile(file)
}

const handleDrop = (event) => {
  isDragging.value = false
  const file = event.dataTransfer.files[0]
  if (file) processFile(file)
}

const processFile = (file) => {
  errorMessage.value = ''
  verificationResult.value = null

  if (!file.name.toLowerCase().endsWith('.png') && file.type !== 'image/png') {
    errorMessage.value = 'Peringatan: Format berkas harus PNG lossless untuk menjamin integritas steganografi LSB!'
  }

  selectedFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => {
    previewUrl.value = e.target.result
  }
  reader.readAsDataURL(file)
}

const triggerFileInput = () => {
  if (fileInput.value) fileInput.value.click()
}

const verifyCertificate = async () => {
  if (!selectedFile.value) {
    errorMessage.value = 'Silakan pilih berkas sertifikat PNG terlebih dahulu.'
    return
  }

  isVerifying.value = true
  errorMessage.value = ''
  verificationResult.value = null

  try {
    const formData = new FormData()
    formData.append('certificateImage', selectedFile.value)

    const response = await api.post('/verification/verify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    verificationResult.value = response.data

    if (response.data.isValid && response.data.status === 'ASLI_VALID') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#A14646', '#DA6556', '#EB895B', '#FDB773', '#10B981'],
      })
    }
  } catch (err) {
    if (err.response && err.response.data && err.response.data.message) {
      errorMessage.value = err.response.data.message
    } else {
      errorMessage.value = 'Terjadi kesalahan jaringan saat memverifikasi berkas.'
    }
  } finally {
    isVerifying.value = false
  }
}

const loadSampleCertificate = async (type = 'valid') => {
  isVerifying.value = true
  errorMessage.value = ''
  verificationResult.value = null

  try {
    const certsRes = await api.get('/certificates')
    if (certsRes.data && certsRes.data.length > 0) {
      const sample = certsRes.data[0]
      const fileRes = await api.get(`/certificates/${sample.id}/download`, {
        responseType: 'blob',
      })

      const blob = fileRes.data
      let fileToUse = new File([blob], `Sertifikat-${sample.recipientName}.png`, { type: 'image/png' })

      if (type === 'tampered') {
        const arrayBuf = await blob.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuf)
        for (let i = 80; i < 110; i++) {
          uint8[i] = uint8[i] ^ 0xff
        }
        fileToUse = new File([uint8], `Sertifikat-Manipulasi-${sample.recipientName}.png`, { type: 'image/png' })
      }

      processFile(fileToUse)
      await verifyCertificate()
    } else {
      errorMessage.value = 'Belum ada data sertifikat contoh di server. Silakan login admin dan terbitkan sertifikat.'
    }
  } catch (err) {
    errorMessage.value = 'Gagal memuat sampel: ' + (err.response?.data?.message || err.message || 'Error')
  } finally {
    isVerifying.value = false
  }
}
</script>

<template>
  <div class="recognito-hero-wrapper">
    <!-- HERO SECTION (Identical visual structure to ref1.jpg) -->
    <section class="hero-top-stage">
      <div class="container hero-content-center">
        <!-- Dual Capsule Badge from ref1.jpg -->
        <div class="capsule-badge hero-capsule">
          <span class="capsule-lead">Keamanan Sertifikat Digital</span>
          <span class="capsule-tail">LSB &amp; SHA-256 Engine</span>
        </div>

        <!-- Huge Main Headline from ref1.jpg -->
        <h1 class="hero-giant-title">
          Meet! SertifikatSec<br />
          Built for a secure digital future.
        </h1>

        <!-- Subtitle from ref1.jpg -->
        <p class="hero-lead-desc">
          Empowering academic verification with pixel-exact spatial steganography,
          cryptographic SHA-256 integrity seals, and zero visual copy-paste vulnerability.
        </p>

        <!-- Action Pill Buttons from ref1.jpg -->
        <div class="hero-pill-actions">
          <button class="btn btn-white-pill" @click="scrollToVerifier">
            <span>Verifikasi Sekarang</span>
          </button>
          <button class="btn btn-secondary" @click="emit('open-login')">
            <span>Masuk Akun</span>
          </button>
        </div>

        <!-- Floating Circuit Nodes & Central Orb Lens (Directly from ref1.jpg) -->
        <div class="circuit-aurora-interactive">
          <div class="floating-pins-container">
            <div class="circuit-pin pin-secured">
              <span class="pin-dot"></span>
              <span>Secured</span>
            </div>
            <div class="circuit-pin pin-encrypted">
              <span class="pin-dot"></span>
              <span>Encrypted</span>
            </div>
            <div class="circuit-pin pin-lightspeed">
              <span class="pin-dot"></span>
              <span>&lt; 2s Latency</span>
            </div>
            <div class="circuit-pin pin-hub">
              <span class="pin-dot"></span>
              <span>Central HUB</span>
            </div>
            <div class="circuit-pin pin-system">
              <span class="pin-dot"></span>
              <span>Lossless PNG</span>
            </div>
          </div>

          <!-- Central Glowing Lens Orb from ref1.jpg -->
          <div class="central-orb-wrap" @click="scrollToVerifier" title="Klik untuk Mulai Verifikasi">
            <div class="central-orb-lens">
              <div class="orb-inner-glyph">
                <ShieldCheck :size="32" class="text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- INTERACTIVE VERIFICATION WIDGET (Sleek Glassmorphic Card) -->
    <section ref="verifierSectionRef" class="verifier-card-section">
      <div class="container">
        <div class="verifier-glass-window glass-card">
          <div class="verifier-window-header">
            <div class="v-header-left">
              <div class="v-icon-glow">
                <KeyRound :size="18" />
              </div>
              <div>
                <h3 class="v-title">Pemeriksaan Keaslian E-Sertifikat</h3>
                <p class="v-sub">Ekstraksi bit terendah (LSB) dan komparasi intisari hash SHA-256 deterministik</p>
              </div>
            </div>
            <div class="v-header-right">
              <span class="v-tag-pill">Publik / Tanpa Login</span>
            </div>
          </div>

          <!-- Dropzone Container -->
          <div
            class="dropzone-box"
            :class="{ 'is-dragging': isDragging, 'has-file': previewUrl }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            @click="!previewUrl && triggerFileInput()"
          >
            <input
              type="file"
              ref="fileInput"
              class="hidden-file-input"
              accept=".png,image/png"
              @change="handleFileSelect"
            />

            <!-- Preview if file loaded -->
            <div v-if="previewUrl" class="image-preview-frame">
              <img :src="previewUrl" alt="Preview E-Sertifikat" class="loaded-cert-image" />
              <div class="preview-info-strip">
                <span class="p-name">{{ selectedFile?.name }}</span>
                <span class="p-size font-mono">{{ (selectedFile?.size / 1024).toFixed(1) }} KB</span>
                <button class="btn btn-secondary btn-sm" @click.stop="triggerFileInput">Ganti Berkas</button>
              </div>
            </div>

            <!-- Empty Dropzone State -->
            <div v-else class="empty-dropzone-content">
              <div class="drop-circle-glow">
                <UploadCloud :size="32" class="text-gold" />
              </div>
              <p class="main-drop-prompt">
                Tarik &amp; letakkan e-sertifikat PNG di sini, atau <span class="highlight-orange">klik untuk memilih</span>
              </p>
              <p class="sub-drop-prompt">Format Portable Network Graphics (.png) lossless TrueColor 24-bit</p>
            </div>
          </div>

          <!-- Quick Test Samples Chips -->
          <div class="quick-samples-bar">
            <span class="q-label">Uji Coba Cepat:</span>
            <button
              class="sample-btn valid-sample"
              :disabled="isVerifying"
              @click="loadSampleCertificate('valid')"
            >
              <CheckCircle2 :size="13" />
              <span>Sampel Asli (Valid)</span>
            </button>
            <button
              class="sample-btn tampered-sample"
              :disabled="isVerifying"
              @click="loadSampleCertificate('tampered')"
            >
              <AlertTriangle :size="13" />
              <span>Sampel Rekayasa (Tampered)</span>
            </button>
          </div>

          <!-- Verify Action Button -->
          <div class="verify-action-wrap">
            <button
              class="btn btn-white-pill btn-block"
              :disabled="!selectedFile || isVerifying"
              @click="verifyCertificate"
            >
              <RefreshCw v-if="isVerifying" :size="18" class="spin-icon" />
              <ShieldCheck v-else :size="18" />
              <span>{{ isVerifying ? 'Mengekstrak LSB & Menghitung Hash SHA-256...' : 'Mulai Verifikasi Dokumen' }}</span>
            </button>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="error-banner-box">
            <AlertTriangle :size="18" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Results Display Card -->
          <div v-if="verificationResult" class="verification-outcome-box" :class="verificationResult.status">
            <!-- Authentic Certificate -->
            <template v-if="verificationResult.status === 'ASLI_VALID'">
              <div
                class="outcome-header"
                :class="verificationResult.isOfficialDbRegistered !== false ? 'outcome-valid' : 'outcome-tampered'"
              >
                <div
                  class="outcome-icon"
                  :class="verificationResult.isOfficialDbRegistered !== false ? 'valid-icon' : 'tampered-icon'"
                >
                  <ShieldCheck :size="26" />
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <h4 class="outcome-title">
                      {{ verificationResult.isOfficialDbRegistered !== false ? 'SERTIFIKAT ASLI & TERVERIFIKASI' : 'STRUKTUR HASH VALID (TIDAK TERDAFTAR DI DB)' }}
                    </h4>
                    <span
                      class="badge"
                      :class="verificationResult.isOfficialDbRegistered !== false ? 'badge-valid' : 'badge-brand'"
                    >
                      {{ verificationResult.isOfficialDbRegistered !== false ? 'Terdaftar Resmi di DB (F-10)' : 'Tidak Tercatat di DB (F-10)' }}
                    </span>
                  </div>
                  <p class="outcome-sub">{{ verificationResult.message }}</p>
                </div>
              </div>

              <!-- Metadata Grid -->
              <div v-if="verificationResult.metadata" class="metadata-table-grid">
                <div class="meta-field">
                  <span class="f-label">Nomor Sertifikat</span>
                  <span class="f-val text-gold font-mono">{{ verificationResult.metadata.nomor }}</span>
                </div>
                <div class="meta-field">
                  <span class="f-label">Nama Penerima</span>
                  <span class="f-val text-white font-bold">{{ verificationResult.metadata.nama }}</span>
                </div>
                <div class="meta-field">
                  <span class="f-label">Peran</span>
                  <span class="f-val">{{ verificationResult.metadata.peran }}</span>
                </div>
                <div class="meta-field">
                  <span class="f-label">Kegiatan</span>
                  <span class="f-val">{{ verificationResult.metadata.kegiatan }}</span>
                </div>
                <div class="meta-field">
                  <span class="f-label">Tanggal Pelaksanaan</span>
                  <span class="f-val">{{ (verificationResult.metadata.tanggal || '').split('T')[0].split(' ')[0] }}</span>
                </div>
                <div class="meta-field">
                  <span class="f-label">Penyelenggara</span>
                  <span class="f-val">{{ verificationResult.metadata.lembaga }}</span>
                </div>
              </div>

              <!-- Cryptographic Hash Audit Seal -->
              <div class="cryptographic-seal-box">
                <div class="seal-top">
                  <span class="seal-title">Segel Integritas Kriptografis (SHA-256 Digest):</span>
                  <span class="badge badge-valid">MATCH (256-BIT DETERMINISTIK)</span>
                </div>
                <div class="code-box seal-code">
                  {{ verificationResult.storedHash }}
                </div>
                <div v-if="verificationResult.canvasHash" class="seal-top" style="margin-top: 14px;">
                  <span class="seal-title">Canvas Hash Piksel (Integritas Visual Kanvas):</span>
                  <span
                    class="badge"
                    :class="verificationResult.canvasHashMatch !== false ? 'badge-valid' : 'badge-tampered'"
                  >
                    {{ verificationResult.canvasHashMatch !== false ? 'KANVAS ASLI & COCOK' : 'MANIPULASI KANVAS TERDETEKSI' }}
                  </span>
                </div>
                <div v-if="verificationResult.canvasHash" class="code-box seal-code font-mono">
                  {{ verificationResult.canvasHash }}
                </div>
                <div class="seal-footer">
                  <span>Waktu komputasi ekstraksi: <strong>{{ verificationResult.executionTimeMs }} ms</strong></span>
                  <span v-if="verificationResult.imageDimensions">
                    Dimensi: {{ verificationResult.imageDimensions.width }} &times; {{ verificationResult.imageDimensions.height }} px
                  </span>
                </div>
              </div>
            </template>

            <!-- Tampered Certificate -->
            <template v-else-if="verificationResult.status === 'MANIPULASI_TERDETEKSI'">
              <div class="outcome-header outcome-tampered">
                <div class="outcome-icon tampered-icon">
                  <AlertTriangle :size="26" />
                </div>
                <div>
                  <h4 class="outcome-title">PERINGATAN: TERINDIKASI MANIPULASI!</h4>
                  <p class="outcome-sub">{{ verificationResult.message }}</p>
                </div>
              </div>

              <p class="tamper-body-text">
                Sistem mendeteksi inkonsistensi matematis antara hash SHA-256 tersimpan dengan nilai bit yang diekstrak.
                Sesuai karakteristik <strong>Avalanche Effect</strong>, manipulasi sekecil 1 bit pada nama atau stempel mengakibatkan kegagalan verifikasi keaslian dokumen.
              </p>

              <div v-if="verificationResult.storedHash" class="tamper-hashes-diff">
                <div class="th-row">
                  <span class="th-k">Hash Tersimpan (LSB):</span>
                  <span class="th-v font-mono">{{ verificationResult.storedHash }}</span>
                </div>
                <div class="th-row">
                  <span class="th-k">Hash Kalkulasi Ulang:</span>
                  <span class="th-v font-mono text-danger">{{ verificationResult.recomputedHash }}</span>
                </div>
              </div>
            </template>

            <!-- Invalid Format -->
            <template v-else>
              <div class="outcome-header outcome-tampered">
                <div class="outcome-icon tampered-icon">
                  <FileX :size="26" />
                </div>
                <div>
                  <h4 class="outcome-title">FORMAT BERKAS TIDAK VALID</h4>
                  <p class="outcome-sub">{{ verificationResult.message }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.recognito-hero-wrapper {
  position: relative;
  z-index: 1;
}

/* HERO TOP STAGE (Exact Layout of ref1.jpg) */
.hero-top-stage {
  padding: 70px 0 60px;
  text-align: center;
  position: relative;
}

.hero-content-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-capsule {
  margin-bottom: 28px;
}

.hero-giant-title {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -1.5px;
  color: #FFFFFF;
  margin-bottom: 20px;
  max-width: 900px;
}

.hero-lead-desc {
  font-size: 1.05rem;
  color: var(--text-muted);
  max-width: 680px;
  line-height: 1.65;
  margin-bottom: 34px;
}

.hero-pill-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 50px;
}

.hero-pill-actions .btn {
  padding: 12px 28px;
  font-size: 0.95rem;
}

/* Circuit Nodes and Aurora Section from ref1.jpg */
.circuit-aurora-interactive {
  position: relative;
  width: 100%;
  max-width: 1000px;
  height: 220px;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-pins-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pin-secured {
  position: absolute;
  bottom: 40px;
  left: 8%;
}

.pin-encrypted {
  position: absolute;
  top: 30px;
  left: 32%;
}

.pin-lightspeed {
  position: absolute;
  bottom: 40px;
  left: 36%;
}

.pin-hub {
  position: absolute;
  bottom: 50px;
  right: 32%;
}

.pin-system {
  position: absolute;
  bottom: 20px;
  right: 18%;
}

.central-orb-wrap {
  position: relative;
  z-index: 10;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.central-orb-wrap:hover {
  transform: scale(1.08);
}

.orb-inner-glyph {
  position: relative;
  z-index: 2;
}

/* VERIFIER WINDOW */
.verifier-card-section {
  padding: 20px 0 80px;
  position: relative;
  z-index: 10;
}

.verifier-glass-window {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px;
  background: var(--bg-card);
  border: 1px solid rgba(235, 137, 91, 0.28);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(218, 101, 86, 0.15);
}

.verifier-window-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.v-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.v-icon-glow {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--grad-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  box-shadow: 0 0 18px rgba(218, 101, 86, 0.4);
}

.v-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #FFFFFF;
}

.v-sub {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.v-tag-pill {
  font-size: 0.74rem;
  background: rgba(235, 137, 91, 0.14);
  color: var(--c-fd);
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  font-weight: 700;
  border: 1px solid rgba(235, 137, 91, 0.3);
}

/* Dropzone */
.dropzone-box {
  border: 2px dashed rgba(235, 137, 91, 0.35);
  border-radius: var(--radius-lg);
  background: rgba(10, 8, 9, 0.7);
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.dropzone-box:hover, .dropzone-box.is-dragging {
  border-color: var(--c-eb);
  background: rgba(218, 101, 86, 0.1);
}

.hidden-file-input {
  display: none;
}

.drop-circle-glow {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(235, 137, 91, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}

.main-drop-prompt {
  font-size: 1rem;
  font-weight: 600;
  color: #FFFFFF;
}

.highlight-orange {
  color: var(--c-eb);
  text-decoration: underline;
}

.sub-drop-prompt {
  font-size: 0.78rem;
  color: var(--text-faint);
  margin-top: 6px;
}

.image-preview-frame {
  position: relative;
  max-height: 240px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.loaded-cert-image {
  width: 100%;
  max-height: 230px;
  object-fit: cover;
  display: block;
}

.preview-info-strip {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, transparent 0%, rgba(10, 8, 9, 0.95) 100%);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.p-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #FFFFFF;
  max-width: 250px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.p-size {
  font-size: 0.78rem;
  color: var(--c-fd);
}

/* Quick Samples */
.quick-samples-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 18px 0;
  flex-wrap: wrap;
}

.q-label {
  font-size: 0.8rem;
  color: var(--text-faint);
  font-weight: 600;
}

.sample-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.sample-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.valid-sample {
  border-color: rgba(16, 185, 129, 0.4);
  color: #34D399;
}

.tampered-sample {
  border-color: rgba(239, 68, 68, 0.4);
  color: #F87171;
}

/* Button & Alert */
.verify-action-wrap {
  margin-top: 10px;
}

.verify-action-wrap .btn {
  width: 100%;
  padding: 14px;
  font-size: 1rem;
}

.error-banner-box {
  margin-top: 18px;
  padding: 12px 16px;
  background: var(--color-danger-bg);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: var(--radius-md);
  color: #FCA5A5;
  font-size: 0.86rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Outcomes */
.verification-outcome-box {
  margin-top: 24px;
  border-radius: var(--radius-md);
  padding: 24px;
  background: rgba(14, 11, 13, 0.9);
  border: 1px solid var(--border-subtle);
  animation: outcomeFade 0.3s ease;
}

@keyframes outcomeFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.verification-outcome-box.ASLI_VALID {
  border-color: rgba(16, 185, 129, 0.45);
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(14, 11, 13, 0.9) 100%);
}

.verification-outcome-box.MANIPULASI_TERDETEKSI {
  border-color: rgba(239, 68, 68, 0.45);
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.1) 0%, rgba(14, 11, 13, 0.9) 100%);
}

.outcome-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.outcome-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.valid-icon {
  background: rgba(16, 185, 129, 0.2);
  color: var(--color-success);
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.tampered-icon {
  background: rgba(239, 68, 68, 0.2);
  color: var(--color-danger);
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.outcome-title {
  font-size: 1.15rem;
  font-weight: 800;
}

.outcome-valid .outcome-title { color: #34D399; }
.outcome-tampered .outcome-title { color: #F87171; }

.outcome-sub {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.metadata-table-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: rgba(0, 0, 0, 0.35);
  padding: 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 18px;
}

.meta-field {
  display: flex;
  flex-direction: column;
}

.f-label {
  font-size: 0.7rem;
  color: var(--text-faint);
  font-weight: 700;
  text-transform: uppercase;
}

.f-val {
  font-size: 0.92rem;
  color: #FFFFFF;
}

.cryptographic-seal-box {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  padding: 14px;
}

.seal-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.seal-title {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-muted);
}

.seal-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--text-faint);
  margin-top: 8px;
}

.tamper-body-text {
  font-size: 0.86rem;
  color: #FECACA;
  line-height: 1.6;
  margin-bottom: 16px;
}

.tamper-hashes-diff {
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.th-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.th-k {
  font-size: 0.72rem;
  color: var(--text-faint);
  font-weight: 600;
}

.th-v {
  font-size: 0.78rem;
  color: var(--text-muted);
  word-break: break-all;
}

.text-danger { color: #F87171 !important; }
.text-gold { color: var(--c-fd); }
.spin-icon { animation: spin 1s infinite linear; }

@media (max-width: 900px) {
  .hero-giant-title { font-size: 2.4rem; }
  .metadata-table-grid { grid-template-columns: 1fr; }
  .floating-pins-container { display: none; }
}

@media (max-width: 640px) {
  .hero-giant-title {
    font-size: 1.85rem;
    letter-spacing: -0.5px;
  }
  .hero-lead-desc {
    font-size: 0.92rem;
  }
  .hero-pill-actions {
    flex-direction: column;
    width: 100%;
    gap: 10px;
  }
  .hero-pill-actions .btn {
    width: 100%;
    justify-content: center;
  }
  .verifier-glass-window {
    padding: 18px 14px;
    border-radius: var(--radius-lg);
  }
  .verifier-window-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .dropzone-box {
    padding: 28px 16px;
  }
  .outcome-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .quick-download-strip {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .quick-download-strip .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
