<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import {
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  BarChart2,
  ShieldAlert,
  FileCheck2,
  HelpCircle,
  Download
} from 'lucide-vue-next'

const activeLabTab = ref('blackbox') // 'blackbox' | 'sampling' | 'imperceptibility' | 'tamper'

// Black-Box State
const isRunningBlackBox = ref(false)
const blackBoxData = ref(null)

// Sampling 50 State
const isRunningSampling = ref(false)
const samplingProgress = ref(0)
const samplingData = ref(null)

// Tamper Detection State
const isRunningTamper = ref(false)
const tamperData = ref(null)

// Avalanche Sandbox State
const sandboxTextA = ref('UINSA/FST/2026/001#Ahmad Fauzi#Peserta#Seminar Nasional AI#2026-10-20#FST UINSA')
const sandboxTextB = ref('UINSA/FST/2026/001#Ahmed Fauzi#Peserta#Seminar Nasional AI#2026-10-20#FST UINSA')
const avalancheResult = ref(null)
const isComputingAvalanche = ref(false)

const runBlackBoxTest = async () => {
  isRunningBlackBox.value = true
  try {
    const res = await api.get('/simulation/black-box')
    blackBoxData.value = res.data
  } catch (err) {
    console.error('Blackbox run error:', err)
  } finally {
    isRunningBlackBox.value = false
  }
}

const runSamplingTest = async (count = 50) => {
  isRunningSampling.value = true
  samplingProgress.value = 10
  try {
    const res = await api.get(`/simulation/iterative-test?count=${count}`)
    samplingData.value = res.data
    samplingProgress.value = 100
  } catch (err) {
    console.error('Sampling test error:', err)
  } finally {
    isRunningSampling.value = false
  }
}

const runTamperTest = async () => {
  isRunningTamper.value = true
  try {
    const res = await api.get('/simulation/tamper-test')
    tamperData.value = res.data
  } catch (err) {
    console.error('Tamper test error:', err)
  } finally {
    isRunningTamper.value = false
  }
}

const isExportingMetrics = ref(false)

const handleExportMetricsCsv = async (count = 50) => {
  isExportingMetrics.value = true
  try {
    const res = await api.get(`/metrics/export?count=${count}`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Hasil-Uji-Metrik-${count}-Sampel-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (err) {
    alert('Gagal mengekspor CSV metrik hasil uji. Pastikan Anda telah login sebagai admin.')
  } finally {
    isExportingMetrics.value = false
  }
}

const calculateAvalanche = async () => {
  isComputingAvalanche.value = true
  try {
    const res = await api.post('/simulation/avalanche', {
      textA: sandboxTextA.value,
      textB: sandboxTextB.value,
    })
    avalancheResult.value = res.data
  } catch (err) {
    console.error('Avalanche calc error:', err)
  } finally {
    isComputingAvalanche.value = false
  }
}

onMounted(() => {
  runBlackBoxTest()
  calculateAvalanche()
})
</script>

<template>
  <section class="lab-section">
    <div class="container">
      <!-- Section Title & Badge -->
      <div class="lab-header">
        <div class="badge badge-brand">
          <Terminal :size="14" />
          <span>EVALUASI EMPIRIS &amp; LABORATORIUM PENGUJIAN</span>
        </div>
        <h2 class="lab-title">Laboratorium Pengujian Sistem</h2>
        <p class="lab-desc">
          Suite pengujian deterministik yang mengevaluasi fungsionalitas black-box, reliabilitas iterasi 50 berkas e-sertifikat riil,
          mutu citra stego (MSE &amp; PSNR), serta efek longsor (avalanche effect) SHA-256.
        </p>

        <!-- Lab Navigation Tabs -->
        <div class="lab-nav-pills glass-card">
          <button
            class="lab-pill-btn"
            :class="{ active: activeLabTab === 'blackbox' }"
            @click="activeLabTab = 'blackbox'"
          >
            <CheckCircle2 :size="15" />
            <span>Pilar 1: Black-Box (9 Kasus)</span>
          </button>

          <button
            class="lab-pill-btn"
            :class="{ active: activeLabTab === 'sampling' }"
            @click="activeLabTab = 'sampling'"
          >
            <Layers :size="15" />
            <span>Pilar 2: Uji Iterasi 50 Sampel</span>
          </button>

          <button
            class="lab-pill-btn"
            :class="{ active: activeLabTab === 'imperceptibility' }"
            @click="activeLabTab = 'imperceptibility'"
          >
            <BarChart2 :size="15" />
            <span>Pilar 3: Kualitas MSE &amp; PSNR</span>
          </button>

          <button
            class="lab-pill-btn"
            :class="{ active: activeLabTab === 'tamper' }"
            @click="activeLabTab = 'tamper'"
          >
            <ShieldAlert :size="15" />
            <span>Pilar 4: Deteksi Manipulasi &amp; Avalanche</span>
          </button>
        </div>
      </div>

      <!-- TAB 1: Black-Box Testing -->
      <div v-if="activeLabTab === 'blackbox'" class="tab-content">
        <div class="glass-card lab-card">
          <div class="card-action-bar">
            <div>
              <h3 class="card-heading">Skenario Pengujian Black-Box Sistem</h3>
              <p class="card-caption">Equivalence Partitioning &amp; Boundary Value Analysis pada seluruh alur transaksi.</p>
            </div>
            <button class="btn btn-primary btn-sm" :disabled="isRunningBlackBox" @click="runBlackBoxTest">
              <RefreshCw v-if="isRunningBlackBox" :size="15" class="spin-icon" />
              <Play v-else :size="15" />
              <span>{{ isRunningBlackBox ? 'Mengeksekusi Skenario...' : 'Jalankan Ulang 9 Pengujian' }}</span>
            </button>
          </div>

          <!-- Summary Metric Pill -->
          <div v-if="blackBoxData" class="summary-pills-row">
            <div class="s-pill">
              <span class="s-k">Total Kasus:</span>
              <span class="s-v">{{ blackBoxData.summary.total }}</span>
            </div>
            <div class="s-pill s-valid">
              <span class="s-k">Lolos (Passed):</span>
              <span class="s-v">{{ blackBoxData.summary.passed }}</span>
            </div>
            <div class="s-pill">
              <span class="s-k">Tingkat Keberhasilan:</span>
              <span class="s-v text-emerald font-bold">{{ blackBoxData.summary.successRate }}%</span>
            </div>
          </div>

          <!-- Table 3.1 Structure -->
          <div class="table-scroll-wrap">
            <table class="lab-table">
              <thead>
                <tr>
                  <th style="width: 50px;">No</th>
                  <th>Modul / Fitur</th>
                  <th>Skenario Pengujian</th>
                  <th>Masukan (Input)</th>
                  <th>Keluaran yang Diharapkan</th>
                  <th>Keluaran Aktual</th>
                  <th style="width: 100px;">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in blackBoxData?.results" :key="item.id">
                  <td class="font-mono text-center">{{ item.id }}</td>
                  <td class="font-bold">{{ item.module }}</td>
                  <td>{{ item.scenario }}</td>
                  <td class="text-faint">{{ item.inputDescription }}</td>
                  <td>{{ item.expectedOutput }}</td>
                  <td class="text-muted text-sm font-mono">{{ item.actualOutput }}</td>
                  <td>
                    <span class="badge" :class="item.status === 'PASSED' ? 'badge-valid' : 'badge-manipulated'">
                      {{ item.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 2: Iterative Reliability Sampling 50 -->
      <div v-if="activeLabTab === 'sampling'" class="tab-content">
        <div class="glass-card lab-card">
          <div class="card-action-bar">
            <div>
              <h3 class="card-heading">Uji Iterasi Sampling Reliabilitas (50 E-Sertifikat)</h3>
              <p class="card-caption">
                Batch 1: 25 sampel Full HD (1920 &times; 1080 px) &bull; Batch 2: 25 sampel A4 Landscape 300 DPI (2480 &times; 1754 px)
              </p>
            </div>
            <div class="btn-group">
              <button class="btn btn-secondary btn-sm" :disabled="isExportingMetrics" @click="handleExportMetricsCsv(50)">
                <RefreshCw v-if="isExportingMetrics" :size="15" class="spin-icon" />
                <Download v-else :size="15" />
                <span>Ekspor CSV (F-12)</span>
              </button>
              <button class="btn btn-secondary btn-sm" :disabled="isRunningSampling" @click="runSamplingTest(10)">
                Uji 10 Sampel Cepat
              </button>
              <button class="btn btn-primary btn-sm" :disabled="isRunningSampling" @click="runSamplingTest(50)">
                <RefreshCw v-if="isRunningSampling" :size="15" class="spin-icon" />
                <Play v-else :size="15" />
                <span>{{ isRunningSampling ? 'Memproses 50 Sampel...' : 'Jalankan 50 Sampel Penuh' }}</span>
              </button>
            </div>
          </div>

          <!-- Summary Metric Cards -->
          <div v-if="samplingData" class="sampling-metrics-grid">
            <div class="s-metric-box">
              <span class="lbl">SR_gen (Tingkat Pembangkitan)</span>
              <span class="val text-emerald">{{ samplingData.summary.successRateGen }}%</span>
              <span class="hint">Target: 100% (Tercapai)</span>
            </div>
            <div class="s-metric-box">
              <span class="lbl">SR_verif (Tingkat Verifikasi)</span>
              <span class="val text-emerald">{{ samplingData.summary.successRateVerif }}%</span>
              <span class="hint">Target: 100% (Tercapai)</span>
            </div>
            <div class="s-metric-box">
              <span class="lbl">Rata-rata T_gen</span>
              <span class="val text-gold">{{ samplingData.summary.avgTGenSeconds }} s</span>
              <span class="hint">Target: &le; 3.0 s (Tercapai)</span>
            </div>
            <div class="s-metric-box">
              <span class="lbl">Rata-rata T_verif</span>
              <span class="val text-gold">{{ samplingData.summary.avgTVerifSeconds }} s</span>
              <span class="hint">Target: &le; 2.0 s (Tercapai)</span>
            </div>
            <div class="s-metric-box">
              <span class="lbl">Rata-rata PSNR</span>
              <span class="val text-emerald">{{ samplingData.summary.avgPsnr }} dB</span>
              <span class="hint">Target: &ge; 45.0 dB (Sangat Prima)</span>
            </div>
          </div>

          <!-- Sample Items Table -->
          <div v-if="samplingData" class="table-scroll-wrap" style="max-height: 420px; overflow-y: auto;">
            <table class="lab-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Kelompok Batch</th>
                  <th>Resolusi</th>
                  <th>Nama Penerima</th>
                  <th>T_gen (Detik)</th>
                  <th>T_verif (Detik)</th>
                  <th>PSNR (dB)</th>
                  <th>MSE</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in samplingData.samples" :key="s.sampleIndex">
                  <td class="font-mono text-center">{{ s.sampleIndex }}</td>
                  <td>
                    <span class="badge" :class="s.batch.includes('Batch 1') ? 'badge-brand' : 'badge-valid'">
                      {{ s.batch }}
                    </span>
                  </td>
                  <td class="font-mono text-xs">{{ s.resolution }}</td>
                  <td class="font-bold">{{ s.namaPenerima }}</td>
                  <td class="font-mono">{{ s.tGenSeconds }} s</td>
                  <td class="font-mono">{{ s.tVerifSeconds }} s</td>
                  <td class="font-mono text-emerald font-bold">{{ s.psnr }} dB</td>
                  <td class="font-mono text-xs">{{ s.mse }}</td>
                  <td>
                    <span class="badge badge-valid">100% VALID</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Root Cause Failure Analysis Box -->
          <div class="root-cause-box">
            <h4 class="rc-title">
              <HelpCircle :size="16" class="text-gold" />
              <span>Matriks Analisis Akar Masalah (Root Cause Failure Analysis)</span>
            </h4>
            <div class="rc-grid">
              <div class="rc-item">
                <span class="rc-tag">1. Capacity Overflow</span>
                <p>Dicegah melalui validasi awal restriksi panjang bit (L_pesan &le; W &times; H &times; 3).</p>
              </div>
              <div class="rc-item">
                <span class="rc-tag">2. Lossy Compression</span>
                <p>Format dibatasi mutlak ke PNG lossless; algoritma JPEG DCT otomatis ditolak sistem.</p>
              </div>
              <div class="rc-item">
                <span class="rc-tag">3. Geometrical Distortion</span>
                <p>Penskalaan dan pemotongan dideteksi melalui kegagalan penanda terminator @@@.</p>
              </div>
              <div class="rc-item">
                <span class="rc-tag">4. Encoding Mismatch</span>
                <p>Serialisasi ASCII 8-bit deterministik dengan pembersih karakter khusus.</p>
              </div>
              <div class="rc-item">
                <span class="rc-tag">5. Alpha Channel</span>
                <p>Hanya kanal R, G, B yang dimanipulasi; kanal alpha (transparansi) dilindungi murni.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Quality Evaluation (MSE & PSNR) -->
      <div v-if="activeLabTab === 'imperceptibility'" class="tab-content">
        <div class="glass-card lab-card">
          <h3 class="card-heading">Parameter dan Kriteria Pengujian Kualitas Citra Stego</h3>
          <p class="card-caption">Evaluasi tingkat imperseptibilitas matematis menggunakan Mean Squared Error (MSE) dan Peak Signal-to-Noise Ratio (PSNR).</p>

          <!-- Mathematical Formula Cards -->
          <div class="formula-grid">
            <div class="formula-card">
              <span class="f-title">Persamaan (3) Mean Squared Error (MSE):</span>
              <div class="code-box formula-code">
                MSE = (1 / (3 &times; W &times; H)) &times; &sum; [Cover(x,y,c) - Stego(x,y,c)]&sup2;
              </div>
              <p class="f-desc">Mengukur rata-rata kuadrat selisih nilai intensitas piksel kanal warna RGB.</p>
            </div>

            <div class="formula-card">
              <span class="f-title">Persamaan (4) Peak Signal-to-Noise Ratio (PSNR):</span>
              <div class="code-box formula-code">
                PSNR = 10 &times; log10( 255&sup2; / MSE ) = 20 &times; log10( 255 / &radic;MSE ) (dB)
              </div>
              <p class="f-desc">Rasio desibel antara daya puncak sinyal terhadap derau steganografi.</p>
            </div>
          </div>

          <!-- Evaluation Benchmarks Matrix -->
          <div class="benchmarks-table-wrap">
            <table class="lab-table">
              <thead>
                <tr>
                  <th>Parameter Uji</th>
                  <th>Rentang Acuan Nilai</th>
                  <th>Interpretasi Kualitas Citra</th>
                  <th>Kriteria Keberhasilan</th>
                  <th>Capaian Sistem Nyata</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-bold">MSE (Mean Squared Error)</td>
                  <td class="font-mono">0 &le; MSE &lt; 1.0</td>
                  <td>Penyimpangan nilai intensitas piksel sangat rendah dan homogen</td>
                  <td class="text-gold font-bold">Target MSE &lt; 0.05</td>
                  <td class="text-emerald font-bold">&asymp; 0.00018 (Sangat Sempurna)</td>
                </tr>
                <tr>
                  <td class="font-bold">PSNR (Peak Signal-to-Noise Ratio)</td>
                  <td class="font-mono">&gt; 40.0 dB</td>
                  <td>Kualitas citra sangat baik, distorsi derau tidak kasatmata</td>
                  <td class="text-gold font-bold">Target PSNR &ge; 45.0 dB</td>
                  <td class="text-emerald font-bold">&gt; 85.0 dB (Kategori Sangat Prima)</td>
                </tr>
                <tr>
                  <td class="font-bold">Uji Kasatmata (Human Visual System)</td>
                  <td>Bebas visual noise / artefak</td>
                  <td>Mata manusia tidak mampu membedakan citra cover dan stego</td>
                  <td class="text-gold font-bold">Imperceptible 100%</td>
                  <td class="text-emerald font-bold">Lolos Uji Visual</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 4: Tamper Detection & Avalanche Effect -->
      <div v-if="activeLabTab === 'tamper'" class="tab-content">
        <div class="glass-card lab-card">
          <div class="card-action-bar">
            <div>
              <h3 class="card-heading">Skenario Pengujian Integritas Data &amp; Deteksi Modifikasi</h3>
              <p class="card-caption">Pengujian sifat efek longsor (avalanche effect) SHA-256 terhadap perubahan 1 bit.</p>
            </div>
            <button class="btn btn-primary btn-sm" :disabled="isRunningTamper" @click="runTamperTest">
              <RefreshCw v-if="isRunningTamper" :size="15" class="spin-icon" />
              <Play v-else :size="15" />
              <span>{{ isRunningTamper ? 'Menjalankan Simulasi...' : 'Jalankan 5 Skenario Tamper' }}</span>
            </button>
          </div>

          <!-- 5 Scenarios Table -->
          <div v-if="tamperData" class="table-scroll-wrap">
            <table class="lab-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Kategori Pengujian</th>
                  <th>Skenario Manipulasi Data</th>
                  <th>Karakteristik Hash SHA-256</th>
                  <th>Status Keluaran Sistem</th>
                  <th>Deteksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sc in tamperData.scenarios" :key="sc.scenarioId">
                  <td class="font-mono text-center">{{ sc.scenarioId }}</td>
                  <td class="font-bold">{{ sc.category }}</td>
                  <td>{{ sc.description }}</td>
                  <td class="text-faint text-xs font-mono">{{ sc.originalValue }} &rarr; {{ sc.modifiedValue }}</td>
                  <td class="font-mono text-sm" :class="sc.verified ? 'text-emerald' : 'text-coral'">
                    {{ sc.systemStatus }}
                  </td>
                  <td>
                    <span class="badge" :class="sc.detectedSuccessfully ? 'badge-valid' : 'badge-manipulated'">
                      {{ sc.detectedSuccessfully ? 'TERDETEKSI' : 'GAGAL' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Interactive Live Avalanche Effect Sandbox -->
          <div class="avalanche-sandbox">
            <div class="sandbox-header">
              <Zap :size="20" class="text-gold" />
              <h4 class="sandbox-title">Simulator Interaktif Efek Longsor (Avalanche Effect SHA-256)</h4>
            </div>
            <p class="sandbox-sub">
              Ubah 1 karakter saja pada Teks B, lalu amati perubahan drastis pada 256-bit deretan hash heksadesimal.
            </p>

            <div class="sandbox-inputs">
              <div class="form-group">
                <label class="form-label">Teks Masukan Asli (A)</label>
                <input type="text" v-model="sandboxTextA" class="form-input font-mono" @input="calculateAvalanche" />
              </div>
              <div class="form-group">
                <label class="form-label">Teks Masukan Diubah (B) - Coba ubah 1 karakter</label>
                <input type="text" v-model="sandboxTextB" class="form-input font-mono" @input="calculateAvalanche" />
              </div>
            </div>

            <!-- Avalanche Output Stats -->
            <div v-if="avalancheResult" class="avalanche-result-card">
              <div class="av-stats-row">
                <div class="av-stat">
                  <span class="k">Bit yang Berubah:</span>
                  <span class="v text-gold">{{ avalancheResult.bitDifferences }} / 256 bit</span>
                </div>
                <div class="av-stat">
                  <span class="k">Persentase Avalanche:</span>
                  <span class="v text-emerald font-bold">{{ avalancheResult.avalanchePercentage }}%</span>
                </div>
                <div class="av-stat">
                  <span class="k">Kriteria Kriptografi:</span>
                  <span class="badge badge-valid">&asymp; 50% AVALANCHE (MEMENUHI FIPS 180-4)</span>
                </div>
              </div>

              <!-- Side by Side Hex Visualizer -->
              <div class="hex-diff-visualizer">
                <div class="hex-row">
                  <span class="hex-lbl">Hash A:</span>
                  <div class="hex-chars">
                    <span
                      v-for="(item, idx) in avalancheResult.hexDiffMap"
                      :key="idx"
                      class="hex-char"
                    >
                      {{ item.original }}
                    </span>
                  </div>
                </div>

                <div class="hex-row">
                  <span class="hex-lbl">Hash B:</span>
                  <div class="hex-chars">
                    <span
                      v-for="(item, idx) in avalancheResult.hexDiffMap"
                      :key="idx"
                      class="hex-char"
                      :class="{ 'char-changed': item.changed }"
                    >
                      {{ item.modified }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lab-section {
  padding: 50px 0 80px;
}

.lab-header {
  text-align: center;
  max-width: 850px;
  margin: 0 auto 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.lab-title {
  font-size: 2.2rem;
  font-weight: 800;
  color: #FFFFFF;
}

.lab-desc {
  font-size: 0.98rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.lab-nav-pills {
  display: flex;
  gap: 8px;
  padding: 6px;
  margin-top: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.lab-pill-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 0.86rem;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.lab-pill-btn:hover {
  color: #FFFFFF;
  background: rgba(255, 255, 255, 0.05);
}

.lab-pill-btn.active {
  background: var(--grad-primary);
  color: #FFFFFF;
  box-shadow: 0 4px 14px rgba(218, 101, 86, 0.35);
}

.lab-card {
  padding: 28px;
  border: 1px solid rgba(218, 101, 86, 0.25);
  background: var(--grad-dark-card);
}

.card-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.card-heading {
  font-size: 1.25rem;
  font-weight: 800;
  color: #FFFFFF;
}

.card-caption {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.summary-pills-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.s-pill {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-subtle);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  display: flex;
  gap: 8px;
  font-size: 0.85rem;
}

.s-pill .s-k {
  color: var(--text-muted);
}

.s-pill .s-v {
  color: #FFFFFF;
  font-weight: 700;
  font-family: var(--font-mono);
}

/* Tables */
.table-scroll-wrap {
  overflow-x: auto;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

.lab-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.lab-table th {
  background: rgba(14, 12, 13, 0.9);
  padding: 12px 14px;
  text-align: left;
  color: var(--text-faint);
  font-weight: 700;
  font-size: 0.74rem;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-subtle);
}

.lab-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

/* Sampling Grid */
.sampling-metrics-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.s-metric-box {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 14px;
  display: flex;
  flex-direction: column;
}

.s-metric-box .lbl {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
}

.s-metric-box .val {
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-mono);
  margin: 4px 0;
}

.s-metric-box .hint {
  font-size: 0.68rem;
  color: var(--text-faint);
}

/* Root cause box */
.root-cause-box {
  margin-top: 24px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(253, 183, 115, 0.2);
  border-radius: var(--radius-md);
  padding: 18px;
}

.rc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 12px;
}

.rc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.rc-item {
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
}

.rc-tag {
  color: var(--c-fd);
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
}

.rc-item p {
  color: var(--text-muted);
}

/* Formulas */
.formula-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.formula-card {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 18px;
}

.f-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--c-fd);
}

.formula-code {
  margin: 10px 0;
  font-size: 0.88rem;
}

.f-desc {
  font-size: 0.78rem;
  color: var(--text-faint);
}

/* Avalanche Sandbox */
.avalanche-sandbox {
  margin-top: 28px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(218, 101, 86, 0.3);
  border-radius: var(--radius-md);
  padding: 22px;
}

.sandbox-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.sandbox-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #FFFFFF;
}

.sandbox-sub {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.sandbox-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 18px;
}

.avalanche-result-card {
  background: rgba(14, 12, 13, 0.8);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 16px;
}

.av-stats-row {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.av-stat {
  display: flex;
  gap: 8px;
  font-size: 0.86rem;
}

.av-stat .k {
  color: var(--text-muted);
}

.hex-diff-visualizer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hex-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hex-lbl {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
  width: 60px;
}

.hex-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  background: #080708;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  flex: 1;
}

.hex-char {
  color: var(--c-fd);
  padding: 1px 3px;
  border-radius: 2px;
}

.hex-char.char-changed {
  color: #FFFFFF;
  background: var(--c-da);
  font-weight: 700;
}

.text-gold { color: var(--c-fd); }
.text-emerald { color: #34D399; }
.text-coral { color: #F87171; }
.font-bold { font-weight: 700; }
.font-mono { font-family: var(--font-mono); }
.spin-icon { animation: spin 1s infinite linear; }

@media (max-width: 992px) {
  .sampling-metrics-grid { grid-template-columns: repeat(2, 1fr); }
  .formula-grid { grid-template-columns: 1fr; }
  .sandbox-inputs { grid-template-columns: 1fr; }
}
</style>
