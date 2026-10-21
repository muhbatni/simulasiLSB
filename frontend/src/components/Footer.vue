<script setup>
import { ShieldCheck, Heart } from '@lucide/vue'
</script>

<template>
  <footer class="app-footer">
    <div class="container footer-content">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="f-logo">
            <ShieldCheck :size="24" class="logo-icon text-gold" />
            <span class="f-title">SertifikatSec</span>
          </div>
          <p class="f-desc">
            Sistem Peningkatan Keamanan E-Sertifikat Digital Berbasis Algoritma Least Significant Bit (LSB) dan SHA-256.
            Implementasi pada Kegiatan di Lingkungan UIN Sunan Ampel Surabaya.
          </p>
          <div class="palette-swatches">
            <span class="swatch" style="background: #A14646;" title="#A14646 (Deep Terracotta)"></span>
            <span class="swatch" style="background: #DA6556;" title="#DA6556 (Coral Crimson)"></span>
            <span class="swatch" style="background: #EB895B;" title="#EB895B (Sunset Peach)"></span>
            <span class="swatch" style="background: #FDB773;" title="#FDB773 (Radiant Gold)"></span>
          </div>
        </div>

        <div class="footer-meta-col">
          <h4 class="col-heading">Identitas Akademik</h4>
          <ul class="meta-list">
            <li><strong>Peneliti:</strong> Muh. Batni Mukharroro</li>
            <li><strong>NIM:</strong> 09020623041</li>
            <li><strong>Program Studi:</strong> Sistem Informasi</li>
            <li><strong>Fakultas:</strong> Sains dan Teknologi</li>
            <li><strong>Institusi:</strong> UIN Sunan Ampel Surabaya (2026)</li>
          </ul>
        </div>

        <div class="footer-meta-col">
          <h4 class="col-heading">Dosen Pembimbing</h4>
          <ul class="meta-list">
            <li><strong>Pembimbing I:</strong> Dr. Achmad Teguh Wibowo, M.T.</li>
            <li><strong>Pembimbing II:</strong> Muhammad Andik Izzuddin, M.T.</li>
            <li><strong>Arsitektur:</strong> Modular Three-Tier (NestJS + Vue 3)</li>
            <li><strong>Steganografi:</strong> LSB Spasial (Lossless PNG)</li>
            <li><strong>Kriptografi:</strong> SHA-256 (FIPS 180-4)</li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; 2026 Muh. Batni Mukharroro &bull; Program Studi Sistem Informasi, FST UINSA Surabaya.</p>
        <p class="crypto-note">Dikembangkan dengan Algoritma LSB &amp; SHA-256 Lossless Standard</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  background: #090708;
  border-top: 1px solid rgba(218, 101, 86, 0.2);
  padding: 60px 0 30px;
  color: var(--text-muted);
}

.footer-top {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.f-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.f-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #FFFFFF;
}

.f-desc {
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--text-muted);
}

.palette-swatches {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.col-heading {
  font-size: 0.95rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.84rem;
}

.meta-list strong {
  color: var(--c-fd);
}

.footer-bottom {
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
  color: var(--text-faint);
}

.crypto-note {
  color: var(--c-fd);
  font-family: var(--font-mono);
}

.text-gold {
  color: var(--c-fd);
}

@media (max-width: 768px) {
  .footer-top {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .footer-bottom {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}
</style>
