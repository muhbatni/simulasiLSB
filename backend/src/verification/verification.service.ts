import { Injectable } from '@nestjs/common';
import { DatabaseService, VerificationLog } from '../database/database.service';
import { LsbSteganoService, VerificationResult } from '../security/lsb-stego.service';

@Injectable()
export class VerificationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly lsbService: LsbSteganoService,
  ) {}

  async verifyUploadedCertificate(
    imageBuffer: Buffer,
    ipAddress = '127.0.0.1',
  ): Promise<VerificationResult> {
    const result = await this.lsbService.extractAndVerify(imageBuffer);

    let certId: string | undefined = undefined;
    let isOfficialDbRegistered = false;
    let detailMessage = result.message;

    // F-10: Pencocokan ke Basis Data Resmi (Database Matching)
    if (result.isValid && result.metadata?.nomor) {
      const dbCert = this.db.certificates.find(
        (c) =>
          c.certificateNumber.trim().toLowerCase() ===
          result.metadata!.nomor.trim().toLowerCase(),
      );

      if (dbCert) {
        certId = dbCert.id;
        // Cek status pencabutan
        if (dbCert.status === 'DICABUT') {
          result.isValid = false;
          result.status = 'MANIPULASI_TERDETEKSI';
          result.message =
            'Peringatan: Sertifikat telah dicabut dan dinyatakan tidak berlaku lagi oleh universitas.';
          detailMessage = 'Status di basis data: DICABUT';
        } else if (
          dbCert.sha256Hash &&
          dbCert.sha256Hash.toLowerCase() === result.storedHash?.toLowerCase()
        ) {
          isOfficialDbRegistered = true;
          result.message =
            'Sertifikat Asli & Terverifikasi (Integritas Terjaga - Terdaftar Resmi di Basis Data)';
          detailMessage = 'Terverifikasi cocok dengan rekaman basis data resmi';
        } else {
          result.isValid = false;
          result.status = 'MANIPULASI_TERDETEKSI';
          result.message =
            'Peringatan: Hash citra tidak sesuai dengan rekaman hash resmi di basis data universitas.';
          detailMessage = 'Hash mismatch dengan tabel Certificates';
        }
      } else {
        // Hash internal cocok, namun nomor sertifikat tidak ditemukan di DB
        isOfficialDbRegistered = false;
        result.message =
          'Peringatan: Struktur dan hash internal valid, namun TIDAK TERDAFTAR di basis data resmi penerbit (indikasi sertifikat tiruan pihak luar).';
        detailMessage = 'Nomor sertifikat tidak ditemukan di basis data resmi';
      }
    }

    result.isOfficialDbRegistered = isOfficialDbRegistered;

    // F-11: Catat Jejak Audit ke VerificationLogs
    const log: VerificationLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      certificateId: certId,
      certificateNumber: result.metadata?.nomor,
      recipientName: result.metadata?.nama,
      ipAddress,
      verificationStatus: result.status,
      tVerifMs: result.executionTimeMs,
      verifiedAt: new Date().toISOString(),
      message: result.message,
      detail: detailMessage,
      storedHash: result.storedHash,
      recomputedHash: result.recomputedHash,
    };

    this.db.verificationLogs.unshift(log);
    this.db.saveData();

    return result;
  }

  // F-11: Filter Log Verifikasi
  getLogs(query?: {
    status?: string;
    q?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): VerificationLog[] {
    let list = this.db.verificationLogs;

    if (query?.status) {
      list = list.filter((l) => l.verificationStatus === query.status);
    }

    if (query?.q) {
      const q = query.q.trim().toLowerCase();
      list = list.filter(
        (l) =>
          (l.certificateNumber && l.certificateNumber.toLowerCase().includes(q)) ||
          (l.recipientName && l.recipientName.toLowerCase().includes(q)) ||
          l.ipAddress.includes(q),
      );
    }

    if (query?.startDate) {
      const from = new Date(query.startDate).getTime();
      list = list.filter((l) => new Date(l.verifiedAt).getTime() >= from);
    }

    if (query?.endDate) {
      const to = new Date(query.endDate).getTime();
      list = list.filter((l) => new Date(l.verifiedAt).getTime() <= to);
    }

    const limit = query?.limit ? Number(query.limit) : 200;
    return list.slice(0, limit);
  }

  // F-11: Ekspor CSV Log Verifikasi
  exportLogsToCsv(): string {
    const headers = [
      'ID Log',
      'Waktu Verifikasi (WIB)',
      'IP Pemohon',
      'Nomor Sertifikat',
      'Nama Penerima',
      'Status Verifikasi',
      'Latensi (ms)',
      'Keterangan',
      'Detail Audit',
      'Hash SHA-256',
    ];

    const rows = this.db.verificationLogs.map((l) => {
      return [
        `"${l.id}"`,
        `"${new Date(l.verifiedAt).toLocaleString('id-ID')}"`,
        `"${l.ipAddress}"`,
        `"${l.certificateNumber || '-'}"`,
        `"${l.recipientName || '-'}"`,
        `"${l.verificationStatus}"`,
        `"${l.tVerifMs || 0}"`,
        `"${(l.message || '').replace(/"/g, '""')}"`,
        `"${(l.detail || '').replace(/"/g, '""')}"`,
        `"${l.storedHash || '-'}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  getStats() {
    const total = this.db.verificationLogs.length;
    const valid = this.db.verificationLogs.filter((l) => l.verificationStatus === 'ASLI_VALID').length;
    const manipulated = this.db.verificationLogs.filter(
      (l) => l.verificationStatus === 'MANIPULASI_TERDETEKSI',
    ).length;
    const invalidFormat = this.db.verificationLogs.filter(
      (l) => l.verificationStatus === 'FORMAT_TIDAK_VALID',
    ).length;

    return {
      totalVerifications: total,
      validCount: valid,
      manipulatedCount: manipulated,
      invalidFormatCount: invalidFormat,
      totalCertificatesIssued: this.db.certificates.filter((c) => c.status === 'TERBIT').length,
      totalEvents: this.db.events.length,
    };
  }
}
