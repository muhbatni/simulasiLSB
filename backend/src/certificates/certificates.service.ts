import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
const archiver = require('archiver');
import { Response } from 'express';
import { DatabaseService, CertificateEntity } from '../database/database.service';
import { LsbSteganoService, CertificateMetadata, VerificationResult } from '../security/lsb-stego.service';
import { CertificateGeneratorService } from './certificate-generator.service';

export interface GenerateCertDto {
  eventId: string;
  recipientName: string;
  recipientIdentifier: string;
  recipientRole?: string;
  certificateNumber?: string;
  resolution?: '1080p' | '300dpi';
}

@Injectable()
export class CertificatesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly lsbService: LsbSteganoService,
    private readonly certGenerator: CertificateGeneratorService,
  ) {}

  getAllCertificates(): CertificateEntity[] {
    return this.db.certificates
      .filter((c) => c.status === 'TERBIT')
      .map((cert) => {
        const evt = this.db.events.find((e) => e.id === cert.eventId);
        return {
          ...cert,
          eventName: evt?.eventName || cert.eventName || 'Kegiatan Akademik',
          organizer: evt?.organizer || cert.organizer || 'FST UINSA',
        };
      });
  }

  getCertificateById(id: string): CertificateEntity {
    const cert = this.db.certificates.find((c) => c.id === id);
    if (!cert) throw new NotFoundException(`Sertifikat dengan ID ${id} tidak ditemukan`);
    const evt = this.db.events.find((e) => e.id === cert.eventId);
    return {
      ...cert,
      eventName: evt?.eventName || cert.eventName || 'Kegiatan Akademik',
      organizer: evt?.organizer || cert.organizer || 'FST UINSA',
    };
  }

  searchCertificates(query: string): CertificateEntity[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.db.certificates
      .filter(
        (c) =>
          c.status === 'TERBIT' &&
          (c.certificateNumber.toLowerCase().includes(q) ||
            c.recipientIdentifier.toLowerCase().includes(q) ||
            c.recipientName.toLowerCase().includes(q)),
      )
      .map((cert) => {
        const evt = this.db.events.find((e) => e.id === cert.eventId);
        return {
          ...cert,
          eventName: evt?.eventName || cert.eventName || 'Kegiatan Akademik',
          organizer: evt?.organizer || cert.organizer || 'FST UINSA',
        };
      });
  }

  // F-08: Portal Mahasiswa - Hanya sertifikat milik sendiri berdasarkan NIM
  getStudentCertificates(studentNim: string, query?: string): CertificateEntity[] {
    const nimLower = studentNim.trim().toLowerCase();
    const q = query ? query.trim().toLowerCase() : '';

    return this.db.certificates
      .filter((c) => {
        const isOwner = c.recipientIdentifier.toLowerCase() === nimLower;
        if (!isOwner) return false;
        if (c.status !== 'TERBIT') return false;
        if (q) {
          return (
            c.certificateNumber.toLowerCase().includes(q) ||
            c.recipientName.toLowerCase().includes(q) ||
            (c.eventName && c.eventName.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .map((cert) => {
        const evt = this.db.events.find((e) => e.id === cert.eventId);
        return {
          ...cert,
          eventName: evt?.eventName || cert.eventName || 'Kegiatan Akademik',
          organizer: evt?.organizer || cert.organizer || 'FST UINSA',
        };
      });
  }

  // F-08: Verifikasi berkas tersimpan mahasiswa
  async verifyStudentCertificate(
    certId: string,
    studentNim: string,
    isAdmin = false,
  ): Promise<VerificationResult> {
    const cert = this.db.certificates.find((c) => c.id === certId);
    if (!cert) throw new NotFoundException('Sertifikat tidak ditemukan');

    if (!isAdmin && cert.recipientIdentifier.toLowerCase() !== studentNim.toLowerCase()) {
      throw new ForbiddenException('Akses ditolak: sertifikat bukan milik akun Anda');
    }

    const filePath = this.getStegoFilePath(certId);
    const buffer = fs.readFileSync(filePath);
    return this.lsbService.extractAndVerify(buffer);
  }

  // F-06: Penerbitan Sertifikat Resmi (Penerbitan Satu atau Banyak dari Daftar Penerima)
  async issueCertificates(
    eventId: string,
    recipientIds?: string[],
    resolution: '1080p' | '300dpi' = '1080p',
  ): Promise<{
    totalProcessed: number;
    successCount: number;
    failedCount: number;
    results: Array<{ certificate: CertificateEntity; stats?: any; error?: string }>;
  }> {
    const event = this.db.events.find((e) => e.id === eventId);
    if (!event) throw new NotFoundException(`Event dengan ID ${eventId} tidak ditemukan`);

    let targetRecipients: CertificateEntity[] = [];
    if (recipientIds && recipientIds.length > 0) {
      targetRecipients = this.db.certificates.filter(
        (c) => c.eventId === eventId && recipientIds.includes(c.id),
      );
    } else {
      // Ambil seluruh calon penerima yang berstatus BELUM_TERBIT
      targetRecipients = this.db.certificates.filter(
        (c) => c.eventId === eventId && c.status === 'BELUM_TERBIT',
      );
    }

    if (targetRecipients.length === 0) {
      throw new BadRequestException('Tidak ada calon penerima yang ditemukan untuk diterbitkan');
    }

    const results: Array<{ certificate: CertificateEntity; stats?: any; error?: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const recipient of targetRecipients) {
      try {
        const certRes = await this.generateCertificateForRecipient(event, recipient, resolution);
        results.push({ certificate: certRes.certificate, stats: certRes.embedStats });
        successCount++;
      } catch (err: any) {
        console.error(`Gagal menerbitkan sertifikat ID ${recipient.id}:`, err);
        results.push({ certificate: recipient, error: err.message || 'Gagal embedding LSB' });
        failedCount++;
      }
    }

    this.db.saveData();
    return {
      totalProcessed: targetRecipients.length,
      successCount,
      failedCount,
      results,
    };
  }

  async generateCertificate(
    dto: GenerateCertDto,
    customCoverBuffer?: Buffer,
  ): Promise<{ certificate: CertificateEntity; embedStats: any }> {
    const event = this.db.events.find((e) => e.id === dto.eventId);
    if (!event) throw new NotFoundException(`Event dengan ID ${dto.eventId} tidak ditemukan`);

    const certId = `cert-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const certNumber =
      dto.certificateNumber ||
      `UINSA/FST/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
    const role = dto.recipientRole || 'Peserta';

    const tempRecipient: CertificateEntity = {
      id: certId,
      eventId: event.id,
      certificateNumber: certNumber,
      recipientName: dto.recipientName,
      recipientIdentifier: dto.recipientIdentifier,
      recipientRole: role,
      sha256Hash: '',
      status: 'BELUM_TERBIT',
      mse: 0,
      psnr: 0,
    };

    return this.generateCertificateForRecipient(
      event,
      tempRecipient,
      dto.resolution || '1080p',
      customCoverBuffer,
      true,
    );
  }

  private async generateCertificateForRecipient(
    event: any,
    recipient: CertificateEntity,
    resolution: '1080p' | '300dpi' = '1080p',
    customCoverBuffer?: Buffer,
    isNewRecord = false,
  ): Promise<{ certificate: CertificateEntity; embedStats: any }> {
    const width = resolution === '300dpi' ? 2480 : 1920;
    const height = resolution === '300dpi' ? 1754 : 1080;

    const designParams = {
      nomor: recipient.certificateNumber,
      nama: recipient.recipientName,
      peran: recipient.recipientRole,
      kegiatan: event.eventName,
      tanggal: event.eventDate,
      lembaga: event.organizer,
      width,
      height,
    };

    // Siapkan Citra Cover
    let coverBuffer: Buffer;

    if (customCoverBuffer) {
      coverBuffer = await this.certGenerator.overlayTextOnTemplate(customCoverBuffer, designParams);
    } else if (event.templateImagePath) {
      const templatePath = path.join(process.cwd(), 'uploads', 'covers', event.templateImagePath);
      if (fs.existsSync(templatePath)) {
        const rawTemplate = fs.readFileSync(templatePath);
        coverBuffer = await this.certGenerator.overlayTextOnTemplate(rawTemplate, designParams);
      } else {
        coverBuffer = await this.certGenerator.generateCertificateImage(designParams);
      }
    } else {
      coverBuffer = await this.certGenerator.generateCertificateImage(designParams);
    }

    // Persiapkan Metadata untuk Algoritma 3.1
    const metadata: CertificateMetadata = {
      nomor: recipient.certificateNumber,
      nama: recipient.recipientName,
      peran: recipient.recipientRole,
      kegiatan: event.eventName,
      tanggal: event.eventDate,
      lembaga: event.organizer,
    };

    // Eksekusi Algoritma 3.1: SHA-256 + LSB Embedding
    const embedResult = await this.lsbService.embedPayload(coverBuffer, metadata);

    // Simpan berkas citra stego PNG lossless
    const stegoDir = path.join(process.cwd(), 'uploads', 'stego');
    if (!fs.existsSync(stegoDir)) {
      fs.mkdirSync(stegoDir, { recursive: true });
    }
    const stegoFileName = `stego-${recipient.id}.png`;
    const stegoFilePath = path.join(stegoDir, stegoFileName);
    fs.writeFileSync(stegoFilePath, embedResult.stegoBuffer);

    // Mutasi entitas sertifikat
    recipient.sha256Hash = embedResult.sha256Hash;
    recipient.stegoImagePath = stegoFileName;
    recipient.mse = embedResult.mse;
    recipient.psnr = embedResult.psnr;
    recipient.tGenMs = embedResult.executionTimeMs;
    recipient.status = 'TERBIT';
    recipient.issuedAt = new Date().toISOString();
    recipient.eventName = event.eventName;
    recipient.organizer = event.organizer;

    if (isNewRecord) {
      this.db.certificates.unshift(recipient);
      this.db.saveData();
    }

    return {
      certificate: recipient,
      embedStats: {
        sha256Hash: embedResult.sha256Hash,
        payloadBitsCount: embedResult.payloadBitsCount,
        maxCapacityBits: embedResult.maxCapacityBits,
        capacityUsagePercentage: embedResult.capacityUsagePercentage,
        width: embedResult.width,
        height: embedResult.height,
        mse: embedResult.mse,
        psnr: embedResult.psnr,
        executionTimeMs: embedResult.executionTimeMs,
      },
    };
  }

  async bulkGenerateFromList(
    eventId: string,
    recipients: Array<{
      name: string;
      identifier: string;
      role?: string;
      certificateNumber?: string;
    }>,
  ): Promise<{ totalSuccess: number; totalFailed: number; items: CertificateEntity[] }> {
    const items: CertificateEntity[] = [];
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const r of recipients) {
      try {
        const res = await this.generateCertificate({
          eventId,
          recipientName: r.name,
          recipientIdentifier: r.identifier,
          recipientRole: r.role || 'Peserta',
          certificateNumber: r.certificateNumber,
        });
        items.push(res.certificate);
        totalSuccess++;
      } catch (err) {
        console.error('Gagal generate bulk item:', r, err);
        totalFailed++;
      }
    }

    return { totalSuccess, totalFailed, items };
  }

  getStegoFilePath(certId: string): string {
    const cert = this.db.certificates.find((c) => c.id === certId);
    if (!cert) throw new NotFoundException(`Sertifikat ${certId} tidak ditemukan`);
    if (!cert.stegoImagePath) {
      throw new NotFoundException(`Sertifikat ${certId} belum terbit`);
    }
    const filePath = path.join(process.cwd(), 'uploads', 'stego', cert.stegoImagePath);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Berkas stego fisik tidak ditemukan di storage peladen');
    }
    return filePath;
  }

  // F-07: Unduh ZIP Banyak Sertifikat Sekaligus (Store mode / zero compression)
  streamZipArchive(certificateIds: string[], res: Response) {
    if (!certificateIds || certificateIds.length === 0) {
      throw new BadRequestException('Daftar ID sertifikat tidak boleh kosong');
    }

    const archive = archiver('zip', {
      store: true, // Lossless murni tanpa re-kompresi agar bit LSB utuh (Spec F-07)
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="E-Sertifikat-Lossless-${Date.now()}.zip"`,
    );

    archive.pipe(res);

    for (const id of certificateIds) {
      const cert = this.db.certificates.find((c) => c.id === id);
      if (cert && cert.stegoImagePath) {
        const filePath = path.join(process.cwd(), 'uploads', 'stego', cert.stegoImagePath);
        if (fs.existsSync(filePath)) {
          const safeName = `Sertifikat-${cert.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${cert.certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
          archive.file(filePath, { name: safeName });
        }
      }
    }

    archive.finalize();
  }
}
