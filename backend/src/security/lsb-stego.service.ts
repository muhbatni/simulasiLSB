import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { HashCryptoService } from './hash-crypto.service';

export interface CertificateMetadata {
  nomor: string;
  nama: string;
  peran: string;
  kegiatan: string;
  tanggal: string;
  lembaga: string;
}

export interface EmbedResult {
  stegoBuffer: Buffer;
  metadata: CertificateMetadata;
  sha256Hash: string;
  canvasHash: string;
  payloadText: string;
  payloadBitsCount: number;
  maxCapacityBits: number;
  capacityUsagePercentage: number;
  width: number;
  height: number;
  mse: number;
  psnr: number;
  executionTimeMs: number;
}

export interface VerificationResult {
  status: 'ASLI_VALID' | 'MANIPULASI_TERDETEKSI' | 'FORMAT_TIDAK_VALID';
  isValid: boolean;
  message: string;
  metadata?: CertificateMetadata;
  storedHash?: string;
  recomputedHash?: string;
  hashMatch?: boolean;
  canvasHash?: string;
  canvasHashMatch?: boolean;
  isOfficialDbRegistered?: boolean;
  extractedPayload?: string;
  executionTimeMs: number;
  imageDimensions?: { width: number; height: number };
}

@Injectable()
export class LsbSteganoService {
  constructor(private readonly hashCryptoService: HashCryptoService) {}

  /**
   * Algoritma 3.1: Pembangkitan Hash SHA-256 dan Penyisipan Data LSB (Embedding)
   * Berbasis matriks piksel Sharp raw RGBA lossless (compressionLevel: 9, palette: false)
   */
  async embedPayload(
    coverPngBuffer: Buffer,
    metadata: CertificateMetadata,
  ): Promise<EmbedResult> {
    const startTime = performance.now();

    // 1. Validasi format berkas citra (Signature header PNG: 89 50 4E 47 0D 0A 1A 0A)
    if (!this.isPng(coverPngBuffer)) {
      throw new BadRequestException(
        'ERROR: Format berkas harus PNG lossless untuk menjamin integritas LSB',
      );
    }

    // 2. Validasi panjang field di sisi server
    this.validateMetadataFields(metadata);

    // 3. Ratakan (flatten) transparansi ke latar putih jika ada kanal alfa
    let processedCoverBuffer = coverPngBuffer;
    try {
      processedCoverBuffer = await sharp(coverPngBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png({ compressionLevel: 9, palette: false })
        .toBuffer();
    } catch {
      processedCoverBuffer = coverPngBuffer;
    }

    // 4. Sanitasi dan Serialisasi atribut metadata M = Nomor#Nama#Peran#Kegiatan#Tanggal#Lembaga
    const escapedNomor = this.escapeField(metadata.nomor);
    const escapedNama = this.escapeField(metadata.nama);
    const escapedPeran = this.escapeField(metadata.peran);
    const escapedKegiatan = this.escapeField(metadata.kegiatan);
    const escapedTanggal = this.escapeField(metadata.tanggal);
    const escapedLembaga = this.escapeField(metadata.lembaga);

    const strMetadata = [
      escapedNomor,
      escapedNama,
      escapedPeran,
      escapedKegiatan,
      escapedTanggal,
      escapedLembaga,
    ].join('#');

    // 5. Pembangkitan hash kriptografi H = SHA-256(M) (64 hex lowercase)
    const hashSha256 = this.hashCryptoService.computeSha256(strMetadata).toLowerCase();

    // 6. Penyusunan string paket payload terintegrasi dengan delimiter
    // Format: P = M + '###' + H + '@@@'
    const payloadText = `${strMetadata}###${hashSha256}@@@`;

    // 7. Transformasi payload menjadi aliran byte dan bit biner UTF-8 (8-bit per byte)
    const payloadBuffer = Buffer.from(payloadText, 'utf8');
    const bitStream: number[] = [];
    for (let i = 0; i < payloadBuffer.length; i++) {
      const byteVal = payloadBuffer[i];
      for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
        bitStream.push((byteVal >> bitIdx) & 1);
      }
    }
    const payloadLen = bitStream.length;

    // 8. Ekstraksi matriks piksel raw RGBA menggunakan Sharp
    let coverRaw: Buffer;
    let width: number;
    let height: number;
    let channels: number;

    try {
      const res = await sharp(processedCoverBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      coverRaw = res.data;
      width = res.info.width;
      height = res.info.height;
      channels = res.info.channels; // 4 kanal (RGBA)
    } catch (err: any) {
      throw new BadRequestException('ERROR: Gagal membaca struktur citra PNG: ' + err.message);
    }

    const maxCapacity = width * height * 3; // 1 bit LSB per kanal RGB

    // Validasi Kapasitas Spasial Citra
    if (payloadLen > maxCapacity) {
      throw new BadRequestException(
        `Kapasitas citra tidak mencukupi: Payload membutuhkan ${payloadLen} bit, kapasitas citra hanya ${maxCapacity} bit`,
      );
    }

    // Salin buffer piksel untuk penyisipan LSB
    const stegoRaw = Buffer.from(coverRaw);

    // 9. Proses Substitusi Least Significant Bit (LSB): C' = (C AND 254) OR b
    let bitIdx = 0;
    const totalPixels = width * height;

    for (let p = 0; p < totalPixels && bitIdx < payloadLen; p++) {
      const pixelOffset = p * 4; // R, G, B, A

      // Kanal Red
      if (bitIdx < payloadLen) {
        stegoRaw[pixelOffset] = (stegoRaw[pixelOffset] & 0xfe) | bitStream[bitIdx++];
      }
      // Kanal Green
      if (bitIdx < payloadLen) {
        stegoRaw[pixelOffset + 1] = (stegoRaw[pixelOffset + 1] & 0xfe) | bitStream[bitIdx++];
      }
      // Kanal Blue
      if (bitIdx < payloadLen) {
        stegoRaw[pixelOffset + 2] = (stegoRaw[pixelOffset + 2] & 0xfe) | bitStream[bitIdx++];
      }
      // Kanal Alpha (pixelOffset + 3) dibiarkan utuh tidak disentuh
    }

    // 10. Rekonstruksi citra stego PNG Lossless melalui Sharp
    const stegoBuffer = await sharp(stegoRaw, {
      raw: { width, height, channels: 4 },
    })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();

    // 11. Hitung MSE dan PSNR dari buffer raw citra cover dan stego
    const { mse, psnr } = this.calculateMseAndPsnr(coverRaw, stegoRaw, width, height);

    // 12. Hitung Canvas Hash (pengikatan integritas visual kanvas)
    const canvasHash = this.computeCanvasHashFromRaw(stegoRaw, width, height);

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      stegoBuffer,
      metadata: {
        nomor: this.unescapeField(escapedNomor),
        nama: this.unescapeField(escapedNama),
        peran: this.unescapeField(escapedPeran),
        kegiatan: this.unescapeField(escapedKegiatan),
        tanggal: this.unescapeField(escapedTanggal),
        lembaga: this.unescapeField(escapedLembaga),
      },
      sha256Hash: hashSha256,
      canvasHash,
      payloadText,
      payloadBitsCount: payloadLen,
      maxCapacityBits: maxCapacity,
      capacityUsagePercentage: Number(((payloadLen / maxCapacity) * 100).toFixed(4)),
      width,
      height,
      mse,
      psnr,
      executionTimeMs,
    };
  }

  /**
   * Algoritma 3.2: Ekstraksi Pesan LSB dan Verifikasi Integritas SHA-256 (Extract & Verify)
   * Dilengkapi deteksi terminator byte @@@ (0x40 0x40 0x40) dan parsing UTF-8 multi-byte aman
   */
  async extractAndVerify(queryImageBuffer: Buffer): Promise<VerificationResult> {
    const startTime = performance.now();

    // 1. Validasi format citra masukan & magic bytes
    if (!this.isPng(queryImageBuffer)) {
      return {
        status: 'FORMAT_TIDAK_VALID',
        isValid: false,
        message: 'Format bukan PNG lossless; tanda steganografi rusak atau tidak ditemukan',
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    }

    let rawBuffer: Buffer;
    let width: number;
    let height: number;

    try {
      const res = await sharp(queryImageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      rawBuffer = res.data;
      width = res.info.width;
      height = res.info.height;
    } catch {
      return {
        status: 'FORMAT_TIDAK_VALID',
        isValid: false,
        message: 'Citra PNG rusak atau korup, gagal mendekode matriks piksel',
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    }

    const totalPixels = width * height;

    // 2. Ekstraksi bit terendah (LSB) kanal R, G, B dan kumpulkan byte
    const extractedBytes: number[] = [];
    let currentByteVal = 0;
    let bitCount = 0;
    let eofFound = false;

    // Batas pemindaian dalam byte (50.000 byte)
    const MAX_BYTE_SCAN = 50000;

    for (let p = 0; p < totalPixels; p++) {
      const pixelOffset = p * 4;

      // Scan kanal R (0), G (1), B (2)
      for (let c = 0; c < 3; c++) {
        const bit = rawBuffer[pixelOffset + c] & 1;
        currentByteVal = (currentByteVal << 1) | bit;
        bitCount++;

        if (bitCount === 8) {
          extractedBytes.push(currentByteVal);
          currentByteVal = 0;
          bitCount = 0;

          // Deteksi terminator @@@ pada level byte: 0x40, 0x40, 0x40
          const byteLen = extractedBytes.length;
          if (
            byteLen >= 3 &&
            extractedBytes[byteLen - 3] === 0x40 &&
            extractedBytes[byteLen - 2] === 0x40 &&
            extractedBytes[byteLen - 1] === 0x40
          ) {
            eofFound = true;
            break;
          }

          if (byteLen >= MAX_BYTE_SCAN) {
            break;
          }
        }
      }

      if (eofFound || extractedBytes.length >= MAX_BYTE_SCAN) {
        break;
      }
    }

    // Hitung canvas hash dari citra yang diuji
    const currentCanvasHash = this.computeCanvasHashFromRaw(rawBuffer, width, height);
    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    // 3. Verifikasi keberadaan penanda terminator EOF
    if (!eofFound) {
      return {
        status: 'MANIPULASI_TERDETEKSI',
        isValid: false,
        message:
          'Error: Tanda Steganografi Rusak / Tidak Ditemukan (Penanda @@@ tidak ditemukan)',
        canvasHash: currentCanvasHash,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    }

    // 4. Dekode byte UTF-8 payload (tanpa 3 byte terminator @@@ di akhir)
    const payloadBytes = Buffer.from(extractedBytes.slice(0, -3));
    const cleanPayload = payloadBytes.toString('utf8');

    // 5. Penguraian struktur payload dan pemisahan segel hash
    if (!cleanPayload.includes('###')) {
      return {
        status: 'MANIPULASI_TERDETEKSI',
        isValid: false,
        message:
          'Peringatan: Sertifikat Tidak Valid / Telah Mengalami Manipulasi Data! (Delimiter ### hilang)',
        canvasHash: currentCanvasHash,
        extractedPayload: cleanPayload,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    }

    const delimiterIndex = cleanPayload.lastIndexOf('###');
    const strMetaExt = cleanPayload.substring(0, delimiterIndex);
    const storedHash = cleanPayload.substring(delimiterIndex + 3).trim();

    // 6. Validasi struktur metadata token (wajib tepat 6 token: Nomor#Nama#Peran#Kegiatan#Tanggal#Lembaga)
    const metaTokens = strMetaExt.split('#');
    if (metaTokens.length !== 6) {
      return {
        status: 'MANIPULASI_TERDETEKSI',
        isValid: false,
        message:
          'Peringatan: Data Sertifikat Tidak Cocok (Format metadata rusak / jumlah token ≠ 6)',
        canvasHash: currentCanvasHash,
        storedHash,
        extractedPayload: cleanPayload,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    }

    // 7. Perhitungan ulang hash SHA-256 dari metadata hasil ekstraksi
    const recomputedHash = this.hashCryptoService.computeSha256(strMetaExt).toLowerCase();
    const hashMatch = recomputedHash === storedHash.toLowerCase();

    const metadata: CertificateMetadata = {
      nomor: this.unescapeField(metaTokens[0]),
      nama: this.unescapeField(metaTokens[1]),
      peran: this.unescapeField(metaTokens[2]),
      kegiatan: this.unescapeField(metaTokens[3]),
      tanggal: this.unescapeField(metaTokens[4]),
      lembaga: this.unescapeField(metaTokens[5]),
    };

    if (hashMatch) {
      return {
        status: 'ASLI_VALID',
        isValid: true,
        message: 'Sertifikat Asli & Terverifikasi (Integritas Terjaga)',
        metadata,
        storedHash,
        recomputedHash,
        hashMatch: true,
        canvasHash: currentCanvasHash,
        extractedPayload: cleanPayload,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    } else {
      return {
        status: 'MANIPULASI_TERDETEKSI',
        isValid: false,
        message:
          'Peringatan: Sertifikat Tidak Valid / Telah Mengalami Manipulasi Data!',
        metadata,
        storedHash,
        recomputedHash,
        hashMatch: false,
        canvasHash: currentCanvasHash,
        extractedPayload: cleanPayload,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    }
  }

  /**
   * Menghitung hash SHA-256 dari seluruh piksel RGB citra setelah LSB dinolkan (& 0xfe).
   * Nilai hash ini identik sebelum dan setelah penyisipan LSB, namun sensitif terhadap
   * manipulasi visual (pengecatan piksel, penempelan QR, modifikasi stempel/logo).
   */
  async computeCanvasHash(imageBuffer: Buffer): Promise<string> {
    const { data: raw, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return this.computeCanvasHashFromRaw(raw, info.width, info.height);
  }

  /**
   * Helper internal untuk menghitung Canvas Hash dari buffer raw RGBA
   */
  public computeCanvasHashFromRaw(rawBuffer: Buffer, width: number, height: number): string {
    const totalPixels = width * height;
    const rgbZeroed = Buffer.alloc(totalPixels * 3);
    let rgbIdx = 0;

    for (let p = 0; p < totalPixels; p++) {
      const offset = p * 4;
      rgbZeroed[rgbIdx++] = rawBuffer[offset] & 0xfe;     // Red (LSB zeroed)
      rgbZeroed[rgbIdx++] = rawBuffer[offset + 1] & 0xfe; // Green (LSB zeroed)
      rgbZeroed[rgbIdx++] = rawBuffer[offset + 2] & 0xfe; // Blue (LSB zeroed)
    }

    return this.hashCryptoService.computeSha256(rgbZeroed).toLowerCase();
  }

  /**
   * Menghitung Mean Squared Error (MSE) dan Peak Signal-to-Noise Ratio (PSNR)
   * Formula:
   * MSE = 1 / (3 * W * H) * sum((C(x,y,c) - S(x,y,c))^2)
   * PSNR = 10 * log10( (255^2) / MSE )
   */
  calculateMseAndPsnr(
    coverRaw: Buffer,
    stegoRaw: Buffer,
    width: number,
    height: number,
  ): { mse: number; psnr: number; totalDiffPixels: number } {
    const totalPixels = width * height;
    let sumSquaredError = 0;
    let totalDiffPixels = 0;

    for (let p = 0; p < totalPixels; p++) {
      const offset = p * 4;
      let pixelHasDiff = false;

      for (let c = 0; c < 3; c++) {
        const diff = coverRaw[offset + c] - stegoRaw[offset + c];
        if (diff !== 0) {
          sumSquaredError += diff * diff;
          pixelHasDiff = true;
        }
      }

      if (pixelHasDiff) totalDiffPixels++;
    }

    const totalChannels = totalPixels * 3;
    const mse = sumSquaredError / totalChannels;

    // Jika MSE = 0 (identik sempurna), PSNR dibatasi 100 dB
    let psnr = 100;
    if (mse > 0) {
      psnr = 10 * Math.log10((255 * 255) / mse);
    }

    return {
      mse: Number(mse.toFixed(6)),
      psnr: Number(psnr.toFixed(4)),
      totalDiffPixels,
    };
  }

  /**
   * Manipulasi piksel visual buatan untuk pengujian Tamper Detection
   * Menggunakan Sharp raw buffer
   */
  async tamperPixel(
    stegoBuffer: Buffer,
    startX = 100,
    startY = 100,
    boxSize = 20,
    color = { r: 255, g: 0, b: 0 },
  ): Promise<Buffer> {
    const { data: raw, info } = await sharp(stegoBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let y = startY; y < Math.min(info.height, startY + boxSize); y++) {
      for (let x = startX; x < Math.min(info.width, startX + boxSize); x++) {
        const offset = (y * info.width + x) * 4;
        raw[offset] = color.r;
        raw[offset + 1] = color.g;
        raw[offset + 2] = color.b;
      }
    }

    return sharp(raw, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
  }

  /**
   * Memeriksa magic header berkas citra PNG (89 50 4E 47 0D 0A 1A 0A)
   */
  public isPng(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 8) return false;
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  /**
   * Validasi panjang field metadata di sisi server
   */
  private validateMetadataFields(metadata: CertificateMetadata): void {
    if (!metadata.nomor || metadata.nomor.trim().length > 100) {
      throw new BadRequestException('Nomor sertifikat wajib diisi dan maksimal 100 karakter');
    }
    if (!metadata.nama || metadata.nama.trim().length > 100) {
      throw new BadRequestException('Nama penerima wajib diisi dan maksimal 100 karakter');
    }
    if (metadata.peran && metadata.peran.trim().length > 30) {
      throw new BadRequestException('Peran penerima maksimal 30 karakter');
    }
    if (metadata.kegiatan && metadata.kegiatan.trim().length > 150) {
      throw new BadRequestException('Nama kegiatan maksimal 150 karakter');
    }
    if (metadata.tanggal && metadata.tanggal.trim().length > 30) {
      throw new BadRequestException('Tanggal kegiatan maksimal 30 karakter');
    }
    if (metadata.lembaga && metadata.lembaga.trim().length > 150) {
      throw new BadRequestException('Nama lembaga penyelenggara maksimal 150 karakter');
    }
  }

  /**
   * Escape karakter % (# dan @) menjadi %25 (%23 dan %40)
   */
  public escapeField(value: string | undefined): string {
    if (!value) return '';
    return value
      .replace(/%/g, '%25')
      .replace(/#/g, '%23')
      .replace(/@/g, '%40')
      .trim();
  }

  /**
   * Unescape kode %23 dan %40 kembali ke # dan @ saat ditampilkan
   * Urutan: unescape %23 dan %40 terlebih dahulu, kemudian %25 terakhir untuk mencegah double-unescape
   */
  public unescapeField(value: string | undefined): string {
    if (!value) return '';
    return value
      .replace(/%23/g, '#')
      .replace(/%40/g, '@')
      .replace(/%25/g, '%');
  }
}
