<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import { useDialogStore } from '../stores/dialog'
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
  Pencil,
  Clock,
  Move,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette
} from 'lucide-vue-next'

const props = defineProps({
  user: { type: Object, default: null }
})

const emit = defineEmits(['login-success'])

const authStore = useAuthStore()
const dialog = useDialogStore()

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
const csvTextInput = ref(`041/HIMAPROSIF/XI/2026/011,Dewi Lestari,09020623011,Peserta
041/HIMAPROSIF/XI/2026/012,Bagus Setiawan,09020623012,Peserta
041/HIMAPROSIF/XI/2026/013,Fitri Handayani,09020623013,Peserta
041/HIMAPROSIF/XI/2026/014,Rizki Pratama,09020623014,Pemateri`)
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

const formatDateOnly = (d) => {
  if (!d) return ''
  return String(d).split('T')[0].split(' ')[0]
}

const formatEventTime = (start, end) => {
  if (start && end) return `${start} - ${end} WIB`
  if (start) return `${start} WIB`
  if (end) return `s.d. ${end} WIB`
  return ''
}

// Event Form & Editing (F-03)
const newEventForm = ref({
  eventName: '',
  eventDate: new Date().toISOString().split('T')[0],
  startTime: '08:00',
  endTime: '12:00',
  organizer: 'Fakultas Sains dan Teknologi UIN Sunan Ampel Surabaya',
  certificatePrefix: '041/HIMAPROSIF/XI/2026/',
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

const currentEvent = computed(() => events.value.find((e) => e.id === selectedEventId.value))
const selectedEventForGen = computed(() => events.value.find((e) => e.id === genForm.value.eventId))

// Status penguncian dan nomor spoiler untuk Penerbitan Cepat
const hasEventPrefix = computed(() => {
  return !!(selectedEventForGen.value?.certificatePrefix && selectedEventForGen.value.certificatePrefix.trim())
})

const nextCertSpoiler = computed(() => {
  if (!selectedEventForGen.value) return ''
  if (selectedEventForGen.value.nextCertificateNumber) {
    return selectedEventForGen.value.nextCertificateNumber
  }
  const prefix = selectedEventForGen.value.certificatePrefix || '041/HIMAPROSIF/XI/2026/'
  return prefix + '001'
})

// Status penguncian dan nomor spoiler untuk Modal Tambah Penerima
const currentEventHasPrefix = computed(() => {
  return !!(currentEvent.value?.certificatePrefix && currentEvent.value.certificatePrefix.trim())
})

const currentEventNextSpoiler = computed(() => {
  if (!currentEvent.value) return ''
  if (currentEvent.value.nextCertificateNumber) {
    return currentEvent.value.nextCertificateNumber
  }
  const prefix = currentEvent.value.certificatePrefix || '041/HIMAPROSIF/XI/2026/'
  return prefix + '001'
})

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
    dialog.error(err.response?.data?.message || 'Gagal mengunduh sertifikat')
  }
}

// State Modal Pratinjau Citra PNG (Lossless LSB Stego)
const previewCert = ref(null)
const previewCertImageUrl = ref(null)
const isLoadingPreviewImage = ref(false)
const isVerifyingStored = ref(false)
const storedVerificationResult = ref(null)

const openCertPreview = async (cert) => {
  if (!cert) return
  const event = events.value.find((e) => e.id === cert.eventId)
  previewCert.value = {
    ...cert,
    eventName: cert.eventName || event?.eventName || 'Agenda Kegiatan',
    eventDate: cert.eventDate || event?.eventDate || '',
    organizer: cert.organizer || event?.organizer || '',
  }
  storedVerificationResult.value = null
  previewCertImageUrl.value = null
  isLoadingPreviewImage.value = true

  try {
    const res = await api.get(`/certificates/${cert.id}/download`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'image/png' })
    previewCertImageUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    dialog.error('Gagal memuat pratinjau sertifikat digital')
  } finally {
    isLoadingPreviewImage.value = false
  }
}

const closeCertPreview = () => {
  if (previewCertImageUrl.value) {
    URL.revokeObjectURL(previewCertImageUrl.value)
  }
  previewCert.value = null
  previewCertImageUrl.value = null
  isLoadingPreviewImage.value = false
  storedVerificationResult.value = null
}

const verifyStoredCertificate = async (certId) => {
  if (!certId) return
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
    const certNum = currentEventHasPrefix.value
      ? currentEventNextSpoiler.value
      : newRecipientForm.value.certificateNumber

    await api.post(
      `/events/${selectedEventId.value}/recipients`,
      {
        ...newRecipientForm.value,
        certificateNumber: certNum,
      }
    )
    showAddRecipientModal.value = false
    newRecipientForm.value = {
      certificateNumber: '',
      recipientName: '',
      recipientIdentifier: '',
      recipientRole: 'Peserta',
    }
    await loadRecipients(selectedEventId.value)
    await loadDashboardData()
  } catch (err) {
    addRecipientError.value = err.response?.data?.message || 'Gagal menambahkan penerima'
  } finally {
    isAddingRecipient.value = false
  }
}

// F-05: CSV Import with Preview
const handleDownloadCsvTemplate = () => {
  const csvContent = "nama,nim,peran\nAhmad Fulan,09020623001,Peserta\nSiti Nurhaliza,09020623002,Pemateri\nRaihan Maulana,09020623003,Panitia\n"
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', 'template_penerima_sertifikat.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

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
    dialog.success('Impor massal penerima berhasil disimpan dengan status Belum Terbit!')
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
    dialog.error(err.response?.data?.message || 'Gagal menerbitkan sertifikat')
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
    dialog.warning('Pilih minimal satu sertifikat untuk diunduh sebagai ZIP')
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
    dialog.error('Gagal mengunduh ZIP sertifikat')
  } finally {
    isDownloadingZip.value = false
  }
}

// F-03: Event Management (Create, Toggle Active, Delete)
const handleCreateEvent = async () => {
  if (!newEventForm.value.eventName) return

  const prefix = (newEventForm.value.certificatePrefix || '').trim()
  if (!prefix.endsWith('/')) {
    dialog.warning("Format nomor sertifikat ditolak! Harus diakhiri tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)")
    return
  }

  isCreatingEvent.value = true
  try {
    const formData = new FormData()
    formData.append('eventName', newEventForm.value.eventName)
    formData.append('eventDate', formatDateOnly(newEventForm.value.eventDate))
    if (newEventForm.value.startTime) formData.append('startTime', newEventForm.value.startTime)
    if (newEventForm.value.endTime) formData.append('endTime', newEventForm.value.endTime)
    formData.append('organizer', newEventForm.value.organizer)
    formData.append('certificatePrefix', prefix)

    if (newEventTemplate.value) {
      formData.append('templateImage', newEventTemplate.value)
    }

    const res = await api.post('/events', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    const createdEvent = res.data
    const hadTemplate = !!newEventTemplate.value

    newEventForm.value.eventName = ''
    newEventForm.value.eventDate = new Date().toISOString().split('T')[0]
    newEventForm.value.startTime = '08:00'
    newEventForm.value.endTime = '12:00'
    newEventForm.value.certificatePrefix = '041/HIMAPROSIF/XI/2026/'
    newEventTemplate.value = null
    await loadDashboardData()
    dialog.success('Agenda kegiatan berhasil ditambahkan!')

    // Jika event memiliki template citra, langsung buka modal Autocrat secara otomatis
    if (hadTemplate && createdEvent && createdEvent.id) {
      setTimeout(() => {
        openAutocratModal(createdEvent)
      }, 400)
    }
  } catch (err) {
    dialog.error(err.response?.data?.message || 'Gagal membuat event')
  } finally {
    isCreatingEvent.value = false
  }
}

// Edit Event State (CRUD Event: Update)
const showEditEventModal = ref(false)
const editingEventForm = ref({
  id: '',
  eventName: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  organizer: '',
  certificatePrefix: '',
})
const editEventTemplate = ref(null)
const isUpdatingEvent = ref(false)
const editEventError = ref('')

const openEditEventModal = (event) => {
  editingEventForm.value = {
    id: event.id,
    eventName: event.eventName || '',
    eventDate: formatDateOnly(event.eventDate),
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    organizer: event.organizer || '',
    certificatePrefix: event.certificatePrefix || '041/HIMAPROSIF/XI/2026/',
    templateImagePath: event.templateImagePath || '',
    templatePositions: event.templatePositions || null,
  }
  editEventTemplate.value = null
  editEventError.value = ''
  showEditEventModal.value = true
}

// ==========================================
// AUTOCRAT TEMPLATE POSITIONS VISUAL EDITOR
// ==========================================
const showAutocratModal = ref(false)
const autocratEvent = ref(null)
const autocratImageSrc = ref('')
const isLoadingAutocratImage = ref(false)
const isSavingAutocrat = ref(false)
const autocratError = ref('')
const activeAutocratElement = ref('name') // 'name' | 'role' | 'number'

const defaultPositions = {
  number: {
    x: 54.0,
    y: 26.5,
    fontSize: 16,
    color: '#333333',
    align: 'left',
    prefix: '',
    show: true,
    fontFamily: "'Segoe UI', Roboto, sans-serif",
    fontWeight: '600',
  },
  name: {
    x: 50.0,
    y: 40.5,
    fontSize: 46,
    color: '#A14646',
    align: 'center',
    prefix: '',
    show: true,
    fontFamily: 'Georgia, serif',
    fontWeight: 'bold',
  },
  role: {
    x: 64.5,
    y: 47.8,
    fontSize: 20,
    color: '#DA6556',
    align: 'left',
    prefix: '',
    show: true,
    fontFamily: "'Segoe UI', Roboto, sans-serif",
    fontWeight: '600',
  },
}

const autocratPositions = ref(JSON.parse(JSON.stringify(defaultPositions)))

const autocratCanvasRef = ref(null)

// Word-style Drag to Move State
const isDragging = ref(false)
const draggedElement = ref(null)
let dragStartPointerX = 0
let dragStartPointerY = 0
let dragStartPosX = 0
let dragStartPosY = 0

// Word-style 8-Handle Resize State
const isResizing = ref(false)
const resizingElement = ref(null)
const activeHandle = ref(null)
let resizeStartX = 0
let resizeStartY = 0
let resizeStartFontSize = 32

const autocratCanvasWidth = ref(800)
let canvasResizeObserver = null

const setupCanvasObserver = () => {
  if (canvasResizeObserver) {
    canvasResizeObserver.disconnect()
    canvasResizeObserver = null
  }
  if (autocratCanvasRef.value && typeof ResizeObserver !== 'undefined') {
    canvasResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          autocratCanvasWidth.value = entry.contentRect.width
        }
      }
    })
    canvasResizeObserver.observe(autocratCanvasRef.value)
  }
}

const onCanvasImgLoad = () => {
  if (autocratCanvasRef.value) {
    autocratCanvasWidth.value = autocratCanvasRef.value.clientWidth || 800
  }
  setupCanvasObserver()
}

const autocratFontScale = computed(() => {
  return Math.max(0.15, (autocratCanvasWidth.value || 800) / 1920)
})

const openAutocratModal = async (evt) => {
  if (!evt || !evt.id) return
  autocratEvent.value = evt
  autocratError.value = ''
  activeAutocratElement.value = 'name'

  // Muat posisi yang tersimpan atau gunakan default UIN rekomendasi
  if (evt.templatePositions && typeof evt.templatePositions === 'object') {
    autocratPositions.value = {
      number: { ...defaultPositions.number, ...(evt.templatePositions.number || {}) },
      name: { ...defaultPositions.name, ...(evt.templatePositions.name || {}) },
      role: { ...defaultPositions.role, ...(evt.templatePositions.role || {}) },
    }
  } else {
    autocratPositions.value = JSON.parse(JSON.stringify(defaultPositions))
  }

  showAutocratModal.value = true
  isLoadingAutocratImage.value = true
  autocratImageSrc.value = ''

  try {
    const res = await api.get(`/events/${evt.id}/template-image`, {
      responseType: 'blob',
    })
    autocratImageSrc.value = URL.createObjectURL(new Blob([res.data], { type: 'image/png' }))
    autocratError.value = ''
    nextTick(() => {
      onCanvasImgLoad()
      setupCanvasObserver()
    })
  } catch (err) {
    console.warn('Gagal memuat citra template kustom dari server, beralih ke templat standar:', err)
    autocratImageSrc.value = '/templates/certificate_template_default.png'
    autocratError.value = ''
    nextTick(() => {
      onCanvasImgLoad()
      setupCanvasObserver()
    })
  } finally {
    isLoadingAutocratImage.value = false
  }
}

const applyUinPreset = () => {
  autocratPositions.value = JSON.parse(JSON.stringify(defaultPositions))
}

const applyCenterPreset = () => {
  autocratPositions.value = {
    number: {
      x: 50.0,
      y: 28.0,
      fontSize: 16,
      color: '#444444',
      align: 'center',
      prefix: 'NOMOR: ',
      show: true,
      fontFamily: "'Courier New', Courier, monospace",
      fontWeight: '600',
    },
    name: {
      x: 50.0,
      y: 42.0,
      fontSize: 48,
      color: '#A14646',
      align: 'center',
      prefix: '',
      show: true,
      fontFamily: 'Georgia, serif',
      fontWeight: 'bold',
    },
    role: {
      x: 50.0,
      y: 50.0,
      fontSize: 22,
      color: '#DA6556',
      align: 'center',
      prefix: 'Sebagai ',
      show: true,
      fontFamily: "'Segoe UI', Roboto, sans-serif",
      fontWeight: '600',
    },
  }
}

// Relatif & Halus Drag to Move ala Microsoft Word
const startTagDrag = (elemKey, e) => {
  if (isResizing.value) return
  activeAutocratElement.value = elemKey
  isDragging.value = true
  draggedElement.value = elemKey
  if (e.cancelable) e.preventDefault()

  const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0
  const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0
  dragStartPointerX = clientX
  dragStartPointerY = clientY
  dragStartPosX = autocratPositions.value[elemKey]?.x || 50
  dragStartPosY = autocratPositions.value[elemKey]?.y || 50

  window.addEventListener('mousemove', onTagDragMove)
  window.addEventListener('mouseup', endTagDrag)
  window.addEventListener('touchmove', onTagTouchMove, { passive: false })
  window.addEventListener('touchend', endTagDrag)
  window.addEventListener('touchcancel', endTagDrag)
}

const onTagDragMove = (e) => {
  if (!isDragging.value || !draggedElement.value || !autocratCanvasRef.value) return
  updatePositionFromPointer(e.clientX, e.clientY)
}

const onTagTouchMove = (e) => {
  if (!isDragging.value || !draggedElement.value || !autocratCanvasRef.value) return
  if (e.touches && e.touches.length > 0) {
    if (e.cancelable) e.preventDefault()
    updatePositionFromPointer(e.touches[0].clientX, e.touches[0].clientY)
  }
}

const updatePositionFromPointer = (clientX, clientY) => {
  const rect = autocratCanvasRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const dxPct = ((clientX - dragStartPointerX) / rect.width) * 100
  const dyPct = ((clientY - dragStartPointerY) / rect.height) * 100

  let x = Math.round((dragStartPosX + dxPct) * 10) / 10
  let y = Math.round((dragStartPosY + dyPct) * 10) / 10

  x = Math.max(0, Math.min(100, x))
  y = Math.max(0, Math.min(100, y))

  if (autocratPositions.value[draggedElement.value]) {
    autocratPositions.value[draggedElement.value].x = x
    autocratPositions.value[draggedElement.value].y = y
  }
}

const endTagDrag = () => {
  isDragging.value = false
  draggedElement.value = null
  window.removeEventListener('mousemove', onTagDragMove)
  window.removeEventListener('mouseup', endTagDrag)
  window.removeEventListener('touchmove', onTagTouchMove)
  window.removeEventListener('touchend', endTagDrag)
  window.removeEventListener('touchcancel', endTagDrag)
}

// 8 Resize Handles Handler ala Microsoft Word (Perbesar/Perkecil Kotak & Font)
const startResize = (elemKey, handle, e) => {
  e.stopPropagation()
  if (e.cancelable) e.preventDefault()
  activeAutocratElement.value = elemKey
  isResizing.value = true
  resizingElement.value = elemKey
  activeHandle.value = handle
  resizeStartX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0
  resizeStartY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0
  resizeStartFontSize = autocratPositions.value[elemKey]?.fontSize || 32

  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', endResize)
  window.addEventListener('touchmove', onResizeTouchMove, { passive: false })
  window.addEventListener('touchend', endResize)
  window.addEventListener('touchcancel', endResize)
}

const onResizeMove = (e) => {
  if (!isResizing.value || !resizingElement.value) return
  handleResizeCalculation(e.clientX, e.clientY)
}

const onResizeTouchMove = (e) => {
  if (!isResizing.value || !resizingElement.value) return
  if (e.touches && e.touches.length > 0) {
    if (e.cancelable) e.preventDefault()
    handleResizeCalculation(e.touches[0].clientX, e.touches[0].clientY)
  }
}

const handleResizeCalculation = (clientX, clientY) => {
  const dx = clientX - resizeStartX
  const dy = clientY - resizeStartY
  let delta = 0
  const h = activeHandle.value

  if (h === 'br') {
    delta = (dx + dy) / 2
  } else if (h === 'tl') {
    delta = (-dx - dy) / 2
  } else if (h === 'tr') {
    delta = (dx - dy) / 2
  } else if (h === 'bl') {
    delta = (-dx + dy) / 2
  } else if (h === 'mr') {
    delta = dx
  } else if (h === 'ml') {
    delta = -dx
  } else if (h === 'bc') {
    delta = dy
  } else if (h === 'tc') {
    delta = -dy
  }

  // Sensitivitas resize (0.35 px font per px mouse movement)
  const newSize = Math.max(10, Math.min(120, Math.round(resizeStartFontSize + delta * 0.35)))
  if (autocratPositions.value[resizingElement.value]) {
    autocratPositions.value[resizingElement.value].fontSize = newSize
  }
}

const endResize = () => {
  isResizing.value = false
  resizingElement.value = null
  activeHandle.value = null
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', endResize)
  window.removeEventListener('touchmove', onResizeTouchMove)
  window.removeEventListener('touchend', endResize)
  window.removeEventListener('touchcancel', endResize)
}

const handleCanvasClick = (e) => {
  if (isDragging.value || isResizing.value || !activeAutocratElement.value || !autocratCanvasRef.value) return
  if (e.target.closest('.autocrat-word-box') || e.target.closest('.autocrat-handle')) return

  const rect = autocratCanvasRef.value.getBoundingClientRect()
  let x = ((e.clientX - rect.left) / rect.width) * 100
  let y = ((e.clientY - rect.top) / rect.height) * 100
  x = Math.max(0, Math.min(100, Math.round(x * 10) / 10))
  y = Math.max(0, Math.min(100, Math.round(y * 10) / 10))

  if (autocratPositions.value[activeAutocratElement.value]) {
    autocratPositions.value[activeAutocratElement.value].x = x
    autocratPositions.value[activeAutocratElement.value].y = y
  }
}

const handleSaveAutocratPositions = async () => {
  if (!autocratEvent.value) return
  isSavingAutocrat.value = true
  autocratError.value = ''

  try {
    await api.patch(`/events/${autocratEvent.value.id}/template-positions`, {
      templatePositions: autocratPositions.value,
    })

    const found = events.value.find((e) => e.id === autocratEvent.value.id)
    if (found) {
      found.templatePositions = JSON.parse(JSON.stringify(autocratPositions.value))
    }

    showAutocratModal.value = false
    dialog.success('Konfigurasi posisi teks template sertifikat berhasil disimpan!')
    await loadDashboardData()
  } catch (err) {
    autocratError.value = err.response?.data?.message || 'Gagal menyimpan posisi template'
  } finally {
    isSavingAutocrat.value = false
  }
}

const handleUpdateEvent = async () => {
  if (!editingEventForm.value.eventName) return

  const prefix = (editingEventForm.value.certificatePrefix || '').trim()
  if (prefix && !prefix.endsWith('/')) {
    editEventError.value = "Format nomor sertifikat ditolak! Harus diakhiri tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)"
    return
  }

  isUpdatingEvent.value = true
  editEventError.value = ''

  try {
    const formData = new FormData()
    formData.append('eventName', editingEventForm.value.eventName)
    formData.append('eventDate', formatDateOnly(editingEventForm.value.eventDate))
    formData.append('startTime', editingEventForm.value.startTime || '')
    formData.append('endTime', editingEventForm.value.endTime || '')
    formData.append('organizer', editingEventForm.value.organizer)
    if (prefix) {
      formData.append('certificatePrefix', prefix)
    }

    if (editEventTemplate.value) {
      formData.append('templateImage', editEventTemplate.value)
    }

    await api.patch(`/events/${editingEventForm.value.id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    showEditEventModal.value = false
    await loadDashboardData()
    dialog.success('Agenda kegiatan berhasil diperbarui!')
  } catch (err) {
    editEventError.value = err.response?.data?.message || 'Gagal memperbarui agenda kegiatan'
  } finally {
    isUpdatingEvent.value = false
  }
}

const handleDeleteEvent = async (event) => {
  const confirmed = await dialog.confirm(
    `Yakin ingin menghapus agenda '${event.eventName}'? Seluruh data sertifikat dan penerima terkait akan ikut terhapus.`,
    {
      title: 'Hapus Agenda Kegiatan',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      isDanger: true,
    }
  )
  if (!confirmed) return

  try {
    await api.delete(`/events/${event.id}`)
    if (selectedEventId.value === event.id) {
      selectedEventId.value = ''
    }
    await loadDashboardData()
    dialog.success('Agenda berhasil dihapus.')
  } catch (err) {
    dialog.error(err.response?.data?.message || 'Gagal menghapus event.')
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
    dialog.error('Gagal mengekspor CSV riwayat verifikasi')
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
    // Jika agenda kegiatan telah memiliki pola nomor di manajemen event, gunakan nomor spoiler otomatis
    if (hasEventPrefix.value) {
      formData.append('certificateNumber', nextCertSpoiler.value)
    } else if (genForm.value.certificateNumber) {
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

const handleGlobalKeydown = (e) => {
  if (e.key === 'Escape') {
    if (showAutocratModal.value) showAutocratModal.value = false
    if (showEditEventModal.value) showEditEventModal.value = false
    if (showAddRecipientModal.value) showAddRecipientModal.value = false
    if (showCsvImportModal.value) showCsvImportModal.value = false
    if (previewCert.value) closeCertPreview()
  }
}

onMounted(() => {
  loadDashboardData()
  window.addEventListener('resize', onCanvasImgLoad)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', onCanvasImgLoad)
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (canvasResizeObserver) {
    canvasResizeObserver.disconnect()
    canvasResizeObserver = null
  }
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

        <!-- Smooth Transition Wrapper for Studio Tabs -->
        <Transition name="tab-fade" mode="out-in">
          <!-- TAB 1: Recipients & Issuance (F-04, F-05, F-06) -->
          <div v-if="activeSubTab === 'recipients'" key="recipients" class="tab-pane">
          <div class="glass-card pane-card">
            <!-- Event Selector & Action Bar -->
            <div class="recipients-top-bar">
              <div class="event-picker-box">
                <label class="form-label">Pilih Agenda Kegiatan:</label>
                <select v-model="selectedEventId" @change="handleEventChange" class="form-select event-select">
                  <option v-for="e in events" :key="e.id" :value="e.id">
                    {{ e.eventName }} ({{ formatDateOnly(e.eventDate) }}{{ e.startTime ? ' ' + e.startTime : '' }})
                  </option>
                </select>
              </div>

              <div class="recipients-actions">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  @click="handleDownloadCsvTemplate"
                  title="Unduh Templat CSV Penerima (Format: nama, nim, peran)"
                >
                  <Download :size="14" />
                  <span>Unduh Templat CSV</span>
                </button>
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
                      <div v-if="r.status === 'TERBIT'" style="display: inline-flex; align-items: center; gap: 6px;">
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          title="Pratinjau Citra PNG"
                          @click="openCertPreview(r)"
                          style="border-color: rgba(253, 183, 115, 0.4); color: #fdb773;"
                        >
                          <Eye :size="13" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          title="Unduh PNG Asli"
                          @click="handleDownloadCertificate(r.id, r.recipientName, r.certificateNumber)"
                        >
                          <Download :size="12" />
                          <span>Unduh</span>
                        </button>
                      </div>
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
        <div v-else-if="activeSubTab === 'issued'" key="issued" class="tab-pane">
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
                      <div style="display: inline-flex; align-items: center; gap: 6px;">
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          title="Pratinjau Citra PNG"
                          @click="openCertPreview(c)"
                          style="border-color: rgba(253, 183, 115, 0.4); color: #fdb773;"
                        >
                          <Eye :size="13" />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          title="Unduh PNG Asli"
                          @click="handleDownloadCertificate(c.id, c.recipientName, c.certificateNumber)"
                        >
                          <Download :size="13" />
                          <span>PNG</span>
                        </button>
                      </div>
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
        <div v-else-if="activeSubTab === 'events'" key="events" class="tab-pane">
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
                    :time-config="{ enableTimePicker: false }"
                    :teleport="true"
                    teleport-center
                    auto-apply
                    placeholder="Pilih Tanggal Pelaksanaan"
                    dark
                    required
                  />
                </div>

                <div class="grid-2-col-sm">
                  <div class="form-group">
                    <label class="form-label">Waktu Mulai (Opsional)</label>
                    <VueDatePicker
                      v-model="newEventForm.startTime"
                      time-picker
                      model-type="HH:mm"
                      format="HH:mm"
                      :is-24="true"
                      :teleport="true"
                      teleport-center
                      auto-apply
                      placeholder="08:00"
                      dark
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Waktu Selesai (Opsional)</label>
                    <VueDatePicker
                      v-model="newEventForm.endTime"
                      time-picker
                      model-type="HH:mm"
                      format="HH:mm"
                      :is-24="true"
                      :teleport="true"
                      teleport-center
                      auto-apply
                      placeholder="12:00"
                      dark
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Instansi Penyelenggara</label>
                  <input type="text" v-model="newEventForm.organizer" class="form-input" required />
                </div>

                <div class="form-group">
                  <label class="form-label">Format / Pola Nomor Sertifikat (Wajib Akhiran '/')</label>
                  <input
                    type="text"
                    v-model="newEventForm.certificatePrefix"
                    class="form-input font-mono"
                    placeholder="Contoh: 041/HIMAPROSIF/XI/2026/"
                    required
                  />
                  <small class="form-hint">Format wajib diakhiri tanda garis miring '<code>/</code>' (contoh: <code>041/HIMAPROSIF/XI/2026/</code>). Nomor urut sertifikat (001, 002, dst.) otomatis ditambahkan setelah tanda garis miring.</small>
                </div>

                <div class="form-group">
                  <label class="form-label">Unggah Citra Template Sertifikat (Wajib PNG Lossless)</label>
                  <input
                    type="file"
                    accept=".png,image/png"
                    @change="(e) => (newEventTemplate = e.target.files[0])"
                    class="form-input"
                  />
                  <small class="form-hint" style="color: #fdb773;">
                    💡 <strong>Sistem Autocrat:</strong> Setelah menekan tombol <strong>Simpan Agenda Event</strong> di bawah, editor visual Autocrat akan langsung terbuka otomatis agar Anda dapat menggeser posisi Nama, Nomor Sertifikat, dan Peran.
                  </small>
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
              <p class="pane-sub">Kelola, sunting, dan hapus agenda kegiatan e-sertifikat.</p>

              <div class="events-list">
                <div v-for="evt in events" :key="evt.id" class="event-item glass-card">
                  <div class="e-info">
                    <div class="e-badge-row">
                      <span class="badge badge-brand">{{ evt.totalCertificates || 0 }} Sertifikat Terbit</span>
                      <span v-if="evt.certificatePrefix" class="badge badge-brand font-mono">
                        Pola: {{ evt.certificatePrefix }}XXX
                      </span>
                      <span v-if="evt.templateImagePath" class="badge badge-valid">Template PNG Terunggah</span>
                      <span v-else class="badge badge-manipulated">Tanpa Template</span>
                      <span v-if="evt.startTime || evt.endTime" class="badge badge-brand">
                        <Clock :size="12" /> {{ formatEventTime(evt.startTime, evt.endTime) }}
                      </span>
                    </div>
                    <h4 class="e-name">{{ evt.eventName }}</h4>
                    <p class="e-sub">
                      <span>{{ formatDateOnly(evt.eventDate) }}</span>
                      <span v-if="evt.startTime || evt.endTime"> &bull; {{ formatEventTime(evt.startTime, evt.endTime) }}</span>
                      <span> &bull; {{ evt.organizer }}</span>
                    </p>
                  </div>

                  <div class="e-actions">
                    <button
                      v-if="evt.templateImagePath"
                      class="btn btn-secondary btn-sm"
                      @click="openAutocratModal(evt)"
                      title="Atur Posisi Teks Template (Autocrat)"
                      style="border-color: rgba(235, 137, 91, 0.4); color: #fdb773;"
                    >
                      <Layers :size="14" />
                      <span>Atur Posisi (Autocrat)</span>
                    </button>
                    <button
                      class="btn btn-secondary btn-sm"
                      @click="openEditEventModal(evt)"
                      title="Edit Agenda Kegiatan"
                    >
                      <Pencil :size="14" />
                      <span>Edit</span>
                    </button>
                    <button
                      class="btn btn-danger-sm"
                      @click="handleDeleteEvent(evt)"
                      title="Hapus Agenda Kegiatan"
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
        <div v-else-if="activeSubTab === 'generator'" key="generator" class="tab-pane">
          <div class="grid-2-col">
            <div class="glass-card pane-card">
              <h3 class="pane-title">Penerbitan E-Sertifikat Cepat (Tunggal)</h3>
              <p class="pane-sub">Secara instan menyisipkan segel integritas SHA-256 dan bit LSB pada citra PNG.</p>

              <form @submit.prevent="handleSingleGenerate" class="studio-form">
                <div class="form-group">
                  <label class="form-label">Pilih Agenda Kegiatan</label>
                  <select v-model="genForm.eventId" class="form-select" required>
                    <option v-for="e in events" :key="e.id" :value="e.id">
                      {{ e.eventName }} ({{ formatDateOnly(e.eventDate) }}{{ e.startTime ? ' ' + e.startTime : '' }})
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
                  <label class="form-label">Nomor Sertifikat</label>

                  <div class="input-with-lock-wrap">
                    <input
                      type="text"
                      :value="hasEventPrefix ? nextCertSpoiler : genForm.certificateNumber"
                      @input="e => { if (!hasEventPrefix) genForm.certificateNumber = e.target.value }"
                      :disabled="hasEventPrefix"
                      class="form-input font-mono"
                      :class="{ 'input-locked': hasEventPrefix }"
                      :placeholder="hasEventPrefix ? nextCertSpoiler : 'Contoh: 041/HIMAPROSIF/XI/2026/001'"
                    />
                    <Lock v-if="hasEventPrefix" :size="16" class="input-lock-icon" />
                  </div>

                  <small v-if="hasEventPrefix" class="form-hint text-gold">
                    🔒 <strong>Nomor Dinonaktifkan:</strong> Telah diatur pada manajemen event. Sertifikat ini otomatis akan diterbitkan dengan nomor: <strong class="text-white">{{ nextCertSpoiler }}</strong>.
                  </small>
                  <small v-else class="form-hint">
                    Kosongkan untuk penomoran otomatis berurutan sesuai pola agenda event: <code>{{ selectedEventForGen?.certificatePrefix || '041/HIMAPROSIF/XI/2026/' }}001</code>
                  </small>
                </div>

                <div class="form-group">
                  <label class="form-label">Template Kustom (Opsional, format PNG)</label>
                  <input
                    type="file"
                    accept=".png,image/png"
                    @change="handleCoverFileChange"
                    class="form-input"
                  />
                  <small class="form-hint" style="color: #6ee7b7;">
                    🎨 <strong>Mode Citra Murni:</strong> Citra PNG yang diunggah akan dipertahankan desain visual aslinya 100% tanpa ditimpa teks, cukup disematkan bit LSB steganografi dan segel integritas SHA-256.
                  </small>
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

                <div style="display: flex; gap: 10px; margin-top: 6px;">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    title="Pratinjau Citra PNG"
                    @click="openCertPreview(genResult.certificate)"
                    style="flex: 1; border-color: rgba(253, 183, 115, 0.4); color: #fdb773; justify-content: center;"
                  >
                    <Eye :size="15" />
                    <span>Pratinjau PNG</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    @click="handleDownloadCertificate(genResult.certificate.id, genResult.certificate.recipientName, genResult.certificate.certificateNumber)"
                    style="flex: 1; justify-content: center;"
                  >
                    <Download :size="15" />
                    <span>Unduh PNG</span>
                  </button>
                </div>
              </div>
              <div v-else class="empty-gen-state">
                <Award :size="48" class="text-faint" />
                <p>Isi formulir dan klik terbitkan untuk melihat parameter matematis LSB.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 5: Verification Audit Logs (F-11) -->
        <div v-else-if="activeSubTab === 'logs'" key="logs" class="tab-pane">
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
        </Transition>
      </div>
    </div>

    <!-- Modal: Edit Agenda Kegiatan (CRUD Event: Update) -->
    <Teleport to="body">
      <div v-if="showEditEventModal" class="modal-backdrop" @click="showEditEventModal = false">
        <div class="modal-dialog glass-card" @click.stop style="max-width: 550px;">
          <div class="modal-header">
            <h3 class="modal-title">Edit Agenda Kegiatan</h3>
            <button type="button" class="close-btn" @click="showEditEventModal = false" title="Tutup Modal (Esc)">&times;</button>
          </div>
          <form @submit.prevent="handleUpdateEvent" class="modal-body">
          <div class="form-group">
            <label class="form-label">Nama Kegiatan</label>
            <input
              type="text"
              v-model="editingEventForm.eventName"
              class="form-input"
              placeholder="Contoh: Seminar Nasional AI & Keamanan Digital 2026"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Tanggal Pelaksanaan</label>
            <VueDatePicker
              v-model="editingEventForm.eventDate"
              model-type="yyyy-MM-dd"
              format="yyyy-MM-dd"
              :enable-time-picker="false"
              :time-config="{ enableTimePicker: false }"
              :teleport="true"
              teleport-center
              auto-apply
              placeholder="Pilih Tanggal Pelaksanaan"
              dark
              required
            />
          </div>

          <div class="grid-2-col-sm">
            <div class="form-group">
              <label class="form-label">Waktu Mulai (Opsional)</label>
              <VueDatePicker
                v-model="editingEventForm.startTime"
                time-picker
                model-type="HH:mm"
                format="HH:mm"
                :is-24="true"
                :teleport="true"
                teleport-center
                auto-apply
                placeholder="08:00"
                dark
              />
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Selesai (Opsional)</label>
              <VueDatePicker
                v-model="editingEventForm.endTime"
                time-picker
                model-type="HH:mm"
                format="HH:mm"
                :is-24="true"
                :teleport="true"
                teleport-center
                auto-apply
                placeholder="12:00"
                dark
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Instansi Penyelenggara</label>
            <input
              type="text"
              v-model="editingEventForm.organizer"
              class="form-input"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Format / Pola Nomor Sertifikat (Wajib Akhiran '/')</label>
            <input
              type="text"
              v-model="editingEventForm.certificatePrefix"
              class="form-input font-mono"
              placeholder="Contoh: 041/HIMAPROSIF/XI/2026/"
              required
            />
            <small class="form-hint">Format harus diakhiri tanda garis miring '<code>/</code>' (contoh: <code>041/HIMAPROSIF/XI/2026/</code>). Nomor urutan peserta (001, 002, dst.) diteruskan otomatis.</small>
          </div>

          <div class="form-group">
            <label class="form-label">Ganti Citra Template Sertifikat (Opsional, PNG Maks 10 MB)</label>
            <input
              type="file"
              accept=".png,image/png"
              @change="(e) => (editEventTemplate = e.target.files[0])"
              class="form-input"
            />
            <small class="form-hint">Biarkan kosong jika tidak ingin mengubah template yang sudah ada.</small>
          </div>

          <div v-if="editingEventForm.templateImagePath" class="form-group" style="margin-top: -6px; margin-bottom: 12px;">
            <button
              type="button"
              class="btn btn-secondary btn-sm w-full"
              @click="openAutocratModal(editingEventForm)"
              style="border-color: rgba(235, 137, 91, 0.4); color: #fdb773;"
            >
              <Layers :size="14" />
              <span>🎨 Buka Editor Posisi Teks Template (Autocrat)</span>
            </button>
          </div>

          <div v-if="editEventError" class="login-error-alert">
            <AlertTriangle :size="15" />
            <span>{{ editEventError }}</span>
          </div>

          <div class="modal-footer" style="padding-top: 15px;">
            <button type="button" class="btn btn-secondary" @click="showEditEventModal = false">Batal</button>
            <button type="submit" class="btn btn-primary" :disabled="isUpdatingEvent">
              <RefreshCw v-if="isUpdatingEvent" :size="16" class="spin-icon" />
              <CheckCircle2 v-else :size="16" />
              <span>{{ isUpdatingEvent ? 'Menyimpan...' : 'Simpan Perubahan' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

    <!-- Modal: Atur Posisi Teks Template (Autocrat Google Style) -->
  <Teleport to="body">
    <div v-if="showAutocratModal" class="modal-backdrop" @click="showAutocratModal = false">
      <div class="modal-dialog glass-card autocrat-modal-dialog" @click.stop>
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Atur Posisi Citra Template (Autocrat)</h3>
            <p class="modal-sub">
              Geser kotak teks untuk memindahkan posisi, atau tarik titik sudut kotak untuk memperbesar/memperkecil ukuran teks.
            </p>
          </div>
          <button type="button" class="close-btn" @click="showAutocratModal = false" title="Tutup Modal (Esc)">&times;</button>
        </div>

        <div class="modal-body autocrat-modal-body">
          <div v-if="autocratError" class="login-error-alert mb-3">
            <span>{{ autocratError }}</span>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingAutocratImage" class="autocrat-loading-box">
            <p>Memuat citra template sertifikat...</p>
          </div>

          <!-- Main Editor Grid -->
          <div v-else class="autocrat-editor-grid">
            <!-- Left Column: Visual Canvas Preview with Draggable Tags -->
            <div class="autocrat-canvas-col">
              <div class="autocrat-canvas-header">
                <span class="canvas-title">Pratinjau Visual Template Sertifikat</span>
                <span class="canvas-hint">Geser kotak langsung pada gambar, atau tarik sudut kotak untuk mengubah ukuran</span>
              </div>

              <div
                ref="autocratCanvasRef"
                class="autocrat-canvas-wrapper"
                @click="handleCanvasClick"
              >
                <!-- Background Image Template -->
                <img
                  v-if="autocratImageSrc"
                  :src="autocratImageSrc"
                  alt="Template Sertifikat"
                  class="autocrat-canvas-img"
                  @load="onCanvasImgLoad"
                />
                <div v-else class="autocrat-no-img">
                  <span>Tidak ada citra template. Silakan unggah terlebih dahulu di form event.</span>
                </div>

                <!-- Element 1: Nomor Sertifikat (Variabel "nomor") -->
                <div
                  v-if="autocratPositions.number && autocratPositions.number.show !== false"
                  class="autocrat-word-box"
                  :class="{ active: activeAutocratElement === 'number' }"
                  :style="{
                    left: autocratPositions.number.x + '%',
                    top: autocratPositions.number.y + '%',
                    color: autocratPositions.number.color || '#333333',
                    fontSize: Math.max(9, Math.round((autocratPositions.number.fontSize || 16) * autocratFontScale)) + 'px',
                    fontFamily: autocratPositions.number.fontFamily || '\'Segoe UI\', Roboto, sans-serif',
                    fontWeight: autocratPositions.number.fontWeight || '600',
                    textAlign: autocratPositions.number.align || 'left',
                    transform: autocratPositions.number.align === 'left' ? 'translate(0, -50%)' : autocratPositions.number.align === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)'
                  }"
                  @mousedown="(e) => startTagDrag('number', e)"
                  @touchstart="(e) => startTagDrag('number', e)"
                  title="Variabel nomor (Klik untuk geser, tarik sudut kotak untuk ubah ukuran)"
                >
                  <span class="autocrat-var-text font-mono">
                    {{ (autocratPositions.number.prefix || '') + 'nomor' }}
                  </span>

                  <!-- 8 Titik Resize Handle ala Word (Muncul Saat Elemen Aktif) -->
                  <template v-if="activeAutocratElement === 'number'">
                    <div class="autocrat-handle handle-tl" @mousedown.stop="(e) => startResize('number', 'tl', e)" @touchstart.stop="(e) => startResize('number', 'tl', e)"></div>
                    <div class="autocrat-handle handle-tc" @mousedown.stop="(e) => startResize('number', 'tc', e)" @touchstart.stop="(e) => startResize('number', 'tc', e)"></div>
                    <div class="autocrat-handle handle-tr" @mousedown.stop="(e) => startResize('number', 'tr', e)" @touchstart.stop="(e) => startResize('number', 'tr', e)"></div>
                    <div class="autocrat-handle handle-mr" @mousedown.stop="(e) => startResize('number', 'mr', e)" @touchstart.stop="(e) => startResize('number', 'mr', e)"></div>
                    <div class="autocrat-handle handle-br" @mousedown.stop="(e) => startResize('number', 'br', e)" @touchstart.stop="(e) => startResize('number', 'br', e)"></div>
                    <div class="autocrat-handle handle-bc" @mousedown.stop="(e) => startResize('number', 'bc', e)" @touchstart.stop="(e) => startResize('number', 'bc', e)"></div>
                    <div class="autocrat-handle handle-bl" @mousedown.stop="(e) => startResize('number', 'bl', e)" @touchstart.stop="(e) => startResize('number', 'bl', e)"></div>
                    <div class="autocrat-handle handle-ml" @mousedown.stop="(e) => startResize('number', 'ml', e)" @touchstart.stop="(e) => startResize('number', 'ml', e)"></div>
                  </template>
                </div>

                <!-- Element 2: Nama Peserta (Variabel "nama") -->
                <div
                  v-if="autocratPositions.name && autocratPositions.name.show !== false"
                  class="autocrat-word-box"
                  :class="{ active: activeAutocratElement === 'name' }"
                  :style="{
                    left: autocratPositions.name.x + '%',
                    top: autocratPositions.name.y + '%',
                    color: autocratPositions.name.color || '#A14646',
                    fontSize: Math.max(12, Math.round((autocratPositions.name.fontSize || 46) * autocratFontScale)) + 'px',
                    fontFamily: autocratPositions.name.fontFamily || 'Georgia, serif',
                    fontWeight: autocratPositions.name.fontWeight || 'bold',
                    textAlign: autocratPositions.name.align || 'center',
                    transform: autocratPositions.name.align === 'left' ? 'translate(0, -50%)' : autocratPositions.name.align === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)'
                  }"
                  @mousedown="(e) => startTagDrag('name', e)"
                  @touchstart="(e) => startTagDrag('name', e)"
                  title="Variabel nama (Klik untuk geser, tarik sudut kotak untuk ubah ukuran)"
                >
                  <span class="autocrat-var-text">
                    {{ (autocratPositions.name.prefix || '') + 'nama' }}
                  </span>

                  <!-- 8 Titik Resize Handle ala Word (Muncul Saat Elemen Aktif) -->
                  <template v-if="activeAutocratElement === 'name'">
                    <div class="autocrat-handle handle-tl" @mousedown.stop="(e) => startResize('name', 'tl', e)" @touchstart.stop="(e) => startResize('name', 'tl', e)"></div>
                    <div class="autocrat-handle handle-tc" @mousedown.stop="(e) => startResize('name', 'tc', e)" @touchstart.stop="(e) => startResize('name', 'tc', e)"></div>
                    <div class="autocrat-handle handle-tr" @mousedown.stop="(e) => startResize('name', 'tr', e)" @touchstart.stop="(e) => startResize('name', 'tr', e)"></div>
                    <div class="autocrat-handle handle-mr" @mousedown.stop="(e) => startResize('name', 'mr', e)" @touchstart.stop="(e) => startResize('name', 'mr', e)"></div>
                    <div class="autocrat-handle handle-br" @mousedown.stop="(e) => startResize('name', 'br', e)" @touchstart.stop="(e) => startResize('name', 'br', e)"></div>
                    <div class="autocrat-handle handle-bc" @mousedown.stop="(e) => startResize('name', 'bc', e)" @touchstart.stop="(e) => startResize('name', 'bc', e)"></div>
                    <div class="autocrat-handle handle-bl" @mousedown.stop="(e) => startResize('name', 'bl', e)" @touchstart.stop="(e) => startResize('name', 'bl', e)"></div>
                    <div class="autocrat-handle handle-ml" @mousedown.stop="(e) => startResize('name', 'ml', e)" @touchstart.stop="(e) => startResize('name', 'ml', e)"></div>
                  </template>
                </div>

                <!-- Element 3: Peran (Variabel "peran") -->
                <div
                  v-if="autocratPositions.role && autocratPositions.role.show !== false"
                  class="autocrat-word-box"
                  :class="{ active: activeAutocratElement === 'role' }"
                  :style="{
                    left: autocratPositions.role.x + '%',
                    top: autocratPositions.role.y + '%',
                    color: autocratPositions.role.color || '#DA6556',
                    fontSize: Math.max(10, Math.round((autocratPositions.role.fontSize || 20) * autocratFontScale)) + 'px',
                    fontFamily: autocratPositions.role.fontFamily || '\'Segoe UI\', Roboto, sans-serif',
                    fontWeight: autocratPositions.role.fontWeight || '600',
                    textAlign: autocratPositions.role.align || 'left',
                    transform: autocratPositions.role.align === 'left' ? 'translate(0, -50%)' : autocratPositions.role.align === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)'
                  }"
                  @mousedown="(e) => startTagDrag('role', e)"
                  @touchstart="(e) => startTagDrag('role', e)"
                  title="Variabel peran (Klik untuk geser, tarik sudut kotak untuk ubah ukuran)"
                >
                  <span class="autocrat-var-text">
                    {{ (autocratPositions.role.prefix || '') + 'peran' }}
                  </span>

                  <!-- 8 Titik Resize Handle ala Word (Muncul Saat Elemen Aktif) -->
                  <template v-if="activeAutocratElement === 'role'">
                    <div class="autocrat-handle handle-tl" @mousedown.stop="(e) => startResize('role', 'tl', e)" @touchstart.stop="(e) => startResize('role', 'tl', e)"></div>
                    <div class="autocrat-handle handle-tc" @mousedown.stop="(e) => startResize('role', 'tc', e)" @touchstart.stop="(e) => startResize('role', 'tc', e)"></div>
                    <div class="autocrat-handle handle-tr" @mousedown.stop="(e) => startResize('role', 'tr', e)" @touchstart.stop="(e) => startResize('role', 'tr', e)"></div>
                    <div class="autocrat-handle handle-mr" @mousedown.stop="(e) => startResize('role', 'mr', e)" @touchstart.stop="(e) => startResize('role', 'mr', e)"></div>
                    <div class="autocrat-handle handle-br" @mousedown.stop="(e) => startResize('role', 'br', e)" @touchstart.stop="(e) => startResize('role', 'br', e)"></div>
                    <div class="autocrat-handle handle-bc" @mousedown.stop="(e) => startResize('role', 'bc', e)" @touchstart.stop="(e) => startResize('role', 'bc', e)"></div>
                    <div class="autocrat-handle handle-bl" @mousedown.stop="(e) => startResize('role', 'bl', e)" @touchstart.stop="(e) => startResize('role', 'bl', e)"></div>
                    <div class="autocrat-handle handle-ml" @mousedown.stop="(e) => startResize('role', 'ml', e)" @touchstart.stop="(e) => startResize('role', 'ml', e)"></div>
                  </template>
                </div>
              </div>

              <!-- Presets Bar -->
              <div class="autocrat-presets-bar">
                <span class="preset-label">Preset Tata Letak:</span>
                <button type="button" class="btn btn-secondary btn-xs" @click="applyUinPreset">
                  <span>Rekomendasi UIN / HIMA</span>
                </button>
                <button type="button" class="btn btn-secondary btn-xs" @click="applyCenterPreset">
                  <span>Simetris Rata Tengah</span>
                </button>
              </div>
            </div>

            <!-- Right Column: Autocrat Precision Controls Panel -->
            <div class="autocrat-controls-col glass-card">
              <h4 class="ctrl-heading">Pengaturan Elemen Teks</h4>

              <!-- Tab Selector Elemen -->
              <div class="autocrat-tabs-row">
                <button
                  type="button"
                  class="autocrat-tab-btn"
                  :class="{ active: activeAutocratElement === 'name' }"
                  @click="activeAutocratElement = 'name'"
                >
                  <span>Nama</span>
                </button>
                <button
                  type="button"
                  class="autocrat-tab-btn"
                  :class="{ active: activeAutocratElement === 'role' }"
                  @click="activeAutocratElement = 'role'"
                >
                  <span>Peran</span>
                </button>
                <button
                  type="button"
                  class="autocrat-tab-btn"
                  :class="{ active: activeAutocratElement === 'number' }"
                  @click="activeAutocratElement = 'number'"
                >
                  <span>Nomor</span>
                </button>
              </div>

              <!-- Active Element Settings -->
              <div v-if="autocratPositions[activeAutocratElement]" class="autocrat-ctrl-body">
                <!-- Toggle Show/Hide -->
                <div class="ctrl-toggle-row mb-3">
                  <label class="d-flex align-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="autocratPositions[activeAutocratElement].show"
                      class="custom-chk"
                    />
                    <span class="font-medium text-sm">Tampilkan elemen ini di sertifikat</span>
                  </label>
                </div>

                <!-- Prefix Text Input -->
                <div class="form-group mb-3">
                  <label class="form-label text-xs">
                    Teks Awalan (Prefix)
                    <span class="text-subtle font-normal">
                      {{ activeAutocratElement === 'number' ? '(Contoh: "NOMOR: " atau kosongkan jika sudah ada di template)' : activeAutocratElement === 'role' ? '(Contoh: "Sebagai " atau kosongkan)' : '' }}
                    </span>
                  </label>
                  <input
                    type="text"
                    v-model="autocratPositions[activeAutocratElement].prefix"
                    class="form-input form-input-sm"
                    :placeholder="activeAutocratElement === 'number' ? 'NOMOR: ' : activeAutocratElement === 'role' ? 'Sebagai ' : ''"
                  />
                </div>

                <!-- Font Family & Weight Selection -->
                <div class="autocrat-grid-2 mb-3">
                  <div>
                    <label class="form-label text-xs mb-1">Jenis Font</label>
                    <select
                      v-model="autocratPositions[activeAutocratElement].fontFamily"
                      class="form-select form-select-sm"
                    >
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Times New Roman', Times, serif">Times New Roman</option>
                      <option value="'Playfair Display', Georgia, serif">Playfair Display</option>
                      <option value="'Cinzel', 'Times New Roman', serif">Cinzel</option>
                      <option value="'Great Vibes', cursive">Great Vibes</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="'Segoe UI', Roboto, sans-serif">Segoe UI</option>
                      <option value="'Montserrat', 'Segoe UI', sans-serif">Montserrat</option>
                      <option value="'Courier New', Courier, monospace">Courier New</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label text-xs mb-1">Ketebalan Font</label>
                    <select
                      v-model="autocratPositions[activeAutocratElement].fontWeight"
                      class="form-select form-select-sm"
                    >
                      <option value="normal">Normal</option>
                      <option value="600">Semi Bold</option>
                      <option value="bold">Bold</option>
                      <option value="800">Extra Bold</option>
                    </select>
                  </div>
                </div>

                <!-- Position X (%) -->
                <div class="form-group mb-3">
                  <div class="d-flex justify-between align-center mb-1">
                    <label class="form-label text-xs">Posisi Horizontal (X)</label>
                    <span class="val-badge font-mono">{{ autocratPositions[activeAutocratElement].x }}%</span>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      v-model.number="autocratPositions[activeAutocratElement].x"
                      class="range-slider flex-1"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      v-model.number="autocratPositions[activeAutocratElement].x"
                      class="form-input form-input-sm font-mono num-box"
                    />
                  </div>
                </div>

                <!-- Position Y (%) -->
                <div class="form-group mb-3">
                  <div class="d-flex justify-between align-center mb-1">
                    <label class="form-label text-xs">Posisi Vertikal (Y)</label>
                    <span class="val-badge font-mono">{{ autocratPositions[activeAutocratElement].y }}%</span>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      v-model.number="autocratPositions[activeAutocratElement].y"
                      class="range-slider flex-1"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      v-model.number="autocratPositions[activeAutocratElement].y"
                      class="form-input form-input-sm font-mono num-box"
                    />
                  </div>
                </div>

                <!-- Font Size -->
                <div class="form-group mb-3">
                  <div class="d-flex justify-between align-center mb-1">
                    <label class="form-label text-xs">Ukuran Font Dasar</label>
                    <span class="val-badge font-mono">{{ autocratPositions[activeAutocratElement].fontSize }} px</span>
                  </div>
                  <div class="d-flex align-center gap-2">
                    <input
                      type="range"
                      min="10"
                      max="120"
                      step="1"
                      v-model.number="autocratPositions[activeAutocratElement].fontSize"
                      class="range-slider flex-1"
                    />
                    <input
                      type="number"
                      min="10"
                      max="120"
                      step="1"
                      v-model.number="autocratPositions[activeAutocratElement].fontSize"
                      class="form-input form-input-sm font-mono num-box"
                    />
                  </div>
                </div>

                <!-- Alignment & Color -->
                <div class="autocrat-grid-2 mb-3">
                  <div>
                    <label class="form-label text-xs mb-1">Perataan (Align)</label>
                    <div class="align-btn-group">
                      <button
                        type="button"
                        class="align-btn"
                        :class="{ active: autocratPositions[activeAutocratElement].align === 'left' }"
                        @click="autocratPositions[activeAutocratElement].align = 'left'"
                        title="Rata Kiri"
                      >
                        <span>Kiri</span>
                      </button>
                      <button
                        type="button"
                        class="align-btn"
                        :class="{ active: autocratPositions[activeAutocratElement].align === 'center' }"
                        @click="autocratPositions[activeAutocratElement].align = 'center'"
                        title="Rata Tengah"
                      >
                        <span>Tengah</span>
                      </button>
                      <button
                        type="button"
                        class="align-btn"
                        :class="{ active: autocratPositions[activeAutocratElement].align === 'right' }"
                        @click="autocratPositions[activeAutocratElement].align = 'right'"
                        title="Rata Kanan"
                      >
                        <span>Kanan</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="form-label text-xs mb-1">Warna Teks</label>
                    <div class="color-picker-box">
                      <input
                        type="color"
                        v-model="autocratPositions[activeAutocratElement].color"
                        class="color-input"
                      />
                      <input
                        type="text"
                        v-model="autocratPositions[activeAutocratElement].color"
                        class="form-input form-input-sm font-mono hex-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showAutocratModal = false">
            Batal
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="isSavingAutocrat"
            @click="handleSaveAutocratPositions"
          >
            <span>{{ isSavingAutocrat ? 'Menyimpan Posisi...' : 'Simpan Posisi Template' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

    <!-- Modal F-04: Tambah Calon Penerima Individual -->
  <Teleport to="body">
    <div v-if="showAddRecipientModal" class="modal-backdrop" @click="showAddRecipientModal = false">
      <div class="modal-dialog glass-card" @click.stop style="max-width: 500px;">
        <div class="modal-header">
          <h3 class="modal-title">Tambah Calon Penerima</h3>
          <button type="button" class="close-btn" @click="showAddRecipientModal = false" title="Tutup Modal (Esc)">&times;</button>
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
            <label class="form-label">Nomor Sertifikat</label>

            <div class="input-with-lock-wrap">
              <input
                type="text"
                :value="currentEventHasPrefix ? currentEventNextSpoiler : newRecipientForm.certificateNumber"
                @input="e => { if (!currentEventHasPrefix) newRecipientForm.certificateNumber = e.target.value }"
                :disabled="currentEventHasPrefix"
                class="form-input font-mono"
                :class="{ 'input-locked': currentEventHasPrefix }"
                :placeholder="currentEventHasPrefix ? currentEventNextSpoiler : 'Otomatis digenerate jika kosong'"
              />
              <Lock v-if="currentEventHasPrefix" :size="16" class="input-lock-icon" />
            </div>

            <small v-if="currentEventHasPrefix" class="form-hint text-gold">
              🔒 <strong>Nomor Dinonaktifkan:</strong> Calon penerima ini otomatis mendapatkan nomor: <strong class="text-white">{{ currentEventNextSpoiler }}</strong>.
            </small>
            <small v-else class="form-hint">
              Kosongkan untuk penomoran otomatis berurutan sesuai pola agenda event.
            </small>
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
  </Teleport>

    <!-- Modal F-05: Impor Massal CSV dengan Pratinjau -->
  <Teleport to="body">
    <div v-if="showCsvImportModal" class="modal-backdrop" @click="showCsvImportModal = false">
      <div class="modal-dialog glass-card" @click.stop style="max-width: 650px;">
        <div class="modal-header">
          <h3 class="modal-title">Impor Massal Penerima CSV</h3>
          <button type="button" class="close-btn" @click="showCsvImportModal = false" title="Tutup Modal (Esc)">&times;</button>
        </div>
        <div class="modal-body">
          <p class="pane-sub">
            Unggah berkas CSV atau tempel teks data penerima. Cukup kolom <strong>nama, nim, peran</strong> karena nomor sertifikat otomatis digenerate dari format agenda kegiatan.
          </p>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label" style="margin-bottom: 0;">Pilih Berkas CSV:</label>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="handleDownloadCsvTemplate"
                style="font-size: 0.76rem; padding: 3px 10px; border-color: rgba(253, 183, 115, 0.4); color: #fdb773;"
              >
                <Download :size="12" />
                <span>Unduh Contoh CSV</span>
              </button>
            </div>
            <input type="file" accept=".csv,text/csv" @change="handleCsvFileChange" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Atau Tempel Teks CSV (Format: nama,nim,peran):</label>
            <textarea
              v-model="csvTextInput"
              rows="5"
              class="form-textarea font-mono"
              placeholder="nama,nim,peran&#10;Ahmad Fulan,09020623001,Peserta&#10;Siti Nurhaliza,09020623002,Pemateri&#10;Raihan Maulana,09020623003,Panitia"
            ></textarea>
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
                    <th>Nomor (Otomatis)</th>
                    <th>Nama</th>
                    <th>NIM / ID</th>
                    <th>Peran</th>
                    <th>Status Baris</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in csvPreviewData.rows" :key="row.rowNumber">
                    <td class="font-mono">{{ row.rowNumber }}</td>
                    <td class="font-mono text-gold">{{ row.certificateNumber }}</td>
                    <td>{{ row.recipientName }}</td>
                    <td class="font-mono">{{ row.recipientIdentifier }}</td>
                    <td><span class="badge badge-brand">{{ row.recipientRole }}</span></td>
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
  </Teleport>

    <!-- Modal: Pratinjau Citra E-Sertifikat PNG (Lossless LSB Stego) -->
  <Teleport to="body">
    <div v-if="previewCert" class="modal-backdrop" @click="closeCertPreview">
      <div class="modal-dialog glass-card" @click.stop style="max-width: 860px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <Award :size="24" class="text-gold" />
            <div>
              <h3 class="modal-title" style="margin: 0; line-height: 1.2;">{{ previewCert.recipientName }}</h3>
              <p class="modal-sub font-mono text-gold" style="margin: 4px 0 0; font-size: 0.85rem;">{{ previewCert.certificateNumber }}</p>
            </div>
          </div>
          <button type="button" class="close-btn" @click="closeCertPreview" title="Tutup Modal (Esc)">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Image Preview Display -->
          <div class="modal-img-wrap" style="background: #09090b; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.12); margin-bottom: 16px; text-align: center; position: relative; min-height: 220px; display: flex; align-items: center; justify-content: center;">
            <div v-if="isLoadingPreviewImage" style="padding: 50px 20px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 12px;">
              <RefreshCw :size="32" class="spin-icon text-brand" />
              <span style="font-size: 0.9rem;">Memuat citra lossless PNG langsung dari media penyimpanan peladen...</span>
            </div>
            <img
              v-else-if="previewCertImageUrl"
              :src="previewCertImageUrl"
              alt="Pratinjau E-Sertifikat PNG"
              style="max-width: 100%; max-height: 55vh; object-fit: contain; display: block; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.5);"
            />
            <div v-else style="padding: 40px; color: var(--text-muted);">
              Citra sertifikat tidak tersedia
            </div>
          </div>

          <!-- Metadata Grid -->
          <div class="modal-meta-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 16px;">
            <div class="m-item">
              <span class="k" style="font-size: 0.72rem; color: var(--text-muted);">Agenda Kegiatan</span>
              <span class="v" style="font-size: 0.9rem; font-weight: 600; color: #fff;">{{ previewCert.eventName }}</span>
            </div>
            <div class="m-item">
              <span class="k" style="font-size: 0.72rem; color: var(--text-muted);">NIM / Identifikasi</span>
              <span class="v font-mono" style="font-size: 0.9rem; font-weight: 600; color: #fff;">{{ previewCert.recipientIdentifier }}</span>
            </div>
            <div class="m-item">
              <span class="k" style="font-size: 0.72rem; color: var(--text-muted);">Peran Partisipasi</span>
              <span class="v" style="font-size: 0.9rem; font-weight: 600; color: #fff;">{{ previewCert.recipientRole || 'Peserta' }}</span>
            </div>
            <div class="m-item">
              <span class="k" style="font-size: 0.72rem; color: var(--text-muted);">Kualitas Steganografi (PSNR / MSE)</span>
              <span class="v font-mono text-emerald" style="font-size: 0.9rem; font-weight: 600;">
                PSNR: {{ previewCert.psnr || '-' }} dB (MSE: {{ previewCert.mse || '0' }})
              </span>
            </div>
            <div class="m-item" style="grid-column: 1 / -1;">
              <span class="k" style="font-size: 0.72rem; color: var(--text-muted);">Segel Integritas Kriptografis (SHA-256 Digest)</span>
              <div class="code-box" style="font-family: monospace; font-size: 0.75rem; color: #fdb773; word-break: break-all; margin-top: 2px;">
                {{ previewCert.sha256Hash || '-' }}
              </div>
            </div>
          </div>

          <!-- Live Server Verification Ribbon -->
          <div class="verif-check-box" style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
              <div>
                <h4 style="font-size: 0.88rem; font-weight: 600; color: #fff; margin: 0 0 2px;">Uji Keabsahan Berkas di Peladen</h4>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">
                  Mengekstrak bit LSB pada citra PNG tersimpan dan mencocokkan ulang segel hash SHA-256 secara deterministik.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="isVerifyingStored"
                @click="verifyStoredCertificate(previewCert.id)"
              >
                <RefreshCw v-if="isVerifyingStored" :size="14" class="spin-icon" />
                <ShieldCheck v-else :size="14" />
                <span>{{ isVerifyingStored ? 'Mengekstrak LSB...' : 'Verifikasi Integritas' }}</span>
              </button>
            </div>

            <!-- Hasil Verifikasi -->
            <div
              v-if="storedVerificationResult"
              style="margin-top: 12px; padding: 10px 14px; border-radius: 6px; display: flex; align-items: center; gap: 10px;"
              :style="storedVerificationResult.isValid ? 'background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35);' : 'background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35);'"
            >
              <CheckCircle2 v-if="storedVerificationResult.isValid" :size="20" class="text-emerald" />
              <AlertTriangle v-else :size="20" class="text-danger" />
              <div>
                <strong :class="storedVerificationResult.isValid ? 'text-emerald' : 'text-danger'" style="font-size: 0.88rem;">
                  {{ storedVerificationResult.message }}
                </strong>
                <p class="text-xs text-muted" style="margin: 2px 0 0;">
                  Waktu Ekstraksi: {{ storedVerificationResult.executionTimeMs }} ms &bull; Status Hash: {{ storedVerificationResult.hashMatch ? 'Cocok Sempurna (256-bit Bit-Exact)' : 'Tidak Cocok' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Peringatan Lossless Format -->
          <div style="display: flex; align-items: center; gap: 10px; background: rgba(253, 183, 115, 0.08); border: 1px solid rgba(253, 183, 115, 0.25); padding: 10px 14px; border-radius: 6px; font-size: 0.78rem; color: #fdb773;">
            <AlertTriangle :size="16" style="flex-shrink: 0;" />
            <span>Penting: Berkas citra ini berformat PNG lossless dengan bit rahasia LSB. Jangan lakukan kompresi lossy (seperti upload ke status/chat media sosial standar tanpa dokumen) agar segel integritas tetap valid saat diverifikasi.</span>
          </div>
        </div>

        <div class="modal-footer" style="margin-top: 16px;">
          <button type="button" class="btn btn-secondary" @click="closeCertPreview">Tutup</button>
          <button
            type="button"
            class="btn btn-primary"
            @click="handleDownloadCertificate(previewCert.id, previewCert.recipientName, previewCert.certificateNumber)"
          >
            <Download :size="15" />
            <span>Unduh Berkas PNG Asli</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
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
  gap: 8px;
  padding: 8px;
  margin-bottom: 24px;
  overflow-x: auto;
  border-radius: var(--radius-pill);
  scrollbar-width: none;
}

.studio-tabs::-webkit-scrollbar {
  display: none;
}

.s-tab-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  user-select: none;
}

.s-tab-btn:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.s-tab-btn:active {
  transform: translateY(0) scale(0.96);
}

.s-tab-btn.active {
  background: linear-gradient(135deg, rgba(235, 137, 91, 0.28), rgba(218, 101, 86, 0.32));
  color: #FFFFFF;
  border: 1px solid rgba(253, 183, 115, 0.5);
  box-shadow: 0 4px 16px rgba(218, 101, 86, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.2);
}

/* Smooth Tab Transition Animations */
.tab-pane {
  will-change: opacity, transform, filter;
}

.tab-fade-enter-active {
  transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), filter 0.28s ease-out;
}

.tab-fade-leave-active {
  transition: opacity 0.16s cubic-bezier(0.7, 0, 0.84, 0), transform 0.16s cubic-bezier(0.7, 0, 0.84, 0), filter 0.16s ease-in;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.995);
  filter: blur(2px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.995);
  filter: blur(1px);
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
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
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
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--text-muted);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #FFFFFF;
  border-color: rgba(239, 68, 68, 0.5);
  transform: scale(1.06);
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

@media (max-width: 640px) {
  .dash-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .user-pill {
    width: 100%;
  }
  .stats-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .event-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .e-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px;
  }
  .recipients-top-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .event-picker-box {
    min-width: unset;
    width: 100%;
  }
  .recipients-actions {
    width: 100%;
  }
  .recipients-actions .btn {
    flex: 1;
    justify-content: center;
  }
  .issuance-control-ribbon {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .issuance-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
  }
  .issuance-left .form-select {
    width: 100% !important;
  }
  .issuance-control-ribbon .btn {
    width: 100%;
    justify-content: center;
  }
  .modal-backdrop {
    padding: 8px;
    align-items: flex-start;
  }
  .modal-dialog {
    padding: 16px !important;
    border-radius: var(--radius-md) !important;
  }
  .grid-2-col-sm {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

/* Custom Responsive VueDatePicker theme integration (MUI-like dark theme) */
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
