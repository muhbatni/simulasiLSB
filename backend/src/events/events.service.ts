import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Event, Certificate } from '@prisma/client';
import { CreateEventDto, UpdateEventDto, CreateRecipientDto } from './dto/event.dto';
import * as fs from 'fs';
import * as path from 'path';

export interface CsvImportRow {
  rowNumber: number;
  certificateNumber: string;
  recipientName: string;
  recipientIdentifier: string;
  recipientRole: string;
  isValid: boolean;
  errorMessage?: string;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllEvents(): Promise<any[]> {
    const events = await this.prisma.event.findMany({
      include: {
        _count: {
          select: {
            certificates: {
              where: { status: 'TERBIT' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      events.map(async (evt) => {
        const nextCertificateNumber = await this.getNextCertificateNumber(evt.id);
        return {
          ...evt,
          totalCertificates: evt._count.certificates,
          nextCertificateNumber,
        };
      }),
    );
  }

  async getEventById(id: string): Promise<any> {
    const evt = await this.prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            certificates: {
              where: { status: 'TERBIT' },
            },
          },
        },
      },
    });

    if (!evt) {
      throw new NotFoundException(`Event dengan ID ${id} tidak ditemukan`);
    }

    const nextCertificateNumber = await this.getNextCertificateNumber(evt.id);

    return {
      ...evt,
      totalCertificates: evt._count.certificates,
      nextCertificateNumber,
    };
  }

  async createEvent(
    data: CreateEventDto & { templateImagePath?: string; createdBy: string },
  ): Promise<Event> {
    const cleanDateOnly = (val: string) => String(val || '').split('T')[0].split(' ')[0].trim();
    const certPrefix = (data.certificatePrefix || '041/HIMAPROSIF/XI/2026/').trim();
    if (!certPrefix.endsWith('/')) {
      throw new BadRequestException(
        "Format nomor sertifikat harus diakhiri dengan tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)",
      );
    }

    let positions = null;
    if (data.templatePositions) {
      positions = typeof data.templatePositions === 'string'
        ? JSON.parse(data.templatePositions)
        : data.templatePositions;
    }

    return this.prisma.event.create({
      data: {
        eventName: data.eventName.trim(),
        eventDate: cleanDateOnly(data.eventDate),
        startTime: data.startTime ? data.startTime.trim() : null,
        endTime: data.endTime ? data.endTime.trim() : null,
        organizer: data.organizer.trim(),
        certificatePrefix: certPrefix,
        templateImagePath: data.templateImagePath,
        templatePositions: positions,
        createdBy: data.createdBy,
      },
    });
  }

  async updateEvent(
    id: string,
    data: UpdateEventDto & { templateImagePath?: string },
  ): Promise<Event> {
    const existing = await this.getEventById(id);
    const cleanDateOnly = (val: string) => String(val || '').split('T')[0].split(' ')[0].trim();

    if (data.certificatePrefix !== undefined) {
      const pfx = (data.certificatePrefix || '').trim();
      if (!pfx.endsWith('/')) {
        throw new BadRequestException(
          "Format nomor sertifikat harus diakhiri dengan tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)",
        );
      }
    }

    let parsedPositions = undefined;
    if (data.templatePositions !== undefined) {
      if (data.templatePositions === null) {
        parsedPositions = null;
      } else {
        parsedPositions = typeof data.templatePositions === 'string'
          ? JSON.parse(data.templatePositions)
          : data.templatePositions;
      }
    }

    // Jika template baru diunggah dan template lama ada, hapus file template lama
    if (data.templateImagePath && existing.templateImagePath) {
      const coversDir = path.join(process.cwd(), 'uploads', 'covers');
      const oldPath = path.join(coversDir, existing.templateImagePath);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.warn(`Gagal menghapus file template lama: ${oldPath}`, err);
        }
      }
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        ...(data.eventName !== undefined && { eventName: data.eventName.trim() }),
        ...(data.eventDate !== undefined && { eventDate: cleanDateOnly(data.eventDate) }),
        ...(data.startTime !== undefined && { startTime: data.startTime ? data.startTime.trim() : null }),
        ...(data.endTime !== undefined && { endTime: data.endTime ? data.endTime.trim() : null }),
        ...(data.organizer !== undefined && { organizer: data.organizer.trim() }),
        ...(data.certificatePrefix !== undefined && { certificatePrefix: data.certificatePrefix.trim() }),
        ...(data.templateImagePath !== undefined && { templateImagePath: data.templateImagePath }),
        ...(parsedPositions !== undefined && { templatePositions: parsedPositions }),
      },
    });
  }

  async updateTemplatePositions(id: string, positions: any): Promise<Event> {
    await this.getEventById(id);
    const parsed = typeof positions === 'string' ? JSON.parse(positions) : positions;
    return this.prisma.event.update({
      where: { id },
      data: {
        templatePositions: parsed,
      },
    });
  }

  private removeFileIfExists(filePath: string) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn(`Gagal menghapus berkas ${filePath}:`, err);
    }
  }

  private cleanCertificateFiles(cert: { id: string; stegoImagePath?: string | null; coverImagePath?: string | null }) {
    const stegoDir = path.join(process.cwd(), 'uploads', 'stego');
    const coversDir = path.join(process.cwd(), 'uploads', 'covers');
    const certDir = path.join(process.cwd(), 'uploads', 'certificates');

    // Hapus berkas stego PNG (berkas unduhan sertifikat)
    this.removeFileIfExists(path.join(stegoDir, `${cert.id}.png`));
    if (cert.stegoImagePath) {
      this.removeFileIfExists(path.join(stegoDir, cert.stegoImagePath));
      this.removeFileIfExists(path.join(certDir, cert.stegoImagePath));
    }
    this.removeFileIfExists(path.join(certDir, `${cert.id}.png`));

    // Hapus berkas cover PNG
    this.removeFileIfExists(path.join(coversDir, `cover-${cert.id}.png`));
    if (cert.coverImagePath) {
      this.removeFileIfExists(path.join(coversDir, cert.coverImagePath));
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    const evt = await this.getEventById(id);

    // Hapus file template jika ada
    if (evt.templateImagePath) {
      const coversDir = path.join(process.cwd(), 'uploads', 'covers');
      this.removeFileIfExists(path.join(coversDir, evt.templateImagePath));
    }

    // Ambil seluruh sertifikat dan data penerima terkait event ini
    const certs = await this.prisma.certificate.findMany({
      where: { eventId: id },
      select: { id: true, certificateNumber: true, stegoImagePath: true, coverImagePath: true },
    });

    // Bersihkan seluruh berkas stego (berkas unduhan) dan cover sertifikat dari disk
    for (const cert of certs) {
      this.cleanCertificateFiles(cert);
    }

    // Bersihkan seluruh log verifikasi terkait sertifikat-sertifikat ini
    const certIds = certs.map((c) => c.id);
    const certNumbers = certs.map((c) => c.certificateNumber).filter(Boolean);
    if (certIds.length > 0 || certNumbers.length > 0) {
      await this.prisma.verificationLog.deleteMany({
        where: {
          OR: [
            { certificateId: { in: certIds } },
            { certificateNumber: { in: certNumbers } },
          ],
        },
      });
    }

    // Hapus seluruh sertifikat/penerima terkait event dari basis data
    await this.prisma.certificate.deleteMany({
      where: { eventId: id },
    });

    // Hapus record event dari basis data
    await this.prisma.event.delete({
      where: { id },
    });

    return true;
  }

  async deleteRecipient(eventId: string, recipientId: string): Promise<boolean> {
    const cert = await this.prisma.certificate.findFirst({
      where: { id: recipientId, eventId },
    });
    if (!cert) {
      throw new NotFoundException('Data penerima sertifikat tidak ditemukan');
    }

    // Bersihkan berkas stego dan cover di disk
    this.cleanCertificateFiles(cert);

    // Hapus log verifikasi terkait
    await this.prisma.verificationLog.deleteMany({
      where: {
        OR: [
          { certificateId: cert.id },
          { certificateNumber: cert.certificateNumber },
        ],
      },
    });

    // Hapus data sertifikat penerima dari basis data
    await this.prisma.certificate.delete({
      where: { id: cert.id },
    });

    return true;
  }

  async getEventRecipients(eventId: string): Promise<Certificate[]> {
    await this.getEventById(eventId);
    return this.prisma.certificate.findMany({
      where: { eventId },
      orderBy: { recipientName: 'asc' },
    });
  }

  async getNextCertificateNumber(eventId: string, customPrefix?: string): Promise<string> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    let prefix = customPrefix || event?.certificatePrefix || '041/HIMAPROSIF/XI/2026/';
    if (!prefix.endsWith('/')) {
      prefix += '/';
    }

    const count = await this.prisma.certificate.count({
      where: { eventId },
    });

    let seq = count + 1;
    let candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    while (await this.prisma.certificate.findUnique({ where: { certificateNumber: candidate } })) {
      seq++;
      candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    }
    return candidate;
  }

  async addRecipient(eventId: string, dto: CreateRecipientDto): Promise<Certificate> {
    const event = await this.getEventById(eventId);
    let eventPrefix = (event.certificatePrefix || '041/HIMAPROSIF/XI/2026/').trim();
    if (!eventPrefix.endsWith('/')) {
      eventPrefix += '/';
    }

    const name = dto.recipientName.trim();
    const identifier = dto.recipientIdentifier.trim();
    const role = dto.recipientRole?.trim() || 'Peserta';
    
    let certNum = dto.certificateNumber?.trim();
    if (!certNum) {
      certNum = await this.getNextCertificateNumber(eventId);
    } else if (certNum.endsWith('/')) {
      certNum = await this.getNextCertificateNumber(eventId, certNum);
    }

    const existing = await this.prisma.certificate.findUnique({
      where: { certificateNumber: certNum },
    });
    if (existing) {
      throw new BadRequestException(`Nomor sertifikat '${certNum}' sudah digunakan`);
    }

    return this.prisma.certificate.create({
      data: {
        eventId,
        certificateNumber: certNum,
        recipientName: name,
        recipientIdentifier: identifier,
        recipientRole: role,
        sha256Hash: '',
        status: 'BELUM_TERBIT',
        mse: 0,
        psnr: 0,
      },
    });
  }

  async processCsvImport(
    eventId: string,
    csvContent: string,
    executeImport = false,
  ): Promise<{
    totalRows: number;
    validCount: number;
    invalidCount: number;
    rows: CsvImportRow[];
    importedItems?: Certificate[];
  }> {
    const event = await this.getEventById(eventId);
    let eventPrefix = (event.certificatePrefix || '041/HIMAPROSIF/XI/2026/').trim();
    if (!eventPrefix.endsWith('/')) {
      eventPrefix += '/';
    }

    // Bersihkan UTF-8 BOM jika ada
    const cleanContent = csvContent.replace(/^\uFEFF/, '');
    const lines = cleanContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new BadRequestException('Berkas CSV kosong');
    }

    if (lines.length > 501) {
      throw new BadRequestException('Maksimum 500 baris per berkas CSV');
    }

    // Deteksi separator (koma atau titik koma)
    const firstLine = lines[0].toLowerCase();
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const parseCsvLine = (line: string): string[] => {
      // Regex parsing CSV yang mendukung kutip ganda
      const pattern = new RegExp(
        `(?:^|${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}]*))`,
        'g',
      );
      const matches: string[] = [];
      let match;
      while ((match = pattern.exec(line)) !== null) {
        let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
        matches.push((val || '').trim());
      }
      return matches;
    };

    let hasHeader = false;
    let colCertNumIdx = -1;
    let colNameIdx = 0;
    let colIdIdx = 1;
    let colRoleIdx = 2;

    if (
      firstLine.includes('nama') ||
      firstLine.includes('nim') ||
      firstLine.includes('peran') ||
      firstLine.includes('nomor')
    ) {
      hasHeader = true;
      const headers = parseCsvLine(firstLine).map((h) =>
        h.toLowerCase().trim().replace(/^["']|["']$/g, ''),
      );
      colCertNumIdx = headers.findIndex(
        (h) => h === 'nomor_sertifikat' || h === 'no_sertifikat' || h === 'nomor' || h === 'no',
      );
      colNameIdx = headers.findIndex(
        (h) => h === 'nama' || h === 'nama_lengkap' || h === 'name' || h === 'nama penerima',
      );
      colIdIdx = headers.findIndex(
        (h) => h === 'nim' || h === 'nim_email' || h === 'nim/email' || h === 'identifier' || h === 'nim / id',
      );
      colRoleIdx = headers.findIndex(
        (h) => h === 'peran' || h === 'role' || h === 'sebagai',
      );
      if (colNameIdx === -1 || colIdIdx === -1) {
        throw new BadRequestException(
          'Header CSV tidak valid. Wajib memiliki kolom: nama, nim (contoh: nama,nim,peran)',
        );
      }
    }

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const parsedRows: CsvImportRow[] = [];

    const existingCerts = await this.prisma.certificate.findMany({
      select: { certificateNumber: true },
    });
    const usedCertNumbers = new Set(
      existingCerts.map((c) => c.certificateNumber.toLowerCase()),
    );

    const eventCertCount = await this.prisma.certificate.count({
      where: { eventId },
    });
    let seqCounter = eventCertCount + 1;

    let rowNum = hasHeader ? 2 : 1;

    for (const line of dataLines) {
      const parts = parseCsvLine(line);
      const name = colNameIdx !== -1 ? parts[colNameIdx] || '' : parts[0] || '';
      const identifier = colIdIdx !== -1 ? parts[colIdIdx] || '' : parts[1] || '';
      const role = colRoleIdx !== -1 ? parts[colRoleIdx] || 'Peserta' : parts[2] || 'Peserta';
      let rawCertNum = colCertNumIdx !== -1 && parts[colCertNumIdx] ? parts[colCertNumIdx].trim() : '';
      let certNum = '';

      if (!rawCertNum) {
        let candidate = `${eventPrefix}${String(seqCounter).padStart(3, '0')}`;
        while (usedCertNumbers.has(candidate.toLowerCase())) {
          seqCounter++;
          candidate = `${eventPrefix}${String(seqCounter).padStart(3, '0')}`;
        }
        certNum = candidate;
        seqCounter++;
      } else if (rawCertNum.endsWith('/')) {
        let candidate = `${rawCertNum}${String(seqCounter).padStart(3, '0')}`;
        while (usedCertNumbers.has(candidate.toLowerCase())) {
          seqCounter++;
          candidate = `${rawCertNum}${String(seqCounter).padStart(3, '0')}`;
        }
        certNum = candidate;
        seqCounter++;
      } else {
        certNum = rawCertNum;
      }

      let isValid = true;
      let errorMessage = '';

      if (!name) {
        isValid = false;
        errorMessage = 'Nama penerima tidak boleh kosong';
      } else if (!identifier) {
        isValid = false;
        errorMessage = 'NIM/Identitas tidak boleh kosong';
      } else if (name.length > 100) {
        isValid = false;
        errorMessage = 'Nama melebihi 100 karakter';
      } else if (usedCertNumbers.has(certNum.toLowerCase())) {
        isValid = false;
        errorMessage = `Nomor sertifikat '${certNum}' duplikat di sistem`;
      }

      if (isValid) {
        usedCertNumbers.add(certNum.toLowerCase());
      }

      parsedRows.push({
        rowNumber: rowNum++,
        certificateNumber: certNum,
        recipientName: name,
        recipientIdentifier: identifier,
        recipientRole: role || 'Peserta',
        isValid,
        errorMessage: errorMessage || undefined,
      });
    }

    const validRows = parsedRows.filter((r) => r.isValid);
    let importedItems: Certificate[] | undefined = undefined;

    if (executeImport && validRows.length > 0) {
      importedItems = await this.prisma.$transaction(
        validRows.map((r) =>
          this.prisma.certificate.create({
            data: {
              eventId,
              certificateNumber: r.certificateNumber,
              recipientName: r.recipientName,
              recipientIdentifier: r.recipientIdentifier,
              recipientRole: r.recipientRole,
              sha256Hash: '',
              status: 'BELUM_TERBIT',
              mse: 0,
              psnr: 0,
            },
          }),
        ),
      );
    }

    return {
      totalRows: parsedRows.length,
      validCount: validRows.length,
      invalidCount: parsedRows.length - validRows.length,
      rows: parsedRows,
      importedItems,
    };
  }

  getCsvTemplate(): string {
    return 'nama,nim,peran\nAhmad Fulan,09020623001,Peserta\nSiti Nurhaliza,09020623002,Pemateri\nRaihan Maulana,09020623003,Panitia';
  }
}
