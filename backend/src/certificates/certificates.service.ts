import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService, CertificateEntity } from '../database/database.service';
import { LsbSteganoService, CertificateMetadata } from '../security/lsb-stego.service';
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
    return this.db.certificates.map((cert) => {
      const evt = this.db.events.find((e) => e.id === cert.eventId);
      return {
        ...cert,
        eventName: evt?.eventName || 'Kegiatan Akademik',
        organizer: evt?.organizer || 'FST UINSA',
      };
    });
  }

  getCertificateById(id: string): CertificateEntity {
    const cert = this.db.certificates.find((c) => c.id === id);
    if (!cert) throw new NotFoundException(`Sertifikat dengan ID ${id} tidak ditemukan`);
    const evt = this.db.events.find((e) => e.id === cert.eventId);
    return {
      ...cert,
      eventName: evt?.eventName || 'Kegiatan Akademik',
      organizer: evt?.organizer || 'FST UINSA',
    };
  }

  searchCertificates(query: string): CertificateEntity[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.db.certificates
      .filter(
        (c) =>
          c.certificateNumber.toLowerCase().includes(q) ||
          c.recipientIdentifier.toLowerCase().includes(q) ||
          c.recipientName.toLowerCase().includes(q),
      )
      .map((cert) => {
        const evt = this.db.events.find((e) => e.id === cert.eventId);
        return {
          ...cert,
          eventName: evt?.eventName || 'Kegiatan Akademik',
          organizer: evt?.organizer || 'FST UINSA',
        };
      });
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

    // Persiapkan Citra Cover
    let coverBuffer: Buffer;

    if (customCoverBuffer) {
      coverBuffer = customCoverBuffer;
    } else if (event.templateImagePath) {
      const templatePath = path.join(process.cwd(), 'uploads', 'covers', event.templateImagePath);
      if (fs.existsSync(templatePath)) {
        coverBuffer = fs.readFileSync(templatePath);
      } else {
        coverBuffer = await this.renderDefaultCover(dto, event, certNumber, role);
      }
    } else {
      coverBuffer = await this.renderDefaultCover(dto, event, certNumber, role);
    }

    // Persiapkan Metadata untuk Algoritma 3.1
    const metadata: CertificateMetadata = {
      nomor: certNumber,
      nama: dto.recipientName,
      peran: role,
      kegiatan: event.eventName,
      tanggal: event.eventDate,
      lembaga: event.organizer,
    };

    // Eksekusi Algoritma 3.1: Hash SHA-256 dan Embedding LSB
    const embedResult = await this.lsbService.embedPayload(coverBuffer, metadata);

    // Simpan berkas citra stego ke disk storage
    const stegoFileName = `stego-${certId}.png`;
    const stegoFilePath = path.join(process.cwd(), 'uploads', 'stego', stegoFileName);
    fs.writeFileSync(stegoFilePath, embedResult.stegoBuffer);

    // Simpan data rekaman sertifikat ke basis data
    const newCert: CertificateEntity = {
      id: certId,
      eventId: event.id,
      certificateNumber: certNumber,
      recipientName: dto.recipientName,
      recipientIdentifier: dto.recipientIdentifier,
      recipientRole: role,
      sha256Hash: embedResult.sha256Hash,
      stegoImagePath: stegoFileName,
      mse: embedResult.mse,
      psnr: embedResult.psnr,
      issuedAt: new Date().toISOString(),
      eventName: event.eventName,
      organizer: event.organizer,
    };

    this.db.certificates.unshift(newCert);
    this.db.saveData();

    return {
      certificate: newCert,
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
    const filePath = path.join(process.cwd(), 'uploads', 'stego', cert.stegoImagePath);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Berkas stego fisik tidak ditemukan di peladen');
    }
    return filePath;
  }

  private async renderDefaultCover(
    dto: GenerateCertDto,
    event: any,
    certNumber: string,
    role: string,
  ): Promise<Buffer> {
    const width = dto.resolution === '300dpi' ? 2480 : 1920;
    const height = dto.resolution === '300dpi' ? 1754 : 1080;

    return this.certGenerator.generateCertificateImage({
      nomor: certNumber,
      nama: dto.recipientName,
      peran: role,
      kegiatan: event.eventName,
      tanggal: event.eventDate,
      lembaga: event.organizer,
      width,
      height,
    });
  }
}
