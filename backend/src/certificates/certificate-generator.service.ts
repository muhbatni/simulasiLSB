import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface CertificateDesignParams {
  nomor: string;
  nama: string;
  peran: string;
  kegiatan: string;
  tanggal: string;
  lembaga: string;
  width?: number; // 1920 (Full HD) atau 2480 (A4 300 DPI)
  height?: number; // 1080 atau 1754
}

export interface TemplateElementPosition {
  x: number; // Persentase horizontal 0-100%
  y: number; // Persentase vertikal 0-100%
  fontSize?: number; // Ukuran font dasar dalam px
  color?: string; // Warna teks HEX, contoh #A14646
  align?: 'left' | 'center' | 'right';
  prefix?: string; // Awalan teks opsional (contoh: 'NOMOR: ' atau 'Sebagai ')
  show?: boolean; // Tampilkan atau sembunyikan
  fontFamily?: string; // Jenis font (contoh: 'Georgia, serif', 'Arial, sans-serif')
  fontWeight?: string; // Ketebalan font (bold, normal, 600, dll)
}

export interface TemplatePositionsConfig {
  number?: TemplateElementPosition;
  name?: TemplateElementPosition;
  role?: TemplateElementPosition;
}

@Injectable()
export class CertificateGeneratorService {
  /**
   * Menghasilkan citra cover PNG sertifikat beresolusi tinggi dengan tata letak resmi
   * Menggunakan palet warna: #A14646, #DA6556, #EB895B, #FDB773
   */
  async generateCertificateImage(
    params: CertificateDesignParams,
    positions?: TemplatePositionsConfig | null,
  ): Promise<Buffer> {
    const width = params.width || 1920;
    const height = params.height || 1080;

    // Skala proporsional relatif terhadap 1920x1080
    const scale = width / 1920;

    let cfg: TemplatePositionsConfig | null = null;
    if (positions) {
      cfg = typeof positions === 'string' ? JSON.parse(positions) : positions;
    }

    // Dynamic Elements from positions or default fallback
    let numberSvg = '';
    if (cfg?.number && cfg.number.show !== false) {
      const numP = cfg.number;
      const x = (numP.x / 100) * width;
      const y = (numP.y / 100) * height;
      const fSize = (numP.fontSize || 16) * scale;
      const color = numP.color || '#666666';
      const anchor = numP.align === 'left' ? 'start' : numP.align === 'right' ? 'end' : 'middle';
      const prefix = numP.prefix !== undefined ? numP.prefix : '';
      const fullText = prefix + params.nomor;
      const fontFamily = numP.fontFamily || "'Segoe UI', Roboto, sans-serif";
      const fontWeight = numP.fontWeight || '600';
      numberSvg = `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fontFamily}" font-size="${fSize}" font-weight="${fontWeight}" fill="${color}" letter-spacing="${2 * scale}">${this.escapeXml(fullText)}</text>`;
    } else if (!cfg) {
      numberSvg = `<text x="${width / 2}" y="${291 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="600" fill="#666666" letter-spacing="${2 * scale}">NOMOR: ${this.escapeXml(params.nomor)}</text>`;
    }

    let nameSvg = '';
    if (cfg?.name && cfg.name.show !== false) {
      const nameP = cfg.name;
      const x = (nameP.x / 100) * width;
      const y = (nameP.y / 100) * height;
      const fSize = (nameP.fontSize || 48) * scale;
      const color = nameP.color || '#A14646';
      const anchor = nameP.align === 'left' ? 'start' : nameP.align === 'right' ? 'end' : 'middle';
      const prefix = nameP.prefix !== undefined ? nameP.prefix : '';
      const fullText = prefix + params.nama;
      const fontFamily = nameP.fontFamily || "'Georgia', serif";
      const fontWeight = nameP.fontWeight || 'bold';
      nameSvg = `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fSize}" fill="${color}">${this.escapeXml(fullText)}</text>`;
    } else if (!cfg) {
      nameSvg = `
      <g transform="translate(${width / 2}, ${440 * scale})">
        <text text-anchor="middle" dominant-baseline="central" font-family="'Georgia', serif" font-weight="bold" font-size="${48 * scale}" fill="#A14646">${this.escapeXml(params.nama)}</text>
        <line x1="${-350 * scale}" y1="${30 * scale}" x2="${350 * scale}" y2="${30 * scale}" stroke="url(#goldGrad)" stroke-width="${2 * scale}" />
      </g>`;
    }

    let roleSvg = '';
    if (cfg?.role && cfg.role.show !== false) {
      const roleP = cfg.role;
      const x = (roleP.x / 100) * width;
      const y = (roleP.y / 100) * height;
      const fSize = (roleP.fontSize || 21) * scale;
      const color = roleP.color || '#DA6556';
      const anchor = roleP.align === 'left' ? 'start' : roleP.align === 'right' ? 'end' : 'middle';
      const prefix = roleP.prefix !== undefined ? roleP.prefix : '';
      const fullText = prefix + params.peran;
      const fontFamily = roleP.fontFamily || "'Segoe UI', Roboto, sans-serif";
      const fontWeight = roleP.fontWeight || 'bold';
      roleSvg = `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fSize}" fill="${color}">${this.escapeXml(fullText)}</text>`;
    } else if (!cfg) {
      roleSvg = `
      <text x="${width / 2}" y="${525 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${21 * scale}" fill="#444444">
        Atas partisipasi dan dedikasinya sebagai <tspan font-weight="bold" fill="#DA6556">${this.escapeXml(params.peran)}</tspan>
      </text>`;
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#A14646" />
          <stop offset="50%" stop-color="#DA6556" />
          <stop offset="100%" stop-color="#EB895B" />
        </linearGradient>

        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#DA6556" />
          <stop offset="50%" stop-color="#FDB773" />
          <stop offset="100%" stop-color="#EB895B" />
        </linearGradient>

        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#FCF9F7" />
        </linearGradient>

        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#A14646" flood-opacity="0.15" />
        </filter>
      </defs>

      <!-- Background Canvas -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

      <!-- Geometric Watermark Pattern -->
      <g opacity="0.04" stroke="#A14646" stroke-width="2" fill="none">
        <circle cx="${width / 2}" cy="${height / 2}" r="${380 * scale}" />
        <circle cx="${width / 2}" cy="${height / 2}" r="${420 * scale}" />
        <circle cx="${width / 2}" cy="${height / 2}" r="${460 * scale}" stroke-dasharray="8 8" />
        <polygon points="${width / 2},${height / 2 - 300 * scale} ${width / 2 + 300 * scale},${height / 2} ${width / 2},${height / 2 + 300 * scale} ${width / 2 - 300 * scale},${height / 2}" />
        <polygon points="${width / 2},${height / 2 + 300 * scale} ${width / 2 + 300 * scale},${height / 2} ${width / 2},${height / 2 - 300 * scale} ${width / 2 - 300 * scale},${height / 2}" transform="rotate(45 ${width / 2} ${height / 2})" />
      </g>

      <!-- Outer Frame & Border Ribbon -->
      <rect x="${30 * scale}" y="${30 * scale}" width="${width - 60 * scale}" height="${height - 60 * scale}" rx="${16 * scale}" fill="none" stroke="url(#primaryGrad)" stroke-width="${14 * scale}" />
      <rect x="${54 * scale}" y="${54 * scale}" width="${width - 108 * scale}" height="${height - 108 * scale}" rx="${8 * scale}" fill="none" stroke="#FDB773" stroke-width="${3 * scale}" stroke-dasharray="12 6" />
      <rect x="${68 * scale}" y="${68 * scale}" width="${width - 136 * scale}" height="${height - 108 * scale}" rx="${6 * scale}" fill="none" stroke="#A14646" stroke-width="${1.5 * scale}" opacity="0.4" />

      <!-- Corner Ornaments -->
      <g fill="#DA6556">
        <circle cx="${85 * scale}" cy="${85 * scale}" r="${10 * scale}" fill="#FDB773" />
        <circle cx="${width - 85 * scale}" cy="${85 * scale}" r="${10 * scale}" fill="#FDB773" />
        <circle cx="${85 * scale}" cy="${height - 85 * scale}" r="${10 * scale}" fill="#FDB773" />
        <circle cx="${width - 85 * scale}" cy="${height - 85 * scale}" r="${10 * scale}" fill="#FDB773" />
      </g>

      <!-- Top Ribbon / Institution Badge -->
      <g transform="translate(${width / 2}, ${135 * scale})">
        <text text-anchor="middle" font-family="'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" font-weight="700" font-size="${24 * scale}" fill="#A14646" letter-spacing="${3 * scale}">UNIVERSITAS ISLAM NEGERI SUNAN AMPEL SURABAYA</text>
        <text y="${30 * scale}" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="${18 * scale}" fill="#DA6556" letter-spacing="${1.5 * scale}">FAKULTAS SAINS DAN TEKNOLOGI</text>
        <line x1="${-240 * scale}" y1="${48 * scale}" x2="${240 * scale}" y2="${48 * scale}" stroke="url(#goldGrad)" stroke-width="${3 * scale}" />
      </g>

      <!-- Certificate Main Title -->
      <g transform="translate(${width / 2}, ${255 * scale})">
        <text text-anchor="middle" font-family="'Georgia', serif" font-weight="700" font-size="${54 * scale}" fill="url(#primaryGrad)" letter-spacing="${4 * scale}">SERTIFIKAT PENGHARGAAN</text>
      </g>

      ${numberSvg}

      <!-- Statement text -->
      <text x="${width / 2}" y="${350 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Georgia', serif" font-style="italic" font-size="${20 * scale}" fill="#555555">Diberikan dengan hormat dan apresiasi setinggi-tingginya kepada:</text>

      ${nameSvg}

      ${roleSvg}

      <!-- Event Name & Info (Center fixed under role) -->
      <g transform="translate(${width / 2}, ${565 * scale})">
        <text y="${0 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Georgia', serif" font-weight="bold" font-size="${28 * scale}" fill="#222222">
          ${this.escapeXml(params.kegiatan)}
        </text>
        <text y="${42 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${17 * scale}" fill="#666666">
          Dilaksanakan pada tanggal ${this.escapeXml(params.tanggal)} di ${this.escapeXml(params.lembaga)}
        </text>
      </g>

      <!-- Security LSB Badge & Official Seal in Center-Bottom -->
      <g transform="translate(${width / 2}, ${760 * scale})" filter="url(#shadow)">
        <circle cx="0" cy="0" r="${60 * scale}" fill="url(#goldGrad)" />
        <circle cx="0" cy="0" r="${52 * scale}" fill="#FFFFFF" />
        <circle cx="0" cy="0" r="${46 * scale}" fill="url(#primaryGrad)" />
        <text y="${-8 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${10 * scale}" font-weight="bold" fill="#FDB773" letter-spacing="${1 * scale}">LSB SECURED</text>
        <text y="${12 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${14 * scale}" font-weight="900" fill="#FFFFFF">SHA-256</text>
        <text y="${26 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${9 * scale}" font-weight="bold" fill="#FDB773">VERIFIED</text>
      </g>

      <!-- Signatures -->
      <g transform="translate(${280 * scale}, ${830 * scale})">
        <text text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" fill="#555555">Surabaya, ${this.escapeXml(params.tanggal)}</text>
        <text y="${25 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="600" fill="#333333">Dekan Fakultas Sains dan Teknologi</text>
        <path d="M ${-60 * scale} ${75 * scale} Q ${0 * scale} ${45 * scale} ${60 * scale} ${70 * scale} T ${100 * scale} ${65 * scale}" stroke="#A14646" stroke-width="${3 * scale}" fill="none" opacity="0.8" />
        <line x1="${-140 * scale}" y1="${110 * scale}" x2="${140 * scale}" y2="${110 * scale}" stroke="#333333" stroke-width="${1 * scale}" />
        <text y="${130 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="bold" fill="#222222">Dr. Achmad Teguh Wibowo, M.T.</text>
        <text y="${150 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${14 * scale}" fill="#777777">NIP. 198810262014031003</text>
      </g>

      <g transform="translate(${width - 280 * scale}, ${830 * scale})">
        <text text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" fill="#555555">Ketua Penyelenggara Kegiatan</text>
        <path d="M ${-50 * scale} ${75 * scale} Q ${10 * scale} ${50 * scale} ${70 * scale} ${75 * scale}" stroke="#A14646" stroke-width="${3 * scale}" fill="none" opacity="0.8" />
        <line x1="${-140 * scale}" y1="${110 * scale}" x2="${140 * scale}" y2="${110 * scale}" stroke="#333333" stroke-width="${1 * scale}" />
        <text y="${130 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="bold" fill="#222222">Muhammad Andik Izzuddin, M.T.</text>
        <text y="${150 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${14 * scale}" fill="#777777">NIP. 198403072014031001</text>
      </g>

      <text x="${width / 2}" y="${height - 20 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Courier New', monospace" font-size="${11 * scale}" fill="#A14646" opacity="0.7">
        E-CERTIFICATE SECURITY EMBEDDED WITH LSB SPATIAL STEGANOGRAPHY &amp; SHA-256 CRYPTOGRAPHIC SEAL
      </text>
    </svg>
    `;

    return sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  }

  /**
   * Menghasilkan citra template dasar (kosongan) resmi UIN SA
   * untuk digunakan sebagai preview visual Autocrat ketika event belum mengunggah template kustom.
   */
  async generateCertificateTemplateBase(width = 1920, height = 1080): Promise<Buffer> {
    const scale = width / 1920;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#A14646" />
          <stop offset="50%" stop-color="#DA6556" />
          <stop offset="100%" stop-color="#EB895B" />
        </linearGradient>

        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#DA6556" />
          <stop offset="50%" stop-color="#FDB773" />
          <stop offset="100%" stop-color="#EB895B" />
        </linearGradient>

        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#FCF9F7" />
        </linearGradient>

        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#A14646" flood-opacity="0.15" />
        </filter>
      </defs>

      <!-- Background Canvas -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

      <!-- Geometric Watermark Pattern -->
      <g opacity="0.04" stroke="#A14646" stroke-width="2" fill="none">
        <circle cx="${width / 2}" cy="${height / 2}" r="${380 * scale}" />
        <circle cx="${width / 2}" cy="${height / 2}" r="${420 * scale}" />
        <circle cx="${width / 2}" cy="${height / 2}" r="${460 * scale}" stroke-dasharray="8 8" />
        <polygon points="${width / 2},${height / 2 - 300 * scale} ${width / 2 + 300 * scale},${height / 2} ${width / 2},${height / 2 + 300 * scale} ${width / 2 - 300 * scale},${height / 2}" />
        <polygon points="${width / 2},${height / 2 + 300 * scale} ${width / 2 + 300 * scale},${height / 2} ${width / 2},${height / 2 - 300 * scale} ${width / 2 - 300 * scale},${height / 2}" transform="rotate(45 ${width / 2} ${height / 2})" />
      </g>

      <!-- Outer Frame & Border Ribbon -->
      <rect x="${30 * scale}" y="${30 * scale}" width="${width - 60 * scale}" height="${height - 60 * scale}" rx="${16 * scale}" fill="none" stroke="url(#primaryGrad)" stroke-width="${14 * scale}" />
      <rect x="${54 * scale}" y="${54 * scale}" width="${width - 108 * scale}" height="${height - 108 * scale}" rx="${8 * scale}" fill="none" stroke="#FDB773" stroke-width="${3 * scale}" stroke-dasharray="12 6" />
      <rect x="${68 * scale}" y="${68 * scale}" width="${width - 136 * scale}" height="${height - 108 * scale}" rx="${6 * scale}" fill="none" stroke="#A14646" stroke-width="${1.5 * scale}" opacity="0.4" />

      <!-- Corner Ornaments -->
      <g fill="#DA6556">
        <circle cx="${85 * scale}" cy="${85 * scale}" r="${10 * scale}" fill="#FDB773" />
        <circle cx="${width - 85 * scale}" cy="${85 * scale}" r="${10 * scale}" fill="#FDB773" />
        <circle cx="${85 * scale}" cy="${height - 85 * scale}" r="${10 * scale}" fill="#FDB773" />
        <circle cx="${width - 85 * scale}" cy="${height - 85 * scale}" r="${10 * scale}" fill="#FDB773" />
      </g>

      <!-- Top Ribbon / Institution Badge -->
      <g transform="translate(${width / 2}, ${135 * scale})">
        <text text-anchor="middle" font-family="'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" font-weight="700" font-size="${24 * scale}" fill="#A14646" letter-spacing="${3 * scale}">UNIVERSITAS ISLAM NEGERI SUNAN AMPEL SURABAYA</text>
        <text y="${30 * scale}" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="${18 * scale}" fill="#DA6556" letter-spacing="${1.5 * scale}">FAKULTAS SAINS DAN TEKNOLOGI</text>
        <line x1="${-240 * scale}" y1="${48 * scale}" x2="${240 * scale}" y2="${48 * scale}" stroke="url(#goldGrad)" stroke-width="${3 * scale}" />
      </g>

      <!-- Certificate Main Title -->
      <g transform="translate(${width / 2}, ${255 * scale})">
        <text text-anchor="middle" font-family="'Georgia', serif" font-weight="700" font-size="${54 * scale}" fill="url(#primaryGrad)" letter-spacing="${4 * scale}">SERTIFIKAT PENGHARGAAN</text>
      </g>

      <!-- Statement text -->
      <text x="${width / 2}" y="${350 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Georgia', serif" font-style="italic" font-size="${20 * scale}" fill="#555555">Diberikan dengan hormat dan apresiasi setinggi-tingginya kepada:</text>

      <!-- Security LSB Badge & Official Seal in Center-Bottom -->
      <g transform="translate(${width / 2}, ${760 * scale})" filter="url(#shadow)">
        <circle cx="0" cy="0" r="${60 * scale}" fill="url(#goldGrad)" />
        <circle cx="0" cy="0" r="${52 * scale}" fill="#FFFFFF" />
        <circle cx="0" cy="0" r="${46 * scale}" fill="url(#primaryGrad)" />
        <text y="${-8 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${10 * scale}" font-weight="bold" fill="#FDB773" letter-spacing="${1 * scale}">LSB SECURED</text>
        <text y="${12 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${14 * scale}" font-weight="900" fill="#FFFFFF">SHA-256</text>
        <text y="${26 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${9 * scale}" font-weight="bold" fill="#FDB773">VERIFIED</text>
      </g>

      <!-- Signatures -->
      <g transform="translate(${280 * scale}, ${830 * scale})">
        <text text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" fill="#555555">Surabaya</text>
        <text y="${25 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="600" fill="#333333">Dekan Fakultas Sains dan Teknologi</text>
        <path d="M ${-60 * scale} ${75 * scale} Q ${0 * scale} ${45 * scale} ${60 * scale} ${70 * scale} T ${100 * scale} ${65 * scale}" stroke="#A14646" stroke-width="${3 * scale}" fill="none" opacity="0.8" />
        <line x1="${-140 * scale}" y1="${110 * scale}" x2="${140 * scale}" y2="${110 * scale}" stroke="#333333" stroke-width="${1 * scale}" />
        <text y="${130 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="bold" fill="#222222">Dr. Achmad Teguh Wibowo, M.T.</text>
        <text y="${150 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${14 * scale}" fill="#777777">NIP. 198810262014031003</text>
      </g>

      <g transform="translate(${width - 280 * scale}, ${830 * scale})">
        <text text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" fill="#555555">Ketua Penyelenggara Kegiatan</text>
        <path d="M ${-50 * scale} ${75 * scale} Q ${10 * scale} ${50 * scale} ${70 * scale} ${75 * scale}" stroke="#A14646" stroke-width="${3 * scale}" fill="none" opacity="0.8" />
        <line x1="${-140 * scale}" y1="${110 * scale}" x2="${140 * scale}" y2="${110 * scale}" stroke="#333333" stroke-width="${1 * scale}" />
        <text y="${130 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="bold" fill="#222222">Muhammad Andik Izzuddin, M.T.</text>
        <text y="${150 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${14 * scale}" fill="#777777">NIP. 198403072014031001</text>
      </g>

      <text x="${width / 2}" y="${height - 20 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Courier New', monospace" font-size="${11 * scale}" fill="#A14646" opacity="0.7">
        E-CERTIFICATE SECURITY EMBEDDED WITH LSB SPATIAL STEGANOGRAPHY &amp; SHA-256 CRYPTOGRAPHIC SEAL
      </text>
    </svg>
    `;

    return sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  }

  /**
   * Menimpa (overlay) teks nama penerima, nomor, dan peran pada template PNG
   * Mendukung kustomisasi posisi dinamis ala Autocrat Google
   */
  async overlayTextOnTemplate(
    templateBuffer: Buffer,
    params: CertificateDesignParams,
    positions?: TemplatePositionsConfig | null,
  ): Promise<Buffer> {
    const meta = await sharp(templateBuffer).metadata();
    const width = meta.width || 1920;
    const height = meta.height || 1080;
    const scale = width / 1920;

    let cfg: TemplatePositionsConfig | null = null;
    if (positions) {
      cfg = typeof positions === 'string' ? JSON.parse(positions) : positions;
    }

    let elementsSvg = '';

    if (cfg && (cfg.name || cfg.role || cfg.number)) {
      // 1. Nomor Sertifikat
      if (cfg.number && cfg.number.show !== false) {
        const numP = cfg.number;
        const x = (numP.x / 100) * width;
        const y = (numP.y / 100) * height;
        const fSize = (numP.fontSize || 16) * scale;
        const color = numP.color || '#444444';
        const anchor = numP.align === 'left' ? 'start' : numP.align === 'right' ? 'end' : 'middle';
        const prefix = numP.prefix !== undefined ? numP.prefix : '';
        const fullText = prefix + params.nomor;
        const fontFamily = numP.fontFamily || "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
        const fontWeight = numP.fontWeight || '600';
        elementsSvg += `
        <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fontFamily}" font-size="${fSize}" font-weight="${fontWeight}" fill="${color}">
          ${this.escapeXml(fullText)}
        </text>
        `;
      }

      // 2. Nama Peserta
      if (cfg.name && cfg.name.show !== false) {
        const nameP = cfg.name;
        const x = (nameP.x / 100) * width;
        const y = (nameP.y / 100) * height;
        const fSize = (nameP.fontSize || 48) * scale;
        const color = nameP.color || '#A14646';
        const anchor = nameP.align === 'left' ? 'start' : nameP.align === 'right' ? 'end' : 'middle';
        const prefix = nameP.prefix !== undefined ? nameP.prefix : '';
        const fullText = prefix + params.nama;
        const fontFamily = nameP.fontFamily || "'Georgia', serif";
        const fontWeight = nameP.fontWeight || 'bold';
        elementsSvg += `
        <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fSize}" fill="${color}">
          ${this.escapeXml(fullText)}
        </text>
        `;
      }

      // 3. Sebagai Apa (Peran)
      if (cfg.role && cfg.role.show !== false) {
        const roleP = cfg.role;
        const x = (roleP.x / 100) * width;
        const y = (roleP.y / 100) * height;
        const fSize = (roleP.fontSize || 22) * scale;
        const color = roleP.color || '#DA6556';
        const anchor = roleP.align === 'left' ? 'start' : roleP.align === 'right' ? 'end' : 'middle';
        const prefix = roleP.prefix !== undefined ? roleP.prefix : '';
        const fullText = prefix + params.peran;
        const fontFamily = roleP.fontFamily || "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";
        const fontWeight = roleP.fontWeight || '600';
        elementsSvg += `
        <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fSize}" fill="${color}">
          ${this.escapeXml(fullText)}
        </text>
        `;
      }
    } else {
      // Fallback layout bawaan jika template posisi belum disetel
      elementsSvg = `
        <!-- Certificate Number -->
        <text x="${width / 2}" y="${290 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${16 * scale}" font-weight="600" fill="#444444" letter-spacing="${2 * scale}">
          NOMOR: ${this.escapeXml(params.nomor)}
        </text>

        <!-- Recipient Name -->
        <g transform="translate(${width / 2}, ${445 * scale})">
          <text text-anchor="middle" dominant-baseline="central" font-family="'Georgia', serif" font-weight="bold" font-size="${50 * scale}" fill="#A14646">
            ${this.escapeXml(params.nama)}
          </text>
          <line x1="${-300 * scale}" y1="${20 * scale}" x2="${300 * scale}" y2="${20 * scale}" stroke="#DA6556" stroke-width="${2 * scale}" />
        </g>

        <!-- Role & Details -->
        <g transform="translate(${width / 2}, ${530 * scale})">
          <text text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${22 * scale}" fill="#333333">
            Sebagai <tspan font-weight="bold" fill="#DA6556">${this.escapeXml(params.peran)}</tspan>
          </text>
          <text y="${40 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Georgia', serif" font-weight="bold" font-size="${28 * scale}" fill="#222222">
            ${this.escapeXml(params.kegiatan)}
          </text>
          <text y="${80 * scale}" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', Roboto, sans-serif" font-size="${17 * scale}" fill="#666666">
            ${this.escapeXml(params.tanggal)} &#8226; ${this.escapeXml(params.lembaga)}
          </text>
        </g>
      `;
    }

    const textSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${elementsSvg}
    </svg>
    `;

    return sharp(templateBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }])
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  }

  private escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
