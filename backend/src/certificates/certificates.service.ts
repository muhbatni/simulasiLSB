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
import { PrismaService } from '../database/prisma.service';
import { Certificate, Event } from '@prisma/client';
import {
  LsbSteganoService,
  CertificateMetadata,
  VerificationResult,
} from '../security/lsb-stego.service';
import { CertificateGeneratorService } from './certificate-generator.service';
import { GenerateCertDto } from './dto/certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lsbService: LsbSteganoService,
    private readonly certGenerator: CertificateGeneratorService,
  ) {}

  async getAllCertificates(): Promise<any[]> {
    const certs = await this.prisma.certificate.findMany({
      where: { status: 'TERBIT' },
      include: { event: true },
      orderBy: { issuedAt: 'desc' },
    });

    return certs.map((c) => ({
      ...c,
      eventName: c.event?.eventName || 'Kegiatan Akademik',
      organizer: c.event?.organizer || 'FST UINSA',
    }));
  }

  async getCertificateById(id: string): Promise<any> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!cert) {
      throw new NotFoundException(`Sertifikat dengan ID ${id} tidak ditemukan`);
    }

    return {
      ...cert,
      eventName: cert.event?.eventName || 'Kegiatan Akademik',
      organizer: cert.event?.organizer || 'FST UINSA',
    };
  }

  async searchCertificates(query: string, studentFilter?: string): Promise<any[]> {
    const q = query.trim();
    const whereClause: any = {
      status: 'TERBIT',
    };

    if (studentFilter) {
      whereClause.recipientIdentifier = {
        equals: studentFilter.trim(),
        mode: 'insensitive',
      };
    }

    if (q) {
      whereClause.OR = [
        { certificateNumber: { contains: q, mode: 'insensitive' } },
        { recipientName: { contains: q, mode: 'insensitive' } },
        { recipientIdentifier: { contains: q, mode: 'insensitive' } },
      ];
    }

    const certs = await this.prisma.certificate.findMany({
      where: whereClause,
      include: { event: true },
      orderBy: { issuedAt: 'desc' },
    });

    return certs.map((c) => ({
      ...c,
      eventName: c.event?.eventName || 'Kegiatan Akademik',
      organizer: c.event?.organizer || 'FST UINSA',
    }));
  }

  // Portal Mahasiswa - Hanya sertifikat milik sendiri berdasarkan NIM
  async getStudentCertificates(studentNim: string, query?: string): Promise<any[]> {
    return this.searchCertificates(query || '', studentNim);
  }

  // Verifikasi berkas tersimpan mahasiswa
  async verifyStudentCertificate(
    certId: string,
    studentNim: string,
    isAdmin = false,
  ): Promise<VerificationResult> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certId },
    });
    if (!cert) {
      throw new NotFoundException('Sertifikat tidak ditemukan');
    }

    if (!isAdmin && cert.recipientIdentifier.toLowerCase() !== studentNim.toLowerCase()) {
      throw new ForbiddenException('Akses ditolak: sertifikat bukan milik akun Anda');
    }

    const filePath = this.getStegoFilePath(certId);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Berkas stego sertifikat tidak ditemukan di penyimpanan server');
    }

    const buffer = fs.readFileSync(filePath);
    return this.lsbService.extractAndVerify(buffer);
  }

  // Penerbitan Sertifikat Resmi dari Daftar Penerima
  async issueCertificates(
    eventId: string,
    recipientIds?: string[],
    resolution: '1080p' | '300dpi' = '1080p',
  ): Promise<{
    totalProcessed: number;
    successCount: number;
    failedCount: number;
    results: Array<{ certificate: Certificate; stats?: any; error?: string }>;
  }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event dengan ID ${eventId} tidak ditemukan`);
    }

    let targetRecipients: Certificate[] = [];
    if (recipientIds && recipientIds.length > 0) {
      targetRecipients = await this.prisma.certificate.findMany({
        where: {
          eventId,
          id: { in: recipientIds },
        },
      });
    } else {
      // Ambil seluruh calon penerima yang berstatus BELUM_TERBIT
      targetRecipients = await this.prisma.certificate.findMany({
        where: {
          eventId,
          status: 'BELUM_TERBIT',
        },
      });
    }

    if (targetRecipients.length === 0) {
      throw new BadRequestException('Tidak ada calon penerima yang ditemukan untuk diterbitkan');
    }

    const results: Array<{ certificate: Certificate; stats?: any; error?: string }> = [];
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
  ): Promise<{ certificate: Certificate; embedStats: any }> {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event dengan ID ${dto.eventId} tidak ditemukan`);
    }

    const certNumber =
      dto.certificateNumber ||
      `UINSA/FST/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
    const role = dto.recipientRole || 'Peserta';

    // Cek apakah sudah ada record dengan nomor sertifikat ini
    let recipient = await this.prisma.certificate.findUnique({
      where: { certificateNumber: certNumber },
    });

    if (!recipient) {
      recipient = await this.prisma.certificate.create({
        data: {
          eventId: event.id,
          certificateNumber: certNumber,
          recipientName: dto.recipientName,
          recipientIdentifier: dto.recipientIdentifier,
          recipientRole: role,
          sha256Hash: '',
          status: 'BELUM_TERBIT',
          mse: 0,
          psnr: 0,
        },
      });
    }

    return this.generateCertificateForRecipient(
      event,
      recipient,
      dto.resolution || '1080p',
      customCoverBuffer,
    );
  }

  private async generateCertificateForRecipient(
    event: Event,
    recipient: Certificate,
    resolution: '1080p' | '300dpi' = '1080p',
    customCoverBuffer?: Buffer,
  ): Promise<{ certificate: Certificate; embedStats: any }> {
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

    // Embedding LSB dan Pembangkitan Hash SHA-256 + Canvas Hash
    const metadata: CertificateMetadata = {
      nomor: recipient.certificateNumber,
      nama: recipient.recipientName,
      peran: recipient.recipientRole,
      kegiatan: event.eventName,
      tanggal: event.eventDate,
      lembaga: event.organizer,
    };

    const embedRes = await this.lsbService.embedPayload(coverBuffer, metadata);

    // Simpan berkas stego ke disk
    const stegoDir = path.join(process.cwd(), 'uploads', 'stego');
    if (!fs.existsSync(stegoDir)) {
      fs.mkdirSync(stegoDir, { recursive: true });
    }

    const stegoFileName = `${recipient.id}.png`;
    const stegoFilePath = path.join(stegoDir, stegoFileName);
    fs.writeFileSync(stegoFilePath, embedRes.stegoBuffer);

    // Simpan cover image ke disk
    const coversDir = path.join(process.cwd(), 'uploads', 'covers');
    if (!fs.existsSync(coversDir)) {
      fs.mkdirSync(coversDir, { recursive: true });
    }
    const coverFileName = `cover-${recipient.id}.png`;
    const coverFilePath = path.join(coversDir, coverFileName);
    fs.writeFileSync(coverFilePath, coverBuffer);

    // Perbarui entitas sertifikat di database
    const updatedCert = await this.prisma.certificate.update({
      where: { id: recipient.id },
      data: {
        sha256Hash: embedRes.sha256Hash,
        canvasHash: embedRes.canvasHash,
        stegoImagePath: stegoFileName,
        coverImagePath: coverFileName,
        status: 'TERBIT',
        mse: embedRes.mse,
        psnr: embedRes.psnr,
        tGenMs: embedRes.executionTimeMs,
        issuedAt: new Date(),
      },
    });

    return {
      certificate: updatedCert,
      embedStats: {
        sha256Hash: embedRes.sha256Hash,
        canvasHash: embedRes.canvasHash,
        mse: embedRes.mse,
        psnr: embedRes.psnr,
        payloadBitsCount: embedRes.payloadBitsCount,
        maxCapacityBits: embedRes.maxCapacityBits,
        capacityUsagePercentage: embedRes.capacityUsagePercentage,
        executionTimeMs: embedRes.executionTimeMs,
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
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    results: any[];
  }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event dengan ID ${eventId} tidak ditemukan`);
    }

    const results: any[] = [];
    let success = 0;
    let failed = 0;

    for (const r of recipients) {
      try {
        const certNum =
          r.certificateNumber ||
          `UINSA/FST/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

        let certRecord = await this.prisma.certificate.findUnique({
          where: { certificateNumber: certNum },
        });

        if (!certRecord) {
          certRecord = await this.prisma.certificate.create({
            data: {
              eventId,
              certificateNumber: certNum,
              recipientName: r.name,
              recipientIdentifier: r.identifier,
              recipientRole: r.role || 'Peserta',
              sha256Hash: '',
              status: 'BELUM_TERBIT',
              mse: 0,
              psnr: 0,
            },
          });
        }

        const genRes = await this.generateCertificateForRecipient(event, certRecord, '1080p');
        results.push({ certificate: genRes.certificate, stats: genRes.embedStats });
        success++;
      } catch (err: any) {
        console.error(`Gagal bulk generate untuk ${r.name}:`, err);
        results.push({ name: r.name, identifier: r.identifier, error: err.message });
        failed++;
      }
    }

    return {
      total: recipients.length,
      success,
      failed,
      results,
    };
  }

  // Unduh Koleksi Berkas (ZIP Archive) Mode Store Lossless
  async streamZipArchive(certificateIds: string[], res: Response) {
    if (!certificateIds || certificateIds.length === 0) {
      throw new BadRequestException('Daftar ID sertifikat tidak boleh kosong');
    }

    const certs = await this.prisma.certificate.findMany({
      where: {
        id: { in: certificateIds },
        status: 'TERBIT',
      },
    });

    if (certs.length === 0) {
      throw new NotFoundException('Tidak ada sertifikat terbit yang ditemukan');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="E-Sertifikat-UINSA-${Date.now()}.zip"`,
    );

    const archive = archiver('zip', {
      store: true, // Lossless store tanpa re-kompresi DEFLATE
    });

    archive.on('error', (err: any) => {
      console.error('Error saat membuat ZIP:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: 'Gagal membuat arsip ZIP sertifikat' });
      }
    });

    archive.pipe(res);

    for (const cert of certs) {
      try {
        const filePath = this.getStegoFilePath(cert.id);
        if (fs.existsSync(filePath)) {
          const safeName = `Sertifikat-${cert.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${cert.certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
          archive.file(filePath, { name: safeName });
        }
      } catch (err) {
        console.warn(`Melewati berkas sertifikat ${cert.id}:`, err);
      }
    }

    await archive.finalize();
  }

  /**
   * Menemukan berkas stego PNG di storage server dengan sanitasi path traversal
   */
  getStegoFilePath(certId: string): string {
    // Sanitasi certId: hanya izinkan karakter alfanumerik, dash, dan underscore
    if (!/^[a-zA-Z0-9_-]+$/.test(certId)) {
      throw new BadRequestException('ID sertifikat tidak valid');
    }

    const primaryPath = path.join(process.cwd(), 'uploads', 'stego', `${certId}.png`);
    if (fs.existsSync(primaryPath)) {
      return primaryPath;
    }

    // Fallback pencarian alternatif jika nama stegoImagePath custom
    const fallbackDir = path.join(process.cwd(), 'uploads', 'stego');
    const resolvedPath = path.resolve(primaryPath);
    if (!resolvedPath.startsWith(path.resolve(fallbackDir))) {
      throw new ForbiddenException('Akses direktori di luar batas diizinkan (Path Traversal)');
    }

    return primaryPath;
  }
}
