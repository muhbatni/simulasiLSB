<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
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
  UserCheck,
  Eye,
  FileText,
  Filter,
  CheckSquare,
  Square,
  Archive,
  Power
} from 'lucide-vue-next'

const props = defineProps({
  user: { type: Object, default: null }
})

const emit = defineEmits(['login-success'])

const authStore = useAuthStore()

const activeSubTab = ref('events') // 'events' (ujung kiri) | 'recipients' | 'generator' | 'issued' | 'logs'
const events = ref([])
const certificates = ref([])
const stats = ref(null)
const logs = ref([])

// Login State
const loginUsername = ref('admin')
const loginPassword = ref('123')
const loginError = ref('')
const isLoggingIn = ref(false)

// Active Selected Event for Management
const selectedEventId = ref('')
const selectedEventRecipients = ref([])
const isLoadingRecipients = ref(false)

// Single Recipient Add Form (F-04)
const showAddRecipientModal = ref(false)
const newRecipientForm = ref({
  certificateNumber: '',
  recipientName: '',
  recipientIdentifier: '',
  recipientRole: 'Peserta',
})
const isAddingRecipient = ref(false)
const addRecipientError = ref('')

// CSV Import Modal & Preview (F-05)
const showCsvImportModal = ref(false)
const csvTextInput = ref(`UINSA/FST/2026/011,Dewi Lestari,09020623011,Peserta
UINSA/FST/2026/012,Bagus Setiawan,09020623012,Peserta
UINSA/FST/2026/013,Fitri Handayani,09020623013,Peserta
UINSA/FST/2026/014,Rizki Pratama,09020623014,Pemateri`)
const csvFile = ref(null)
const isPreviewingCsv = ref(false)
const isImportingCsv = ref(false)
const csvPreviewData = ref(null)
const csvImportError = ref('')

// Issuance Selection (F-06)
const selectedRecipientIds = ref([])
const isIssuing = ref(false)
const issueResolution = ref('1080p')
const issueResult = ref(null)

// Issued Certs & ZIP Selection (F-07)
const selectedIssuedCertIds = ref([])
const isDownloadingZip = ref(false)

// Event Form & Editing (F-03)
const newEventForm = ref({
  eventName: '',
  eventDate: new Date().toISOString().split('T')[0],
  organizer: 'Fakultas Sains dan Teknologi UIN Sunan Ampel Surabaya',
})
const newEventTemplate = ref(null)
const isCreatingEvent = ref(false)

// Instant Single Generator Form (Legacy support)
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

// Audit Logs Filter (F-11)
const logStatusFilter = ref('')
const logSearchQuery = ref('')
const isLoadingLogs = ref(false)

const handleLogin = async () => {
  loginError.value = ''
  isLoggingIn.value = true
  try {
    const user = await authStore.login(loginUsername.value, loginPassword.value)
    emit('login-success', user)
    await loadDashboardData()
  } catch (err) {
    loginError.value = authStore.error || 'Username atau password salah'
  } finally {
    isLoggingIn.value = false
  }
}

const handleDownloadCertificate = async (certId, recipientName, certNumber) => {
  try {
    const res = await api.get(`/certificates/${certId}/download`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'image/png' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const namePart = (recipientName || 'Penerima').replace(/[^a-zA-Z0-9_-]/g, '_')
    const numPart = (certNumber || 'Sertifikat').replace(/[^a-zA-Z0-9_-]/g, '_')
    link.download = `Sertifikat-${namePart}-${numPart}.png`
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal mengunduh sertifikat')
  }
}

const loadDashboardData = async () => {
  try {
    const [eventsRes, certsRes, statsRes] = await Promise.all([
      api.get('/events'),
      api.get('/certificates'),
      api.get('/verification/stats'),
    ])
    events.value = eventsRes.data
    certificates.value = certsRes.data
    stats.value = statsRes.data

    if (events.value.length > 0 && !selectedEventId.value) {
      selectedEventId.value = events.value[0].id
      genForm.value.eventId = events.value[0].id
    }

    if (selectedEventId.value) {
      await loadRecipients(selectedEventId.value)
    }

    await loadLogs()
  } catch (err) {
    console.error('Gagal memuat data dashboard:', err)
  }
}

const loadRecipients = async (eventId) => {
  if (!eventId) return
  isLoadingRecipients.value = true
  selectedRecipientIds.value = []
  try {
    const res = await api.get(`/events/${eventId}/recipients`)
    selectedEventRecipients.value = res.data
  } catch (err) {
    console.error('Gagal memuat penerima event:', err)
  } finally {
    isLoadingRecipients.value = false
  }
}

const handleEventChange = async () => {
  await loadRecipients(selectedEventId.value)
}

// F-04: Tambah Calon Penerima Individual
const handleAddRecipient = async () => {
  if (!selectedEventId.value) return
  isAddingRecipient.value = true
  addRecipientError.value = ''

  try {
    await api.post(
      `/events/${selectedEventId.value}/recipients`,
      newRecipientForm.value
    )
    showAddRecipientModal.value = false
    newRecipientForm.value = {
      certificateNumber: '',
      recipientName: '',
      recipientIdentifier: '',
      recipientRole: 'Peserta',
    }
    await loadRecipients(selectedEventId.value)
  } catch (err) {
    addRecipientError.value = err.response?.data?.message || 'Gagal menambahkan penerima'
  } finally {
    isAddingRecipient.value = false
  }
}

// F-05: CSV Import with Preview
const handleCsvFileChange = (e) => {
  csvFile.value = e.target.files[0]
}

const handlePreviewCsv = async () => {
  if (!selectedEventId.value) return
  isPreviewingCsv.value = true
  csvImportError.value = ''
  csvPreviewData.value = null

  try {
    const formData = new FormData()
    if (csvFile.value) {
      formData.append('csvFile', csvFile.value)
    } else {
      formData.append('csvText', csvTextInput.value)
    }
    formData.append('preview', 'true')

    const res = await api.post(
      `/events/${selectedEventId.value}/recipients/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    csvPreviewData.value = res.data
  } catch (err) {
    csvImportError.value = err.response?.data?.message || 'Gagal membaca berkas CSV'
  } finally {
    isPreviewingCsv.value = false
  }
}

const handleExecuteCsvImport = async () => {
  if (!selectedEventId.value) return
  isImportingCsv.value = true
  csvImportError.value = ''

  try {
    const formData = new FormData()
    if (csvFile.value) {
      formData.append('csvFile', csvFile.value)
    } else {
      formData.append('csvText', csvTextInput.value)
    }
    formData.append('preview', 'false')

    await api.post(
      `/events/${selectedEventId.value}/recipients/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    showCsvImportModal.value = false
    csvPreviewData.value = null
    csvFile.value = null
    await loadRecipients(selectedEventId.value)
    alert('Impor massal penerima berhasil disimpan dengan status Belum Terbit!')
  } catch (err) {
    csvImportError.value = err.response?.data?.message || 'Gagal mengimpor data CSV'
  } finally {
    isImportingCsv.value = false
  }
}

// F-06: Penerbitan Sertifikat (SHA-256 + LSB)
const toggleSelectAllRecipients = () => {
  const unpublished = selectedEventRecipients.value.filter((r) => r.status === 'BELUM_TERBIT')
  if (selectedRecipientIds.value.length === unpublished.length) {
    selectedRecipientIds.value = []
  } else {
    selectedRecipientIds.value = unpublished.map((r) => r.id)
  }
}

const handleIssueSelected = async () => {
  if (!selectedEventId.value) return
  isIssuing.value = true
  issueResult.value = null

  try {
    const res = await api.post(
      '/certificates/issue',
      {
        eventId: selectedEventId.value,
        recipientIds: selectedRecipientIds.value.length > 0 ? selectedRecipientIds.value : undefined,
        resolution: issueResolution.value,
      }
    )
    issueResult.value = res.data
    selectedRecipientIds.value = []
    await loadRecipients(selectedEventId.value)
    await loadDashboardData()
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal menerbitkan sertifikat')
  } finally {
    isIssuing.value = false
  }
}

// F-07: Unduh ZIP Banyak Sertifikat Sekaligus
const toggleSelectAllIssued = () => {
  if (selectedIssuedCertIds.value.length === certificates.value.length) {
    selectedIssuedCertIds.value = []
  } else {
    selectedIssuedCertIds.value = certificates.value.map((c) => c.id)
  }
}

const handleDownloadZip = async () => {
  if (selectedIssuedCertIds.value.length === 0) {
    alert('Pilih minimal satu sertifikat untuk diunduh sebagai ZIP')
    return
  }
  isDownloadingZip.value = true
  try {
    const res = await api.post(
      '/certificates/download-zip',
      { certificateIds: selectedIssuedCertIds.value },
      {
        responseType: 'blob',
      }
    )
    const blob = new Blob([res.data], { type: 'application/zip' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `E-Sertifikat-Lossless-UINSA-${Date.now()}.zip`
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (err) {
    alert('Gagal mengunduh ZIP sertifikat')
  } finally {
    isDownloadingZip.value = false
  }
}

// F-03: Event Management (Create, Toggle Active, Delete)
const handleCreateEvent = async () => {
  if (!newEventForm.value.eventName) return
  isCreatingEvent.value = true
  try {
    const formData = new FormData()
    formData.append('eventName', newEventForm.value.eventName)
    formData.append('eventDate', newEventForm.value.eventDate)
    formData.append('organizer', newEventForm.value.organizer)

    if (newEventTemplate.value) {
      formData.append('templateImage', newEventTemplate.value)
    }

    await api.post('/events', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    newEventForm.value.eventName = ''
    newEventTemplate.value = null
    await loadDashboardData()
    alert('Agenda kegiatan berhasil ditambahkan!')
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal membuat event')
  } finally {
    isCreatingEvent.value = false
  }
}

const handleToggleEventActive = async (event) => {
  try {
    await api.patch(
      `/events/${event.id}`,
      { isActive: !event.isActive }
    )
    await loadDashboardData()
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal mengubah status event')
  }
}

const handleDeleteEvent = async (event) => {
  const confirmMsg = `Yakin ingin menghapus agenda '${event.eventName}'?`
  if (!confirm(confirmMsg)) return

  try {
    await api.delete(`/events/${event.id}`)
    await loadDashboardData()
    alert('Agenda berhasil dihapus.')
  } catch (err) {
    alert(err.response?.data?.message || 'Event yang sudah memiliki sertifikat terbit tidak dapat dihapus, hanya dapat dinonaktifkan.')
  }
}

// F-11: Audit Logs Filter & CSV Export
const loadLogs = async () => {
  isLoadingLogs.value = true
  try {
    const params = new URLSearchParams()
    if (logStatusFilter.value) params.append('status', logStatusFilter.value)
    if (logSearchQuery.value) params.append('q', logSearchQuery.value)

    const res = await api.get(`/verification/logs?${params.toString()}`)
    logs.value = res.data
  } catch (err) {
    console.error('Gagal memuat log:', err)
  } finally {
    isLoadingLogs.value = false
  }
}

const handleExportLogsCsv = async () => {
  try {
    const res = await api.get('/verification/logs/export-csv', {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `VerificationLogs-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (err) {
    alert('Gagal mengekspor CSV riwayat verifikasi')
  }
}

// Instant Single Generate Form
const handleCoverFileChange = (e) => {
  customCoverFile.value = e.target.files[0]
}

const handleSingleGenerate = async () => {
  isGenerating.value = true
  genError.value = ''
  genResult.value = null

  try {
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

    const res = await api.post('/certificates/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
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

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <section class="admin-section">
    <div class="container">
      <!-- Login Form if not logged in -->
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
            <span>Login Admin: <strong>admin</strong> (Fakultas) &bull; Password: <strong>123</strong></span>
          </div>
        </div>
      </div>

      <!-- Full Admin Dashboard -->
      <div v-else class="dashboard-wrapper">
        <!-- Top Banner -->
        <div class="dash-header">
          <div>
            <div class="badge badge-brand">
              <ShieldCheck :size="14" />
              <span>ADMINISTRASI RESMI FAKULTAS</span>
            </div>
            <h2 class="dash-title">Admin Studio E-Sertifikat</h2>
            <p class="dash-sub">Kelola calon penerima, impor massal CSV, steganografi LSB, serta audit log verifikasi.</p>
          </div>
          <div class="user-pill">
            <div class="u-avatar">{{ user.name.charAt(0) }}</div>
            <div>
              <div class="u-name">{{ user.name }}</div>
              <div class="u-role">{{ user.role.toUpperCase() }}</div>
            </div>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="stats-row">
          <div class="stat-box glass-card">
            <div class="stat-top">
              <span class="stat-title">Total Sertifikat Terbit</span>
              <Award :size="20" class="stat-icon text-gold" />
            </div>
            <div class="stat-number">{{ stats?.totalCertificatesIssued || certificates.length }}</div>
            <div class="stat-foot">Keamanan LSB &amp; SHA-256</div>
          </div>

          <div class="stat-box glass-card">
            <div class="stat-top">
              <span class="stat-title">Agenda / Event Terdaftar</span>
              <Calendar :size="20" class="stat-icon text-coral" />
            </div>
            <div class="stat-number">{{ events.length }}</div>
            <div class="stat-foot">Fakultas &amp; HIMA UINSA</div>
          </div>

          <div class="stat-box glass-card">
            <div class="stat-top">
              <span class="stat-title">Total Verifikasi Masuk</span>
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
            <div class="stat-number">&gt; 80 dB</div>
            <div class="stat-foot">Standar Mutu (&ge; 45 dB)</div>
          </div>
        </div>

        <!-- Studio Subtabs -->
        <div class="studio-tabs glass-card">
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
            :class="{ active: activeSubTab === 'recipients' }"
            @click="activeSubTab = 'recipients'"
          >
            <UserCheck :size="16" />
            <span>Penerima &amp; Penerbitan</span>
          </button>
          <button
            class="s-tab-btn"
            :class="{ active: activeSubTab === 'generator' }"
            @click="activeSubTab = 'generator'"
          >
            <Award :size="16" />
            <span>Penerbitan Cepat</span>
          </button>
          <button
            class="s-tab-btn"
            :class="{ active: activeSubTab === 'issued' }"
            @click="activeSubTab = 'issued'"
          >
            <Archive :size="16" />
            <span>Unduh Berkas / ZIP</span>
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

        <!-- TAB 1: Recipients & Issuance (F-04, F-05, F-06) -->
        <div v-if="activeSubTab === 'recipients'" class="tab-pane">
          <div class="glass-card pane-card">
            <!-- Event Selector & Action Bar -->
            <div class="recipients-top-bar">
              <div class="event-picker-box">
                <label class="form-label">Pilih Agenda Kegiatan:</label>
                <select v-model="selectedEventId" @change="handleEventChange" class="form-select event-select">
                  <option v-for="e in events" :key="e.id" :value="e.id">
                    {{ e.eventName }} ({{ e.eventDate }})
                  </option>
                </select>
              </div>

              <div class="recipients-actions">
                <a href="/api/events/recipients/template-csv" download class="btn btn-secondary btn-sm">
                  <Download :size="14" />
                  <span>Unduh Templat CSV</span>
                </a>
                <button class="btn btn-secondary btn-sm" @click="showCsvImportModal = true">
                  <FileSpreadsheet :size="14" />
                  <span>Impor CSV</span>
                </button>
                <button class="btn btn-primary btn-sm" @click="showAddRecipientModal = true">
                  <PlusCircle :size="14" />
                  <span>Tambah Penerima</span>
                </button>
              </div>
            </div>

            <!-- Issuance Action Ribbon -->
            <div class="issuance-control-ribbon">
              <div class="issuance-left">
                <span class="sel-count">
                  Terpilih: <strong>{{ selectedRecipientIds.length }}</strong> dari {{ selectedEventRecipients.filter(r => r.status === 'BELUM_TERBIT').length }} yang belum terbit
                </span>
                <select v-model="issueResolution" class="form-select form-select-sm" style="width: auto;">
                  <option value="1080p">Resolusi Full HD (1920 &times; 1080 px)</option>
                  <option value="300dpi">Resolusi A4 300 DPI (2480 &times; 1754 px)</option>
                </select>
              </div>
              <button
                class="btn btn-primary btn-sm"
                :disabled="isIssuing || selectedEventRecipients.filter(r => r.status === 'BELUM_TERBIT').length === 0"
                @click="handleIssueSelected"
              >
                <RefreshCw v-if="isIssuing" :size="14" class="spin-icon" />
                <Award v-else :size="14" />
                <span>{{ isIssuing ? 'Menghitung SHA-256 & Embedding LSB...' : 'Terbitkan Sertifikat' }}</span>
              </button>
            </div>

            <!-- Issue Result Banner -->
            <div v-if="issueResult" class="issue-result-alert">
              <CheckCircle2 :size="18" class="text-emerald" />
              <div>
                <strong>Penerbitan Selesai!</strong>
                <span> {{ issueResult.successCount }} berhasil diterbitkan, {{ issueResult.failedCount }} gagal. Berkas PNG lossless siap diunduh.</span>
              </div>
            </div>

            <!-- Recipients Table -->
            <div class="table-wrap">
              <table class="log-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">
                      <input
                        type="checkbox"
                        @change="toggleSelectAllRecipients"
                        :checked="selectedRecipientIds.length > 0 && selectedRecipientIds.length === selectedEventRecipients.filter(r => r.status === 'BELUM_TERBIT').length"
                      />
                    </th>
                    <th>No. Sertifikat</th>
                    <th>Nama Penerima</th>
                    <th>NIM / Identifikasi</th>
                    <th>Peran</th>
                    <th>Status</th>
                    <th>Hash SHA-256</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in selectedEventRecipients" :key="r.id">
                    <td>
                      <input
                        type="checkbox"
                        v-if="r.status === 'BELUM_TERBIT'"
                        :value="r.id"
                        v-model="selectedRecipientIds"
                      />
                    </td>
                    <td class="font-mono text-gold">{{ r.certificateNumber }}</td>
                    <td class="font-bold">{{ r.recipientName }}</td>
                    <td class="font-mono">{{ r.recipientIdentifier }}</td>
                    <td>{{ r.recipientRole }}</td>
                    <td>
                      <span
                        class="badge"
                        :class="r.status === 'TERBIT' ? 'badge-valid' : 'badge-brand'"
                      >
                        {{ r.status === 'TERBIT' ? 'Terbit' : 'Belum Terbit' }}
                      </span>
                    </td>
                    <td class="font-mono text-xs">
                      {{ r.sha256Hash ? r.sha256Hash.slice(0, 16) + '...' : '-' }}
                    </td>
                    <td>
                      <button
                        v-if="r.status === 'TERBIT'"
                        type="button"
                        class="btn btn-secondary btn-sm"
                        title="Unduh PNG Asli"
                        @click="handleDownloadCertificate(r.id, r.recipientName, r.certificateNumber)"
                      >
                        <Download :size="12" />
                        <span>Unduh</span>
                      </button>
                      <span v-else class="text-faint text-xs">Menunggu terbit</span>
                    </td>
                  </tr>
                  <tr v-if="selectedEventRecipients.length === 0">
                    <td colspan="8" class="text-center text-muted">
                      Belum ada data penerima untuk agenda ini. Gunakan tombol 'Tambah Penerima' atau 'Impor CSV'.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB 2: Issued Certs & Lossless ZIP Export (F-07) -->
        <div v-if="activeSubTab === 'issued'" class="tab-pane">
          <div class="glass-card pane-card">
            <!-- Warning Banner from Spec F-07 -->
            <div class="lossless-warning-banner">
              <AlertTriangle :size="20" class="text-gold" />
              <div>
                <h4 class="warn-title">PENTING: Integritas Steganografi LSB</h4>
                <p class="warn-desc">
                  Kirim berkas e-sertifikat kepada penerima sebagai <strong>dokumen / berkas asli</strong> (bukan sebagai foto di WhatsApp atau media sosial) karena kompresi lossy JPEG/WebP merusak bit terendah (LSB) dan membatalkan keaslian sertifikat saat diverifikasi.
                </p>
              </div>
            </div>

            <div class="card-action-bar">
              <div>
                <h3 class="pane-title">Daftar E-Sertifikat Terbit</h3>
                <p class="pane-sub">Pilih beberapa sertifikat untuk mengunduh arsip ZIP lossless (bit LSB utuh tanpa kompresi).</p>
              </div>
              <div class="btn-group">
                <button
                  class="btn btn-primary btn-sm"
                  :disabled="isDownloadingZip || selectedIssuedCertIds.length === 0"
                  @click="handleDownloadZip"
                >
                  <RefreshCw v-if="isDownloadingZip" :size="14" class="spin-icon" />
                  <Archive v-else :size="14" />
                  <span>Unduh ZIP ({{ selectedIssuedCertIds.length }} Terpilih)</span>
                </button>
              </div>
            </div>

            <div class="table-wrap">
              <table class="log-table">
                <thead>
                  <tr>
                    <th style="width: 40px;">
                      <input
                        type="checkbox"
                        @change="toggleSelectAllIssued"
                        :checked="selectedIssuedCertIds.length === certificates.length && certificates.length > 0"
                      />
                    </th>
                    <th>Nomor Sertifikat</th>
                    <th>Nama Penerima</th>
                    <th>NIM / ID</th>
                    <th>Agenda Kegiatan</th>
                    <th>Kualitas (PSNR)</th>
                    <th>Segel Hash SHA-256</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in certificates" :key="c.id">
                    <td>
                      <input type="checkbox" :value="c.id" v-model="selectedIssuedCertIds" />
                    </td>
                    <td class="font-mono text-gold">{{ c.certificateNumber }}</td>
                    <td class="font-bold">{{ c.recipientName }}</td>
                    <td class="font-mono">{{ c.recipientIdentifier }}</td>
                    <td>{{ c.eventName }}</td>
                    <td class="font-mono text-emerald">{{ c.psnr }} dB</td>
                    <td class="font-mono text-xs">{{ c.sha256Hash?.slice(0, 16) }}...</td>
                    <td>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        @click="handleDownloadCertificate(c.id, c.recipientName, c.certificateNumber)"
                      >
                        <Download :size="13" />
                        <span>PNG</span>
                      </button>
                    </td>
                  </tr>
                  <tr v-if="certificates.length === 0">
                    <td colspan="8" class="text-center text-muted">Belum ada e-sertifikat yang diterbitkan.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- TAB 3: Event Management (F-03) -->
        <div v-if="activeSubTab === 'events'" class="tab-pane">
          <div class="grid-2-col">
            <!-- Create Event Form -->
            <div class="glass-card pane-card">
              <h3 class="pane-title">Tambah Agenda Kegiatan Baru</h3>
              <p class="pane-sub">Unggah template sertifikat PNG (maks 10 MB) dengan magic bytes tervalidasi.</p>

              <form @submit.prevent="handleCreateEvent" class="studio-form">
                <div class="form-group">
                  <label class="form-label">Nama Kegiatan</label>
                  <input
                    type="text"
                    v-model="newEventForm.eventName"
                    class="form-input"
                    placeholder="Contoh: Seminar Nasional AI & Keamanan Digital 2026"
                    required
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Tanggal Pelaksanaan</label>
                  <VueDatePicker
                    v-model="newEventForm.eventDate"
                    model-type="yyyy-MM-dd"
                    format="yyyy-MM-dd"
                    :enable-time-picker="false"
                    auto-apply
                    placeholder="Pilih Tanggal Pelaksanaan"
                    dark
                    required
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Instansi Penyelenggara</label>
                  <input type="text" v-model="newEventForm.organizer" class="form-input" required />
                </div>

                <div class="form-group">
                  <label class="form-label">Unggah Citra Template Sertifikat (Wajib PNG Lossless)</label>
                  <input
                    type="file"
                    accept=".png,image/png"
                    @change="(e) => (newEventTemplate = e.target.files[0])"
                    class="form-input"
                  />
                  <small class="form-hint">Format PNG murni (maks 10 MB). Nama peserta akan dioverlay otomatis sebelum LSB embedding.</small>
                </div>

                <button type="submit" class="btn btn-primary" :disabled="isCreatingEvent">
                  <RefreshCw v-if="isCreatingEvent" :size="16" class="spin-icon" />
                  <PlusCircle v-else :size="16" />
                  <span>Simpan Agenda Event</span>
                </button>
              </form>
            </div>

            <!-- Events List -->
            <div class="glass-card pane-card">
              <h3 class="pane-title">Daftar Agenda Kegiatan Terdaftar</h3>
              <p class="pane-sub">Event dengan sertifikat terbit dilindungi dari penghapusan permanen (hanya dinonaktifkan).</p>

              <div class="events-list">
                <div v-for="evt in events" :key="evt.id" class="event-item glass-card">
                  <div class="e-info">
                    <div class="e-badge-row">
                      <span class="badge" :class="evt.isActive !== false ? 'badge-valid' : 'badge-manipulated'">
                        {{ evt.isActive !== false ? 'Aktif' : 'Nonaktif' }}
                      </span>
                      <span class="badge badge-brand">{{ evt.totalCertificates || 0 }} Sertifikat Terbit</span>
                    </div>
                    <h4 class="e-name">{{ evt.eventName }}</h4>
                    <p class="e-sub">{{ evt.eventDate }} &bull; {{ evt.organizer }}</p>
                  </div>

                  <div class="e-actions">
                    <button
                      class="btn btn-secondary btn-sm"
                      @click="handleToggleEventActive(evt)"
                      :title="evt.isActive !== false ? 'Nonaktifkan Event' : 'Aktifkan Event'"
                    >
                      <Power :size="14" />
                      <span>{{ evt.isActive !== false ? 'Nonaktifkan' : 'Aktifkan' }}</span>
                    </button>
                    <button
                      class="btn btn-danger-sm"
                      @click="handleDeleteEvent(evt)"
                      title="Hapus Event"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 4: Instant Generator (Single) -->
        <div v-if="activeSubTab === 'generator'" class="tab-pane">
          <div class="grid-2-col">
            <div class="glass-card pane-card">
              <h3 class="pane-title">Penerbitan E-Sertifikat Cepat (Tunggal)</h3>
              <p class="pane-sub">Secara instan menyisipkan segel integritas SHA-256 dan bit LSB pada citra PNG.</p>

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
                      <option value="1080p">Full HD (1920 &times; 1080 px) - Batch 1</option>
                      <option value="300dpi">A4 Landscape (2480 &times; 1754 px, 300 DPI) - Batch 2</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Nomor Sertifikat (Opsional)</label>
                  <input
                    type="text"
                    v-model="genForm.certificateNumber"
                    class="form-input"
                    placeholder="Contoh: UINSA/FST/SI/2026/015"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Template Kustom (Opsional, format PNG)</label>
                  <input
                    type="file"
                    accept=".png,image/png"
                    @change="handleCoverFileChange"
                    class="form-input"
                  />
                </div>

                <button type="submit" class="btn btn-primary" :disabled="isGenerating">
                  <RefreshCw v-if="isGenerating" :size="16" class="spin-icon" />
                  <Award v-else :size="16" />
                  <span>{{ isGenerating ? 'Memproses Steganografi LSB...' : 'Terbitkan Sekarang' }}</span>
                </button>
              </form>
            </div>

            <!-- Single Gen Result Card -->
            <div class="glass-card pane-card">
              <h3 class="pane-title">Hasil Pembangkitan LSB</h3>
              <div v-if="genResult" class="gen-result-content">
                <div class="result-badge-row">
                  <span class="badge badge-valid">
                    <CheckCircle2 :size="13" />
                    <span>LSB Embedding Sukses</span>
                  </span>
                  <span class="font-mono text-sm text-gold">{{ genResult.certificate.certificateNumber }}</span>
                </div>

                <div class="metrics-grid-compact">
                  <div class="m-card">
                    <span class="k">PSNR Kualitas</span>
                    <span class="v text-emerald">{{ genResult.embedStats.psnr }} dB</span>
                  </div>
                  <div class="m-card">
                    <span class="k">MSE Error</span>
                    <span class="v">{{ genResult.embedStats.mse }}</span>
                  </div>
                  <div class="m-card">
                    <span class="k">Waktu Komputasi</span>
                    <span class="v text-gold">{{ genResult.embedStats.executionTimeMs }} ms</span>
                  </div>
                  <div class="m-card">
                    <span class="k">Kapasitas Bit</span>
                    <span class="v">{{ genResult.embedStats.payloadBitsCount }} bits</span>
                  </div>
                </div>

                <div class="hash-block">
                  <span class="hash-lbl">Nilai Intisari Kriptografis (SHA-256 Digest):</span>
                  <div class="code-box">{{ genResult.embedStats.sha256Hash }}</div>
                </div>

                <button
                  type="button"
                  class="btn btn-primary btn-block"
                  @click="handleDownloadCertificate(genResult.certificate.id, genResult.certificate.recipientName, genResult.certificate.certificateNumber)"
                >
                  <Download :size="16" />
                  <span>Unduh Berkas Stego PNG Asli</span>
                </button>
              </div>
              <div v-else class="empty-gen-state">
                <Award :size="48" class="text-faint" />
                <p>Isi formulir dan klik terbitkan untuk melihat parameter matematis LSB.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 5: Verification Audit Logs (F-11) -->
        <div v-if="activeSubTab === 'logs'" class="tab-pane">
          <div class="glass-card pane-card">
            <!-- Filter & Action Bar -->
            <div class="logs-filter-bar">
              <div class="filter-inputs">
                <select v-model="logStatusFilter" @change="loadLogs" class="form-select form-select-sm">
                  <option value="">Semua Status Validasi</option>
                  <option value="ASLI_VALID">ASLI_VALID (Integritas Cocok)</option>
                  <option value="MANIPULASI_TERDETEKSI">MANIPULASI_TERDETEKSI (Integritas Rusak)</option>
                  <option value="FORMAT_TIDAK_VALID">FORMAT_TIDAK_VALID (Non-PNG / Corrupt)</option>
                </select>

                <input
                  type="text"
                  v-model="logSearchQuery"
                  @keyup.enter="loadLogs"
                  placeholder="Cari NIM, No. Sertifikat, IP..."
                  class="form-input form-input-sm"
                  style="max-width: 250px;"
                />

                <button class="btn btn-secondary btn-sm" @click="loadLogs">
                  <Filter :size="13" />
                  <span>Saring</span>
                </button>
              </div>

              <button class="btn btn-primary btn-sm" @click="handleExportLogsCsv">
                <Download :size="14" />
                <span>Ekspor CSV Log</span>
              </button>
            </div>

            <!-- Logs Table -->
            <div class="table-wrap">
              <table class="log-table">
                <thead>
                  <tr>
                    <th>Waktu (WIB)</th>
                    <th>IP Pemohon</th>
                    <th>No. Sertifikat</th>
                    <th>Nama Tertera</th>
                    <th>Status Validasi</th>
                    <th>Latensi</th>
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
                          'badge-brand': log.verificationStatus === 'FORMAT_TIDAK_VALID',
                        }"
                      >
                        {{ log.verificationStatus }}
                      </span>
                    </td>
                    <td class="font-mono">{{ log.tVerifMs ? `${log.tVerifMs} ms` : '-' }}</td>
                    <td class="text-muted text-sm">{{ log.message }}</td>
                  </tr>
                  <tr v-if="logs.length === 0">
                    <td colspan="7" class="text-center text-muted">Belum ada riwayat verifikasi yang sesuai kriteria.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal F-04: Tambah Calon Penerima Individual -->
    <div v-if="showAddRecipientModal" class="modal-backdrop" @click="showAddRecipientModal = false">
      <div class="modal-dialog glass-card" @click.stop style="max-width: 500px;">
        <div class="modal-header">
          <h3 class="modal-title">Tambah Calon Penerima</h3>
          <button class="close-btn" @click="showAddRecipientModal = false">&times;</button>
        </div>
        <form @submit.prevent="handleAddRecipient" class="modal-body">
          <div class="form-group">
            <label class="form-label">Nama Lengkap Penerima</label>
            <input type="text" v-model="newRecipientForm.recipientName" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label">NIM / Identifikasi Mahasiswa</label>
            <input type="text" v-model="newRecipientForm.recipientIdentifier" class="form-input" required />
          </div>
          <div class="form-group">
            <label class="form-label">Peran Partisipasi</label>
            <select v-model="newRecipientForm.recipientRole" class="form-select">
              <option value="Peserta">Peserta</option>
              <option value="Pemateri">Pemateri</option>
              <option value="Moderator">Moderator</option>
              <option value="Panitia Penyelenggara">Panitia Penyelenggara</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nomor Sertifikat (Opsional, unik)</label>
            <input type="text" v-model="newRecipientForm.certificateNumber" class="form-input" placeholder="Otomatis digenerate jika kosong" />
          </div>

          <div v-if="addRecipientError" class="login-error-alert">
            <AlertTriangle :size="15" />
            <span>{{ addRecipientError }}</span>
          </div>

          <div class="modal-footer" style="padding-top: 15px;">
            <button type="button" class="btn btn-secondary" @click="showAddRecipientModal = false">Batal</button>
            <button type="submit" class="btn btn-primary" :disabled="isAddingRecipient">
              <span>{{ isAddingRecipient ? 'Menyimpan...' : 'Simpan Penerima' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal F-05: Impor Massal CSV dengan Pratinjau -->
    <div v-if="showCsvImportModal" class="modal-backdrop" @click="showCsvImportModal = false">
      <div class="modal-dialog glass-card" @click.stop style="max-width: 650px;">
        <div class="modal-header">
          <h3 class="modal-title">Impor Massal Penerima CSV</h3>
          <button class="close-btn" @click="showCsvImportModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <p class="pane-sub">Unggah berkas CSV atau tempel teks data penerima (Maks. 500 baris).</p>

          <div class="form-group">
            <label class="form-label">Pilih Berkas CSV:</label>
            <input type="file" accept=".csv,text/csv" @change="handleCsvFileChange" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Atau Tempel Teks CSV (Format: nomor_sertifikat,nama,nim_email,peran):</label>
            <textarea v-model="csvTextInput" rows="5" class="form-textarea font-mono"></textarea>
          </div>

          <div class="btn-group" style="margin-bottom: 15px;">
            <button class="btn btn-secondary btn-sm" :disabled="isPreviewingCsv" @click="handlePreviewCsv">
              <RefreshCw v-if="isPreviewingCsv" :size="13" class="spin-icon" />
              <Eye v-else :size="13" />
              <span>Pratinjau Validasi Baris</span>
            </button>
          </div>

          <!-- Preview Results Box -->
          <div v-if="csvPreviewData" class="csv-preview-box">
            <div class="preview-badge-row">
              <span class="badge badge-valid">{{ csvPreviewData.validCount }} Baris Valid</span>
              <span v-if="csvPreviewData.invalidCount > 0" class="badge badge-manipulated">
                {{ csvPreviewData.invalidCount }} Baris Bermasalah
              </span>
            </div>

            <div class="preview-scroll-table">
              <table class="log-table" style="font-size: 0.8rem;">
                <thead>
                  <tr>
                    <th>Baris</th>
                    <th>Nomor</th>
                    <th>Nama</th>
                    <th>NIM/ID</th>
                    <th>Status Baris</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in csvPreviewData.rows" :key="row.rowNumber">
                    <td class="font-mono">{{ row.rowNumber }}</td>
                    <td class="font-mono">{{ row.certificateNumber }}</td>
                    <td>{{ row.recipientName }}</td>
                    <td class="font-mono">{{ row.recipientIdentifier }}</td>
                    <td>
                      <span v-if="row.isValid" class="text-emerald font-bold">&check; Valid</span>
                      <span v-else class="text-danger font-bold">&cross; {{ row.errorMessage }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="csvImportError" class="login-error-alert" style="margin-top: 10px;">
            <AlertTriangle :size="15" />
            <span>{{ csvImportError }}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCsvImportModal = false">Tutup</button>
          <button
            class="btn btn-primary"
            :disabled="isImportingCsv || !csvPreviewData || csvPreviewData.validCount === 0"
            @click="handleExecuteCsvImport"
          >
            <RefreshCw v-if="isImportingCsv" :size="14" class="spin-icon" />
            <span>Simpan {{ csvPreviewData?.validCount || 0 }} Baris Valid</span>
          </button>
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

/* Dashboard Header */
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
  margin-top: 4px;
}

.dash-sub {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.user-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 16px;
  border-radius: var(--radius-pill);
}

.u-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--grad-primary);
  color: #FFFFFF;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.u-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #FFFFFF;
}

.u-role {
  font-size: 0.7rem;
  color: var(--c-fd);
  font-weight: 800;
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 30px;
}

.stat-box {
  padding: 20px;
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
  font-size: 1.9rem;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 4px;
}

.stat-foot {
  font-size: 0.72rem;
  color: var(--text-faint);
}

/* Studio Tabs */
.studio-tabs {
  display: flex;
  gap: 6px;
  padding: 6px;
  margin-bottom: 24px;
  overflow-x: auto;
}

.s-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: all 0.2s;
}

.s-tab-btn:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.05);
}

.s-tab-btn.active {
  background: rgba(235, 137, 91, 0.2);
  color: var(--c-fd);
  border: 1px solid rgba(235, 137, 91, 0.4);
}

/* Panes */
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
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.grid-2-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.grid-2-col-sm {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Recipients Top Bar */
.recipients-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.event-picker-box {
  flex: 1;
  min-width: 280px;
}

.recipients-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.issuance-control-ribbon {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  margin-bottom: 16px;
}

.issuance-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sel-count {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.sel-count strong {
  color: var(--c-fd);
}

.issue-result-alert {
  padding: 12px 16px;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-md);
  color: #A7F3D0;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.lossless-warning-banner {
  padding: 14px 18px;
  background: rgba(253, 183, 115, 0.08);
  border: 1px solid rgba(253, 183, 115, 0.25);
  border-radius: var(--radius-md);
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
}

.warn-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--c-fd);
  margin-bottom: 4px;
}

.warn-desc {
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.45;
}

/* Event List */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-item {
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.e-badge-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.e-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 2px;
}

.e-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.e-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-danger-sm {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #F87171;
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.btn-danger-sm:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* Logs Filter */
.logs-filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Table styles */
.table-wrap {
  overflow-x: auto;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.log-table th {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  font-weight: 600;
}

.log-table td {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #E2E8F0;
}

/* Modal styles */
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
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #FFFFFF;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.csv-preview-box {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-top: 12px;
}

.preview-badge-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.preview-scroll-table {
  max-height: 200px;
  overflow-y: auto;
}

/* Single Gen Result */
.gen-result-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.result-badge-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metrics-grid-compact {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.m-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
}

.m-card .k {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.m-card .v {
  font-size: 1.1rem;
  font-weight: 700;
  color: #FFFFFF;
}

.hash-block {
  background: #090708;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px;
  border-radius: var(--radius-sm);
}

.hash-lbl {
  font-size: 0.72rem;
  color: var(--c-fd);
  display: block;
  margin-bottom: 4px;
}

.code-box {
  font-family: monospace;
  font-size: 0.75rem;
  color: #E2E8F0;
  word-break: break-all;
}

.empty-gen-state {
  text-align: center;
  padding: 50px 20px;
  color: var(--text-muted);
  font-size: 0.88rem;
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid-2-col {
    grid-template-columns: 1fr;
  }
}

/* Custom VueDatePicker theme integration */
:deep(.dp__theme_dark) {
  --dp-background-color: #121826;
  --dp-text-color: #f1f5f9;
  --dp-hover-color: rgba(218, 101, 86, 0.18);
  --dp-hover-text-color: #ffffff;
  --dp-hover-icon-color: #ffffff;
  --dp-primary-color: #da6556;
  --dp-primary-disabled-color: rgba(218, 101, 86, 0.5);
  --dp-primary-text-color: #ffffff;
  --dp-secondary-color: #94a3b8;
  --dp-border-color: rgba(255, 255, 255, 0.14);
  --dp-menu-border-color: rgba(255, 255, 255, 0.18);
  --dp-border-color-hover: #da6556;
  --dp-disabled-color: #475569;
  --dp-scroll-bar-background: #1e293b;
  --dp-scroll-bar-color: #475569;
  --dp-success-color: #10b981;
  --dp-icon-color: #94a3b8;
  --dp-danger-color: #ef4444;
}
:deep(.dp__input) {
  border-radius: 8px !important;
  background: rgba(15, 23, 42, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #f8fafc !important;
  font-size: 0.9rem !important;
  padding: 10px 14px 10px 38px !important;
  font-family: inherit;
  transition: all 0.2s ease;
}
:deep(.dp__input:focus) {
  border-color: #da6556 !important;
  box-shadow: 0 0 0 2px rgba(218, 101, 86, 0.25) !important;
}
:deep(.dp__menu) {
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
</style>
