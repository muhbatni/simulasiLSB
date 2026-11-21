import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  LsbSteganoService,
  VerificationResult,
} from '../security/lsb-stego.service';
import type { VerificationLog } from '@prisma/client';
import { VerificationStatus } from '@prisma/client';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lsbService: LsbSteganoService,
  ) {}

  async verifyUploadedCertificate(
    imageBuffer: Buffer,
    ipAddress = '127.0.0.1',
  ): Promise<VerificationResult> {
    const result = await this.lsbService.extractAndVerify(imageBuffer);

    let certId: string | null = null;
    let isOfficialDbRegistered = false;
    let detailMessage = result.message;

    // Pencocokan ke Basis Data Resmi (Database Matching)
    if (result.isValid && result.metadata?.nomor) {
      try {
        const dbCert = await this.prisma.certificate.findUnique({
          where: { certificateNumber: result.metadata.nomor.trim() },
        });

        if (dbCert) {
          certId = dbCert.id;

          // Cek status pencabutan sertifikat
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
            // Pengikatan integritas visual kanvas (Item 2)
            if (dbCert.canvasHash) {
              const canvasMatches =
                dbCert.canvasHash.toLowerCase() === result.canvasHash?.toLowerCase();
              result.canvasHashMatch = canvasMatches;

              if (!canvasMatches) {
                result.isValid = false;
                result.status = 'MANIPULASI_TERDETEKSI';
                result.message =
                  'Peringatan: Integritas Citra Telah Rusak (Manipulasi visual kanvas terdeteksi)';
                detailMessage = 'Canvas hash tidak cocok dengan rekaman basis data resmi';
              } else {
                isOfficialDbRegistered = true;
                result.message =
                  'Sertifikat Asli & Terverifikasi (Integritas Terjaga - Terdaftar Resmi di Basis Data)';
                detailMessage = 'Terverifikasi cocok dengan rekaman basis data resmi';
              }
            } else {
              isOfficialDbRegistered = true;
              result.message =
                'Sertifikat Asli & Terverifikasi (Integritas Terjaga - Terdaftar Resmi di Basis Data)';
              detailMessage = 'Terverifikasi cocok dengan rekaman basis data resmi';
            }
          } else {
            result.isValid = false;
            result.status = 'MANIPULASI_TERDETEKSI';
            result.message =
              'Peringatan: Hash citra tidak sesuai dengan rekaman hash resmi di basis data universitas.';
            detailMessage = 'Hash mismatch dengan tabel Certificates';
          }
        } else {
          // Hash internal payload valid, namun nomor tidak tercatat di DB
          isOfficialDbRegistered = false;
          result.message =
            'Peringatan: Struktur dan hash internal valid, namun TIDAK TERDAFTAR di basis data resmi penerbit (indikasi sertifikat tiruan pihak luar).';
          detailMessage = 'Nomor sertifikat tidak ditemukan di basis data resmi';
        }
      } catch (err: any) {
        this.logger.warn(`Pengecekan basis data gagal: ${err.message}`);
        detailMessage = 'Basis data tidak dapat diakses untuk pencocokan';
      }
    }

    result.isOfficialDbRegistered = isOfficialDbRegistered;

    // Catat Jejak Audit ke VerificationLogs di PostgreSQL
    try {
      await this.prisma.verificationLog.create({
        data: {
          certificateId: certId,
          certificateNumber: result.metadata?.nomor || null,
          recipientName: result.metadata?.nama || null,
          ipAddress,
          verificationStatus: result.status as VerificationStatus,
          tVerifMs: result.executionTimeMs,
          message: result.message,
          detail: detailMessage,
          storedHash: result.storedHash || null,
          recomputedHash: result.recomputedHash || null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Gagal mencatat log verifikasi ke database: ${err.message}`);
    }

    return result;
  }

  // Filter Log Verifikasi
  async getLogs(query?: {
    status?: string;
    q?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<VerificationLog[]> {
    const where: any = {};

    if (query?.status) {
      where.verificationStatus = query.status as VerificationStatus;
    }

    if (query?.q) {
      const q = query.q.trim();
      where.OR = [
        { certificateNumber: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query?.startDate || query?.endDate) {
      where.verifiedAt = {};
      if (query?.startDate) {
        where.verifiedAt.gte = new Date(query.startDate);
      }
      if (query?.endDate) {
        where.verifiedAt.lte = new Date(query.endDate);
      }
    }

    const limit = query?.limit ? Number(query.limit) : 200;

    return this.prisma.verificationLog.findMany({
      where,
      orderBy: { verifiedAt: 'desc' },
      take: limit,
    });
  }

  // Ekspor CSV Log Verifikasi dengan perlindungan CSV Injection
  async exportLogsToCsv(): Promise<string> {
    const logs = await this.prisma.verificationLog.findMany({
      orderBy: { verifiedAt: 'desc' },
      take: 2000,
    });

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

    // Sanitasi sel CSV terhadap serangan CSV Injection (awali tanda ' jika dimulai =, +, -, @)
    const sanitizeCsvCell = (val: string | null | undefined): string => {
      if (!val) return '""';
      let clean = String(val);
      if (/^[=+\-@]/.test(clean)) {
        clean = `'${clean}`;
      }
      return `"${clean.replace(/"/g, '""')}"`;
    };

    const rows = logs.map((l) => {
      return [
        sanitizeCsvCell(l.id),
        sanitizeCsvCell(new Date(l.verifiedAt).toLocaleString('id-ID')),
        sanitizeCsvCell(l.ipAddress),
        sanitizeCsvCell(l.certificateNumber || '-'),
        sanitizeCsvCell(l.recipientName || '-'),
        sanitizeCsvCell(l.verificationStatus),
        sanitizeCsvCell(String(l.tVerifMs || 0)),
        sanitizeCsvCell(l.message),
        sanitizeCsvCell(l.detail || ''),
        sanitizeCsvCell(l.storedHash || '-'),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  async getStats() {
    try {
      const [total, valid, manipulated, invalidFormat, issuedCerts, totalEvents] =
        await Promise.all([
          this.prisma.verificationLog.count(),
          this.prisma.verificationLog.count({
            where: { verificationStatus: 'ASLI_VALID' },
          }),
          this.prisma.verificationLog.count({
            where: { verificationStatus: 'MANIPULASI_TERDETEKSI' },
          }),
          this.prisma.verificationLog.count({
            where: { verificationStatus: 'FORMAT_TIDAK_VALID' },
          }),
          this.prisma.certificate.count({
            where: { status: 'TERBIT' },
          }),
          this.prisma.event.count(),
        ]);

      return {
        totalVerifications: total,
        validCount: valid,
        manipulatedCount: manipulated,
        invalidFormatCount: invalidFormat,
        totalCertificatesIssued: issuedCerts,
        totalEvents,
      };
    } catch {
      return {
        totalVerifications: 0,
        validCount: 0,
        manipulatedCount: 0,
        invalidFormatCount: 0,
        totalCertificatesIssued: 0,
        totalEvents: 0,
      };
    }
  }
}
