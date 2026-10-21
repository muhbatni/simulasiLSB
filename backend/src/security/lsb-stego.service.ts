import { Injectable, BadRequestException } from '@nestjs/common';
import { PNG } from 'pngjs';
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
  extractedPayload?: string;
  executionTimeMs: number;
  imageDimensions?: { width: number; height: number };
}

@Injectable()
export class LsbSteganoService {
  constructor(private readonly hashCryptoService: HashCryptoService) {}

  /**
   * Algoritma 3.1: Pembangkitan Hash SHA-256 dan Penyisipan Data LSB (Embedding)
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

    // 2. Sanitasi dan Serialisasi atribut metadata
    const strMetadata = [
      this.sanitizeField(metadata.nomor),
      this.sanitizeField(metadata.nama),
      this.sanitizeField(metadata.peran),
      this.sanitizeField(metadata.kegiatan),
      this.sanitizeField(metadata.tanggal),
      this.sanitizeField(metadata.lembaga),
    ].join('#');

    // 3. Pembangkitan hash kriptografi SHA-256 (Segel Integritas)
    const hashSha256 = this.hashCryptoService.computeSha256(strMetadata);

    // 4. Penyusunan string paket payload terintegrasi dengan delimiter
    // Format: M + '###' + H + '@@@'
    const payloadText = `${strMetadata}###${hashSha256}@@@`;

    // 5. Transformasi payload menjadi aliran bit biner (8-bit per byte)
    const payloadBuffer = Buffer.from(payloadText, 'utf8');
    const bitStream: number[] = [];
    for (let i = 0; i < payloadBuffer.length; i++) {
      const byteVal = payloadBuffer[i];
      for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
        bitStream.push((byteVal >> bitIdx) & 1);
      }
    }
    const payloadLen = bitStream.length;

    // 6. Parsing matriks piksel citra penampung PNG
    let coverPng: PNG;
    try {
      coverPng = PNG.sync.read(coverPngBuffer);
    } catch (err: any) {
      throw new BadRequestException('ERROR: Gagal membaca struktur citra PNG: ' + err.message);
    }

    const { width, height } = coverPng;
    const maxCapacity = width * height * 3; // 1 bit LSB per kanal RGB

    // Validasi Kapasitas
    if (payloadLen > maxCapacity) {
      throw new BadRequestException(
        `Kapasitas citra tidak mencukupi: Payload membutuhkan ${payloadLen} bit, kapasitas citra hanya ${maxCapacity} bit`,
      );
    }

    // Salin data piksel untuk citra stego
    const stegoPng = new PNG({ width, height });
    coverPng.data.copy(stegoPng.data);

    // 8. Proses Substitusi Least Significant Bit (LSB)
    let bitIdx = 0;
    const totalPixels = width * height;

    for (let p = 0; p < totalPixels && bitIdx < payloadLen; p++) {
      const pixelOffset = p * 4; // R, G, B, A

      // Channel 0 (Red)
      if (bitIdx < payloadLen) {
        stegoPng.data[pixelOffset] = (stegoPng.data[pixelOffset] & 0xfe) | bitStream[bitIdx++];
      }
      // Channel 1 (Green)
      if (bitIdx < payloadLen) {
        stegoPng.data[pixelOffset + 1] =
          (stegoPng.data[pixelOffset + 1] & 0xfe) | bitStream[bitIdx++];
      }
      // Channel 2 (Blue)
      if (bitIdx < payloadLen) {
        stegoPng.data[pixelOffset + 2] =
          (stegoPng.data[pixelOffset + 2] & 0xfe) | bitStream[bitIdx++];
      }
      // Channel 3 (Alpha) dibiarkan tetap (biasanya 255)
    }

    // 9. Rekonstruksi berkas citra stego PNG Lossless
    const stegoBuffer = PNG.sync.write(stegoPng, {
      deflateLevel: 9,
      deflateStrategy: 0,
    });

    // Hitung MSE dan PSNR kualitas citra steganografi
    const { mse, psnr } = this.calculateMseAndPsnr(coverPng, stegoPng);

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      stegoBuffer,
      metadata,
      sha256Hash: hashSha256,
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
   */
  async extractAndVerify(queryImageBuffer: Buffer): Promise<VerificationResult> {
    const startTime = performance.now();

    // 1. Validasi format citra masukan
    if (!this.isPng(queryImageBuffer)) {
      return {
        status: 'FORMAT_TIDAK_VALID',
        isValid: false,
        message: 'Format bukan PNG lossless; data LSB tidak valid atau rusak',
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    }

    let queryPng: PNG;
    try {
      queryPng = PNG.sync.read(queryImageBuffer);
    } catch {
      return {
        status: 'FORMAT_TIDAK_VALID',
        isValid: false,
        message: 'Citra PNG rusak atau korup, gagal mendekode matriks piksel',
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    }

    const { width, height, data } = queryPng;
    const totalPixels = width * height;

    // 2 & 3. Ekstraksi bit terendah (LSB) secara sekuensial
    const extractedBytes: number[] = [];
    let currentByteVal = 0;
    let bitCount = 0;
    let extractedPayload = '';
    let eofFound = false;

    // Batasi pembacaan maksimal agar efisien (metadata sertifikat tidak akan lebih dari 10.000 karakter)
    const MAX_CHAR_SCAN = 10000;

    for (let p = 0; p < totalPixels; p++) {
      const pixelOffset = p * 4;

      // Scan kanal R, G, B
      for (let c = 0; c < 3; c++) {
        const bit = data[pixelOffset + c] & 1;
        currentByteVal = (currentByteVal << 1) | bit;
        bitCount++;

        if (bitCount === 8) {
          extractedBytes.push(currentByteVal);
          const char = String.fromCharCode(currentByteVal);
          extractedPayload += char;

          currentByteVal = 0;
          bitCount = 0;

          // Evaluasi penanda akhir berkas (EOF) '@@@'
          if (extractedPayload.endsWith('@@@')) {
            eofFound = true;
            break;
          }

          if (extractedPayload.length > MAX_CHAR_SCAN) {
            break;
          }
        }
      }

      if (eofFound || extractedPayload.length > MAX_CHAR_SCAN) {
        break;
      }
    }

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    // 4. Verifikasi keberadaan penanda terminator EOF
    if (!eofFound) {
      return {
        status: 'MANIPULASI_TERDETEKSI',
        isValid: false,
        message:
          'Penanda EOF @@@ tidak ditemukan; bukan sertifikat resmi atau piksel telah rusak',
        executionTimeMs,
        imageDimensions: { width, height },
      };
    }

    // 5. Penguraian struktur payload dan pemisahan segel hash
    const cleanPayload = extractedPayload.slice(0, -3); // Buang '@@@'
    if (!cleanPayload.includes('###')) {
      return {
        status: 'MANIPULASI_TERDETEKSI',
        isValid: false,
        message: 'Struktur payload rusak; delimiter hash ### tidak ditemukan',
        extractedPayload: cleanPayload,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    }

    const parts = cleanPayload.split('###');
    const strMetaExt = parts[0];
    const storedHash = parts[1];

    // 6. Perhitungan ulang hash SHA-256 dari metadata hasil ekstraksi
    const recomputedHash = this.hashCryptoService.computeSha256(strMetaExt);

    // 7. Komparasi integritas data secara deterministik
    const hashMatch = recomputedHash.toLowerCase() === storedHash.toLowerCase();

    const metaTokens = strMetaExt.split('#');
    const metadata: CertificateMetadata = {
      nomor: metaTokens[0] || '',
      nama: metaTokens[1] || '',
      peran: metaTokens[2] || '',
      kegiatan: metaTokens[3] || '',
      tanggal: metaTokens[4] || '',
      lembaga: metaTokens[5] || '',
    };

    if (hashMatch) {
      return {
        status: 'ASLI_VALID',
        isValid: true,
        message: 'Sertifikat Asli & Terverifikasi: Integritas hash SHA-256 cocok dan valid',
        metadata,
        storedHash,
        recomputedHash,
        hashMatch: true,
        extractedPayload: cleanPayload,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    } else {
      return {
        status: 'MANIPULASI_TERDETEKSI',
        isValid: false,
        message:
          'Peringatan: Hash kalkulasi tidak cocok! Data identitas atau piksel citra telah dimanipulasi',
        metadata,
        storedHash,
        recomputedHash,
        hashMatch: false,
        extractedPayload: cleanPayload,
        executionTimeMs,
        imageDimensions: { width, height },
      };
    }
  }

  /**
   * Menghitung Mean Squared Error (MSE) dan Peak Signal-to-Noise Ratio (PSNR)
   * Formula:
   * MSE = 1 / (3 * W * H) * sum((C(x,y,c) - S(x,y,c))^2)
   * PSNR = 10 * log10( (255^2) / MSE ) = 20 * log10( 255 / sqrt(MSE) )
   */
  calculateMseAndPsnr(
    coverPng: PNG,
    stegoPng: PNG,
  ): { mse: number; psnr: number; totalDiffPixels: number } {
    const { width, height } = coverPng;
    const totalPixels = width * height;
    let sumSquaredError = 0;
    let totalDiffPixels = 0;

    for (let p = 0; p < totalPixels; p++) {
      const offset = p * 4;
      let pixelHasDiff = false;

      for (let c = 0; c < 3; c++) {
        const diff = coverPng.data[offset + c] - stegoPng.data[offset + c];
        if (diff !== 0) {
          sumSquaredError += diff * diff;
          pixelHasDiff = true;
        }
      }

      if (pixelHasDiff) totalDiffPixels++;
    }

    const totalChannels = totalPixels * 3;
    const mse = sumSquaredError / totalChannels;

    let psnr = 100; // Perfect match
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
   * Manipulasi piksel visual buatan untuk pengujian Tamper Detection (Tabel 3.4)
   */
  tamperPixel(
    stegoBuffer: Buffer,
    startX = 100,
    startY = 100,
    boxSize = 20,
    color = { r: 255, g: 0, b: 0 },
  ): Buffer {
    const png = PNG.sync.read(stegoBuffer);
    const { width, height, data } = png;

    for (let y = startY; y < Math.min(height, startY + boxSize); y++) {
      for (let x = startX; x < Math.min(width, startX + boxSize); x++) {
        const offset = (y * width + x) * 4;
        data[offset] = color.r;
        data[offset + 1] = color.g;
        data[offset + 2] = color.b;
      }
    }

    return PNG.sync.write(png);
  }

  /**
   * Memeriksa magic header berkas citra PNG
   */
  private isPng(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 8) return false;
    // Magic PNG: 89 50 4E 47 0D 0A 1A 0A
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

  private sanitizeField(value: string | undefined): string {
    if (!value) return '';
    // Hindari delimiter tabrakan
    return value.replace(/#/g, '-').replace(/@/g, '').trim();
  }
}
