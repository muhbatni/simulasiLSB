<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import {
  Award,
  PlusCircle,
  FileSpreadsheet,
  Calendar,
  Layers,
  ShieldCheck,
  Activity,
  Download,
  AlertTriangle,
  CheckCircle2,
  Lock,
  LogIn,
  RefreshCw,
  Trash2,
  UploadCloud,
  FileCheck,
  UserCheck
} from '@lucide/vue'

const props = defineProps({
  user: { type: Object, default: null }
})

const emit = defineEmits(['login-success'])

const activeSubTab = ref('generator') // 'generator' | 'bulk' | 'events' | 'logs'
const events = ref([])
const certificates = ref([])
const stats = ref(null)
const logs = ref([])

// Login State
const loginUsername = ref('admin')
const loginPassword = ref('123')
const loginError = ref('')
const isLoggingIn = ref(false)

// Single Generator Form
const genForm = ref({
  eventId: '',
  recipientName: 'Muhammad Raihan',
  recipientIdentifier: '09020623099',
  recipientRole: 'Peserta',
  certificateNumber: '',
  resolution: '1080p',
})
const customCoverFile = ref(null)
const isGenerating = ref(false)
const genResult = ref(null)
const genError = ref('')

// Bulk Generator Form
const bulkEventId = ref('')
const bulkCsvText = ref(`Dewi Lestari,09020623011,Peserta
Bagus Setiawan,09020623012,Peserta
Fitri Handayani,09020623013,Peserta
Rizki Pratama,09020623014,Pemateri`)
const isBulkProcessing = ref(false)
const bulkResult = ref(null)

// Event Form
const newEventForm = ref({
  eventName: '',
  eventDate: new Date().toISOString().split('T')[0],
  organizer: 'Fakultas Sains dan Teknologi UIN Sunan Ampel Surabaya',
})
const newEventTemplate = ref(null)
const isCreatingEvent = ref(false)

const handleLogin = async () => {
  loginError.value = ''
  isLoggingIn.value = true
  try {
    const res = await axios.post('/api/auth/login', {
      username: loginUsername.value,
      password: loginPassword.value,
    })
    localStorage.setItem('lsb_token', res.data.accessToken)
    emit('login-success', res.data.user)
    await loadDashboardData()
  } catch (err) {
    loginError.value = err.response?.data?.message || 'Login gagal, periksa kredensial'
  } finally {
    isLoggingIn.value = false
  }
}

const loadDashboardData = async () => {
  try {
    const [eventsRes, certsRes, statsRes, logsRes] = await Promise.all([
      axios.get('/api/events'),
      axios.get('/api/certificates'),
      axios.get('/api/verification/stats'),
      axios.get('/api/verification/logs'),
    ])
    events.value = eventsRes.data
    certificates.value = certsRes.data
    stats.value = statsRes.data
    logs.value = logsRes.data

    if (events.value.length > 0 && !genForm.value.eventId) {
      genForm.value.eventId = events.value[0].id
      bulkEventId.value = events.value[0].id
    }
  } catch (err) {
    console.error('Gagal memuat data dashboard:', err)
  }
}

const handleCoverFileChange = (e) => {
  customCoverFile.value = e.target.files[0]
}

const handleSingleGenerate = async () => {
  isGenerating.value = true
  genError.value = ''
  genResult.value = null

  try {
    const token = localStorage.getItem('lsb_token')
    const formData = new FormData()
    formData.append('eventId', genForm.value.eventId)
    formData.append('recipientName', genForm.value.recipientName)
    formData.append('recipientIdentifier', genForm.value.recipientIdentifier)
    formData.append('recipientRole', genForm.value.recipientRole)
    if (genForm.value.certificateNumber) {
      formData.append('certificateNumber', genForm.value.certificateNumber)
    }
    formData.append('resolution', genForm.value.resolution)

    if (customCoverFile.value) {
      formData.append('coverImage', customCoverFile.value)
    }

    const res = await axios.post('/api/certificates/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    })
    genResult.value = res.data
    await loadDashboardData()
  } catch (err) {
    genError.value = err.response?.data?.message || 'Gagal menerbitkan e-sertifikat'
  } finally {
    isGenerating.value = false
  }
}

const handleBulkGenerate = async () => {
  if (!bulkEventId.value) return
  isBulkProcessing.value = true
  bulkResult.value = null

  try {
    const lines = bulkCsvText.value.split('\n').filter((l) => l.trim().length > 0)
    const recipients = lines.map((line) => {
      const parts = line.split(',')
      return {
        name: parts[0]?.trim() || 'Peserta',
        identifier: parts[1]?.trim() || 'NIM-000',
        role: parts[2]?.trim() || 'Peserta',
      }
    })

    const token = localStorage.getItem('lsb_token')
    const res = await axios.post(
      '/api/certificates/bulk-generate',
      {
        eventId: bulkEventId.value,
        recipients,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    bulkResult.value = res.data
    await loadDashboardData()
  } catch (err) {
    console.error('Bulk generate gagal:', err)
  } finally {
    isBulkProcessing.value = false
  }
}

const handleCreateEvent = async () => {
  if (!newEventForm.value.eventName) return
  isCreatingEvent.value = true
  try {
    const token = localStorage.getItem('lsb_token')
    const formData = new FormData()
    formData.append('eventName', newEventForm.value.eventName)
    formData.append('eventDate', newEventForm.value.eventDate)
    formData.append('organizer', newEventForm.value.organizer)

    if (newEventTemplate.value) {
      formData.append('templateImage', newEventTemplate.value)
    }

    await axios.post('/api/events', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`,
      },
    })

    newEventForm.value.eventName = ''
    newEventTemplate.value = null
    await loadDashboardData()
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal membuat event')
  } finally {
    isCreatingEvent.value = false
  }
}

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <section class="admin-section">
    <div class="container">
      <!-- If Not Logged In: Elegant Login Card (Triv.co.id Style) -->
      <div v-if="!user" class="login-wrapper">
        <div class="login-card glass-card">
          <div class="login-header">
            <div class="login-icon-box">
              <Lock :size="24" />
            </div>
            <h2 class="login-title">Autentikasi Admin</h2>
            <p class="login-sub">Masuk untuk mengelola event &amp; menerbitkan e-sertifikat berkeamanan LSB</p>
          </div>

          <form @submit.prevent="handleLogin" class="login-form">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input
                type="text"
                v-model="loginUsername"
                class="form-input"
                placeholder="Username admin"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Password</label>
              <input
                type="password"
                v-model="loginPassword"
                class="form-input"
                placeholder="Kata sandi"
                required
              />
            </div>

            <div v-if="loginError" class="login-error-alert">
              <AlertTriangle :size="16" />
              <span>{{ loginError }}</span>
            </div>

            <button type="submit" class="btn btn-primary btn-block" :disabled="isLoggingIn">
              <RefreshCw v-if="isLoggingIn" :size="16" class="spin-icon" />
              <LogIn v-else :size="16" />
              <span>{{ isLoggingIn ? 'Memverifikasi...' : 'Masuk Dashboard' }}</span>
            </button>
          </form>

          <div class="demo-creds-hint">
            <span>Satu Login Terpadu: <strong>admin</strong> (Fakultas) atau <strong>NIM</strong> (Mahasiswa) &bull; Password tetap: <strong>123</strong></span>
          </div>
        </div>
      </div>

      <!-- If Logged In: Full Admin Dashboard -->
      <div v-else class="dashboard-wrapper">
        <!-- Dashboard Top Bar -->
        <div class="dash-header">
          <div>
            <div class="badge badge-brand">
              <ShieldCheck :size="14" />
              <span>ADMINISTRASI RESMI FAKULTAS</span>
            </div>
            <h2 class="dash-title">Admin Studio E-Sertifikat</h2>
            <p class="dash-sub">Kelola agenda kegiatan, penerbitan steganografi LSB, serta audit verifikasi.</p>
          </div>
          <div class="user-pill">
            <div class="u-avatar">{{ user.name.charAt(0) }}</div>
            <div>
              <div class="u-name">{{ user.name }}</div>
              <div class="u-role">{{ user.role.toUpperCase() }}</div>
            </div>
          </div>
        </div>

        <!-- Metric Stat Cards (Triv.co.id Style) -->
        <div class="stats-row">
          <div class="stat-box glass-card">
            <div class="stat-top">
              <span class="stat-title">Total E-Sertifikat Terbit</span>
              <Award :size="20" class="stat-icon text-gold" />
            </div>
            <div class="stat-number">{{ stats?.totalCertificatesIssued || certificates.length }}</div>
            <div class="stat-foot">Keamanan LSB &amp; SHA-256</div>
          </div>

          <div class="stat-box glass-card">
            <div class="stat-top">
              <span class="stat-title">Agenda / Event Aktif</span>
              <Calendar :size="20" class="stat-icon text-coral" />
            </div>
            <div class="stat-number">{{ events.length }}</div>
            <div class="stat-foot">Fakultas &amp; HIMA UINSA</div>
          </div>

          <div class="stat-box glass-card">
            <div class="stat-top">
              <span class="stat-title">Total Pemeriksaan Publik</span>
              <Activity :size="20" class="stat-icon text-emerald" />
            </div>
            <div class="stat-number">{{ stats?.totalVerifications || logs.length }}</div>
            <div class="stat-foot">{{ stats?.validCount || 0 }} Valid | {{ stats?.manipulatedCount || 0 }} Manipulasi</div>
          </div>

          <div class="stat-box glass-card">
            <div class="stat-top">
              <span class="stat-title">Rata-rata Mutu Citra</span>
              <ShieldCheck :size="20" class="stat-icon text-peach" />
            </div>
            <div class="stat-number">&gt; 85 dB</div>
            <div class="stat-foot">Standar Proposal (&ge; 45 dB)</div>
          </div>
        </div>

        <!-- Navigation Tabs inside Studio -->
        <div class="studio-tabs glass-card">
          <button
            class="s-tab-btn"
            :class="{ active: activeSubTab === 'generator' }"
            @click="activeSubTab = 'generator'"
          >
            <Award :size="16" />
            <span>Penerbitan Tunggal</span>
          </button>
          <button
            class="s-tab-btn"
            :class="{ active: activeSubTab === 'bulk' }"
            @click="activeSubTab = 'bulk'"
          >
            <FileSpreadsheet :size="16" />
            <span>Penerbitan Massal (Bulk CSV)</span>
          </button>
          <button
            class="s-tab-btn"
            :class="{ active: activeSubTab === 'events' }"
            @click="activeSubTab = 'events'"
          >
            <Calendar :size="16" />
            <span>Manajemen Event</span>
          </button>
          <button
            class="s-tab-btn"
            :class="{ active: activeSubTab === 'logs' }"
            @click="activeSubTab = 'logs'"
          >
            <Activity :size="16" />
            <span>Log Audit Verifikasi</span>
          </button>
        </div>

        <!-- TAB 1: Single Generator -->
        <div v-if="activeSubTab === 'generator'" class="tab-pane">
          <div class="grid-2-col">
            <!-- Form Card -->
            <div class="glass-card pane-card">
              <h3 class="pane-title">Penerbitan E-Sertifikat Tunggal</h3>
              <p class="pane-sub">Secara otomatis menghasilkan intisari hash SHA-256 dan menyisipkan bit LSB pada citra PNG.</p>

              <form @submit.prevent="handleSingleGenerate" class="studio-form">
                <div class="form-group">
                  <label class="form-label">Pilih Agenda Kegiatan</label>
                  <select v-model="genForm.eventId" class="form-select" required>
                    <option v-for="e in events" :key="e.id" :value="e.id">
                      {{ e.eventName }} ({{ e.eventDate }})
                    </option>
                  </select>
                </div>

                <div class="grid-2-col-sm">
                  <div class="form-group">
                    <label class="form-label">Nama Lengkap Penerima</label>
                    <input type="text" v-model="genForm.recipientName" class="form-input" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">NIM / Identifikasi</label>
                    <input type="text" v-model="genForm.recipientIdentifier" class="form-input" required />
                  </div>
                </div>

                <div class="grid-2-col-sm">
                  <div class="form-group">
                    <label class="form-label">Peran Partisipasi</label>
                    <select v-model="genForm.recipientRole" class="form-select">
                      <option value="Peserta">Peserta</option>
                      <option value="Pemateri">Pemateri</option>
                      <option value="Moderator">Moderator</option>
                      <option value="Panitia Penyelenggara">Panitia Penyelenggara</option>
                      <option value="Juara 1">Juara 1</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Resolusi Citra E-Sertifikat</label>
                    <select v-model="genForm.resolution" class="form-select">
                      <option value="1080p">Full HD (1920 × 1080 px) - Batch 1</option>
                      <option value="300dpi">A4 Landscape (2480 × 1754 px, 300 DPI) - Batch 2</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Nomor Sertifikat (Opsional, kosongkan untuk auto-generate)</label>
                  <input
                    type="text"
                    v-model="genForm.certificateNumber"
                    class="form-input"
                    placeholder="Contoh: UINSA/FST/SI/2026/015"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Unggah Template Desain Kustom (Opsional, format PNG)</label>
                  <input
                    type="file"
                    accept=".png,image/png"
                    @change="handleCoverFileChange"
                    class="form-input"
                  />
                  <small class="form-hint">Jika dikosongkan, template resmi UIN Sunan Ampel Surabaya akan digenerate otomatis.</small>
                </div>

                <div v-if="genError" class="login-error-alert">
                  <AlertTriangle :size="16" />
                  <span>{{ genError }}</span>
                </div>

                <button type="submit" class="btn btn-primary btn-block" :disabled="isGenerating">
                  <RefreshCw v-if="isGenerating" :size="16" class="spin-icon" />
                  <Award v-else :size="16" />
                  <span>{{ isGenerating ? 'Membangkitkan Hash & Menyisipkan LSB...' : 'Generate & Terbitkan E-Sertifikat' }}</span>
                </button>
              </form>
            </div>

            <!-- Output Preview Card -->
            <div class="glass-card pane-card">
              <h3 class="pane-title">Status Hasil Pembangkitan</h3>
              <p class="pane-sub">Detail parameter kriptografi dan imperseptibilitas steganografi LSB.</p>

              <div v-if="genResult" class="gen-output-box">
                <div class="gen-success-badge">
                  <CheckCircle2 :size="20" class="text-emerald" />
                  <div>
                    <h4>E-Sertifikat Berhasil Diterbitkan!</h4>
                    <p>Payload metadata &amp; hash SHA-256 tersimpan di bit LSB.</p>
                  </div>
                </div>

                <!-- Parameters list -->
                <div class="param-grid">
                  <div class="p-row">
                    <span class="p-k">Nomor Sertifikat</span>
                    <span class="p-v text-gold">{{ genResult.certificate.certificateNumber }}</span>
                  </div>
                  <div class="p-row">
                    <span class="p-k">Nama Penerima</span>
                    <span class="p-v">{{ genResult.certificate.recipientName }}</span>
                  </div>
                  <div class="p-row">
                    <span class="p-k">Peak Signal-to-Noise Ratio (PSNR)</span>
                    <span class="p-v text-emerald font-bold">{{ genResult.embedStats.psnr }} dB</span>
                  </div>
                  <div class="p-row">
                    <span class="p-k">Mean Squared Error (MSE)</span>
                    <span class="p-v font-mono">{{ genResult.embedStats.mse }}</span>
                  </div>
                  <div class="p-row">
                    <span class="p-k">Penggunaan Kapasitas Spasial</span>
                    <span class="p-v">{{ genResult.embedStats.payloadBitsCount }} bit ({{ genResult.embedStats.capacityUsagePercentage }}%)</span>
                  </div>
                  <div class="p-row">
                    <span class="p-k">Waktu Komputasi</span>
                    <span class="p-v">{{ genResult.embedStats.executionTimeMs }} ms</span>
                  </div>
                </div>

                <!-- Hash block -->
                <div class="hash-block">
                  <span class="hash-lbl">Nilai Intisari Kriptografis (SHA-256 Digest):</span>
                  <div class="code-box">{{ genResult.embedStats.sha256Hash }}</div>
                </div>

                <div class="gen-action-btns">
                  <a
                    :href="`/api/certificates/${genResult.certificate.id}/download`"
                    download
                    class="btn btn-primary btn-block"
                  >
                    <Download :size="16" />
                    <span>Unduh Berkas Stego PNG Asli</span>
                  </a>
                </div>
              </div>

              <div v-else class="empty-gen-state">
                <Award :size="48" class="text-faint" />
                <p>Isi formulir di sebelah kiri dan klik tombol terbitkan untuk melihat parameter steganografi dan mengunduh sertifikat.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: Bulk CSV Generator -->
        <div v-if="activeSubTab === 'bulk'" class="tab-pane">
          <div class="glass-card pane-card">
            <h3 class="pane-title">Penerbitan Massal (Bulk CSV Import)</h3>
            <p class="pane-sub">Terbitkan puluhan sertifikat sekaligus untuk peserta kegiatan dengan satu kali klik.</p>

            <div class="form-group">
              <label class="form-label">Pilih Agenda Kegiatan</label>
              <select v-model="bulkEventId" class="form-select" required>
                <option v-for="e in events" :key="e.id" :value="e.id">{{ e.eventName }}</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Daftar Penerima (Format: Nama,NIM,Peran per baris)</label>
              <textarea v-model="bulkCsvText" rows="6" class="form-textarea font-mono"></textarea>
            </div>

            <button
              class="btn btn-primary"
              :disabled="isBulkProcessing"
              @click="handleBulkGenerate"
            >
              <RefreshCw v-if="isBulkProcessing" :size="16" class="spin-icon" />
              <FileSpreadsheet v-else :size="16" />
              <span>{{ isBulkProcessing ? 'Memproses Seluruh Sertifikat...' : 'Proses Penerbitan Massal' }}</span>
            </button>

            <!-- Bulk Result -->
            <div v-if="bulkResult" class="bulk-result-box">
              <h4 class="text-emerald">Penerbitan Massal Selesai!</h4>
              <p>Berhasil diterbitkan: <strong>{{ bulkResult.totalSuccess }}</strong> | Gagal: {{ bulkResult.totalFailed }}</p>
              <div class="bulk-list">
                <div v-for="c in bulkResult.items" :key="c.id" class="bulk-item">
                  <span>{{ c.recipientName }} ({{ c.recipientIdentifier }})</span>
                  <a :href="`/api/certificates/${c.id}/download`" download class="btn btn-secondary btn-sm">
                    <Download :size="13" />
                    <span>Unduh PNG</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: Event Management -->
        <div v-if="activeSubTab === 'events'" class="tab-pane">
          <div class="grid-2-col">
            <!-- Create Event -->
            <div class="glass-card pane-card">
              <h3 class="pane-title">Tambah Agenda / Seminar Baru</h3>
              <form @submit.prevent="handleCreateEvent" class="studio-form">
                <div class="form-group">
                  <label class="form-label">Nama Kegiatan</label>
                  <input type="text" v-model="newEventForm.eventName" class="form-input" placeholder="Contoh: Seminar Nasional AI 2026" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Tanggal Pelaksanaan</label>
                  <input type="date" v-model="newEventForm.eventDate" class="form-input" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Instansi Penyelenggara</label>
                  <input type="text" v-model="newEventForm.organizer" class="form-input" required />
                </div>
                <button type="submit" class="btn btn-primary" :disabled="isCreatingEvent">
                  <PlusCircle :size="16" />
                  <span>Simpan Agenda</span>
                </button>
              </form>
            </div>

            <!-- Event List -->
            <div class="glass-card pane-card">
              <h3 class="pane-title">Daftar Agenda Kegiatan Terdaftar</h3>
              <div class="events-list">
                <div v-for="evt in events" :key="evt.id" class="event-item">
                  <div>
                    <h4 class="e-name">{{ evt.eventName }}</h4>
                    <p class="e-sub">{{ evt.eventDate }} • {{ evt.organizer }}</p>
                  </div>
                  <span class="badge badge-brand">{{ evt.totalCertificates || 0 }} Sertifikat</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 4: Audit Logs -->
        <div v-if="activeSubTab === 'logs'" class="tab-pane">
          <div class="glass-card pane-card">
            <h3 class="pane-title">Log Audit Riwayat Verifikasi Publik</h3>
            <p class="pane-sub">Catatan audit transparan setiap upaya verifikasi e-sertifikat yang masuk ke sistem.</p>

            <div class="table-wrap">
              <table class="log-table">
                <thead>
                  <tr>
                    <th>Waktu (WIB)</th>
                    <th>IP Pemohon</th>
                    <th>No. Sertifikat</th>
                    <th>Nama Tertera</th>
                    <th>Status Validasi</th>
                    <th>Keterangan Sistem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in logs" :key="log.id">
                    <td class="font-mono text-faint">{{ new Date(log.verifiedAt).toLocaleString('id-ID') }}</td>
                    <td class="font-mono">{{ log.ipAddress }}</td>
                    <td class="font-mono text-gold">{{ log.certificateNumber || '-' }}</td>
                    <td>{{ log.recipientName || '-' }}</td>
                    <td>
                      <span
                        class="badge"
                        :class="{
                          'badge-valid': log.verificationStatus === 'ASLI_VALID',
                          'badge-manipulated': log.verificationStatus === 'MANIPULASI_TERDETEKSI',
                        }"
                      >
                        {{ log.verificationStatus }}
                      </span>
                    </td>
                    <td class="text-muted text-sm">{{ log.message }}</td>
                  </tr>
                  <tr v-if="logs.length === 0">
                    <td colspan="6" class="text-center text-muted">Belum ada riwayat verifikasi.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-section {
  padding: 40px 0 80px;
}

/* Login Card */
.login-wrapper {
  max-width: 440px;
  margin: 40px auto;
}

.login-card {
  padding: 36px;
  background: var(--grad-dark-card);
  border: 1px solid rgba(218, 101, 86, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.login-icon-box {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--grad-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  color: #FFFFFF;
}

.login-title {
  font-size: 1.45rem;
  font-weight: 800;
  color: #FFFFFF;
}

.login-sub {
  font-size: 0.84rem;
  color: var(--text-muted);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-error-alert {
  padding: 10px 14px;
  background: var(--color-danger-bg);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: var(--radius-sm);
  color: #FCA5A5;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.demo-creds-hint {
  text-align: center;
  margin-top: 20px;
  font-size: 0.78rem;
  color: var(--text-faint);
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.demo-creds-hint strong {
  color: var(--c-fd);
}

/* Dashboard */
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 28px;
}

.dash-title {
  font-size: 2.1rem;
  font-weight: 800;
  color: #FFFFFF;
}

.dash-sub {
  font-size: 0.95rem;
  color: var(--text-muted);
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  padding: 8px 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
}

.u-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--grad-primary);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.u-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #FFFFFF;
}

.u-role {
  font-size: 0.7rem;
  color: var(--c-fd);
  font-weight: 700;
}

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.stat-box {
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stat-title {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}

.stat-number {
  font-size: 2rem;
  font-weight: 800;
  color: #FFFFFF;
  font-family: var(--font-mono);
}

.stat-foot {
  font-size: 0.72rem;
  color: var(--text-faint);
  margin-top: 4px;
}

/* Studio Tabs */
.studio-tabs {
  display: flex;
  gap: 8px;
  padding: 6px;
  margin-bottom: 24px;
}

.s-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.s-tab-btn:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.05);
}

.s-tab-btn.active {
  background: var(--grad-primary);
  color: #FFFFFF;
}

/* Pane */
.grid-2-col {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 24px;
}

.grid-2-col-sm {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.pane-card {
  padding: 26px;
}

.pane-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 4px;
}

.pane-sub {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.form-hint {
  font-size: 0.74rem;
  color: var(--text-faint);
  margin-top: 4px;
}

.gen-output-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gen-success-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 12px;
  border-radius: var(--radius-sm);
}

.gen-success-badge h4 {
  font-size: 0.95rem;
  color: #34D399;
}

.gen-success-badge p {
  font-size: 0.76rem;
  color: var(--text-muted);
}

.param-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: var(--radius-sm);
}

.p-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
}

.p-k {
  color: var(--text-muted);
}

.p-v {
  font-weight: 700;
  color: #FFFFFF;
}

.hash-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hash-lbl {
  font-size: 0.74rem;
  color: var(--text-faint);
  font-weight: 600;
}

.empty-gen-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-faint);
  font-size: 0.88rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* Bulk */
.bulk-result-box {
  margin-top: 20px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 16px;
  border-radius: var(--radius-md);
}

.bulk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  max-height: 250px;
  overflow-y: auto;
}

.bulk-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.84rem;
}

/* Events */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  padding: 14px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.e-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #FFFFFF;
}

.e-sub {
  font-size: 0.76rem;
  color: var(--text-faint);
}

/* Table */
.table-wrap {
  overflow-x: auto;
  margin-top: 14px;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.log-table th {
  text-align: left;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.4);
  color: var(--text-faint);
  font-weight: 700;
  font-size: 0.74rem;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-subtle);
}

.log-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.text-gold { color: var(--c-fd); }
.text-coral { color: var(--c-da); }
.text-peach { color: var(--c-eb); }
.text-emerald { color: #34D399; }
.font-bold { font-weight: 700; }
.spin-icon { animation: spin 1s infinite linear; }

@media (max-width: 992px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
  .grid-2-col { grid-template-columns: 1fr; }
}
</style>
