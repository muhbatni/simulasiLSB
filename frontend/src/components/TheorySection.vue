<script setup>
import { ShieldCheck, Lock, EyeOff, FileCode2, AlertOctagon, CheckCircle2 } from '@lucide/vue'
</script>

<template>
  <section class="theory-section">
    <div class="container">
      <div class="theory-header">
        <span class="badge badge-brand">LANDASAN TEORETIS &amp; KEUNGGULAN SISTEM</span>
        <h2 class="theory-title">Mengapa Steganografi LSB &amp; SHA-256 Unggul?</h2>
        <p class="theory-desc">
          Perbandingan komprehensif antara pengamanan visual QR Code konvensional dengan skema pengamanan ganda LSB-SHA256
          pada domain spasial citra digital.
        </p>
      </div>

      <!-- Comparison Feature Cards (Triv.co.id Style) -->
      <div class="cards-grid">
        <!-- Card 1: Kelemahan QR Code -->
        <div class="feat-card glass-card">
          <div class="icon-wrap warning">
            <AlertOctagon :size="24" />
          </div>
          <h3 class="feat-title">Celah QR Code Konvensional</h3>
          <p class="feat-text">
            QR Code adalah objek visual terpisah di atas sertifikat. Pelaku pemalsuan cukup menyalin (screenshot/crop) gambar QR Code dari sertifikat asli dan menempelkannya ke sertifikat palsu (<strong>Visual Copy-Paste Attack</strong>). Saat dipindai, sistem menyatakan valid karena isi QR Code asli, padahal nama sertifikat telah dimanipulasi.
          </p>
          <div class="card-footer-pill tag-warning">Rentan Pemalsuan Visual</div>
        </div>

        <!-- Card 2: LSB Spasial -->
        <div class="feat-card glass-card">
          <div class="icon-wrap brand">
            <EyeOff :size="24" />
          </div>
          <h3 class="feat-title">Steganografi Spasial LSB</h3>
          <p class="feat-text">
            Data identitas sertifikat disisipkan langsung ke bit terendah (Least Significant Bit) pada kanal warna RGB citra. Tidak ada objek visual tambahan yang dapat dipisahkan. Setiap piksel citra berfungsi sebagai media pembawa rahasia dengan nilai PSNR &gt; 80 dB yang sama sekali tidak kasatmata.
          </p>
          <div class="card-footer-pill tag-brand">Imperceptible (PSNR &ge; 45 dB)</div>
        </div>

        <!-- Card 3: Segel Integritas SHA-256 -->
        <div class="feat-card glass-card">
          <div class="icon-wrap emerald">
            <Lock :size="24" />
          </div>
          <h3 class="feat-title">Segel Integritas SHA-256</h3>
          <p class="feat-text">
            Fungsi hash 256-bit menghasilkan nilai intisari deterministik satu arah dengan sifat <em>Avalanche Effect</em>. Perubahan 1 karakter nama penerima (misal: 'Ahmad' menjadi 'Ahmed') akan membalik &asymp;50% deretan bit hash, sehingga sistem seketika mendeteksi manipulasi dokumen.
          </p>
          <div class="card-footer-pill tag-emerald">Tamper-Evident Security</div>
        </div>

        <!-- Card 4: Format PNG Lossless -->
        <div class="feat-card glass-card">
          <div class="icon-wrap gold">
            <FileCode2 :size="24" />
          </div>
          <h3 class="feat-title">Preservasi Bit-Exact PNG</h3>
          <p class="feat-text">
            Algoritma kompresi Deflate pada Portable Network Graphics (PNG) menjamin seluruh nilai matriks piksel terjaga tanpa distorsi (lossless). Berkas JPEG/JPG dilarang karena kompresi kuantisasi frekuensi DCT merusak bit-bit terendah LSB (lossy bit corruption).
          </p>
          <div class="card-footer-pill tag-gold">Lossless Compression Only</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.theory-section {
  padding: 80px 0;
  background: linear-gradient(180deg, transparent 0%, rgba(14, 12, 13, 0.7) 100%);
  border-top: 1px solid rgba(218, 101, 86, 0.12);
}

.theory-header {
  text-align: center;
  max-width: 780px;
  margin: 0 auto 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.theory-title {
  font-size: 2.2rem;
  font-weight: 800;
  color: #FFFFFF;
}

.theory-desc {
  font-size: 1rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.feat-card {
  padding: 28px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(218, 101, 86, 0.2);
  background: var(--grad-dark-card);
}

.icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.icon-wrap.warning {
  background: rgba(239, 68, 68, 0.18);
  color: var(--color-danger);
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.icon-wrap.brand {
  background: rgba(218, 101, 86, 0.2);
  color: var(--c-fd);
  border: 1px solid rgba(218, 101, 86, 0.4);
}

.icon-wrap.emerald {
  background: rgba(16, 185, 129, 0.18);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.icon-wrap.gold {
  background: rgba(253, 183, 115, 0.18);
  color: var(--c-fd);
  border: 1px solid rgba(253, 183, 115, 0.35);
}

.feat-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 12px;
}

.feat-text {
  font-size: 0.88rem;
  color: var(--text-muted);
  line-height: 1.65;
  margin-bottom: 24px;
}

.card-footer-pill {
  font-size: 0.74rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 9999px;
  width: fit-content;
}

.tag-warning {
  background: rgba(239, 68, 68, 0.12);
  color: #F87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.tag-brand {
  background: rgba(218, 101, 86, 0.14);
  color: var(--c-fd);
  border: 1px solid rgba(218, 101, 86, 0.3);
}

.tag-emerald {
  background: rgba(16, 185, 129, 0.12);
  color: #34D399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.tag-gold {
  background: rgba(253, 183, 115, 0.12);
  color: var(--c-fd);
  border: 1px solid rgba(253, 183, 115, 0.3);
}
</style>
