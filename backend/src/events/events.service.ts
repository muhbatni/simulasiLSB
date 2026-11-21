import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Event, Certificate } from '@prisma/client';
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

    return events.map((evt) => ({
      ...evt,
      totalCertificates: evt._count.certificates,
    }));
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

    return {
      ...evt,
      totalCertificates: evt._count.certificates,
    };
  }

  async createEvent(
    data: CreateEventDto & { templateImagePath?: string; createdBy: string },
  ): Promise<Event> {
    const cleanDateOnly = (val: string) => String(val || '').split('T')[0].split(' ')[0].trim();

    return this.prisma.event.create({
      data: {
        eventName: data.eventName.trim(),
        eventDate: cleanDateOnly(data.eventDate),
        startTime: data.startTime ? data.startTime.trim() : null,
        endTime: data.endTime ? data.endTime.trim() : null,
        organizer: data.organizer.trim(),
        templateImagePath: data.templateImagePath,
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
        ...(data.templateImagePath !== undefined && { templateImagePath: data.templateImagePath }),
      },
    });
  }

  async deleteEvent(id: string): Promise<boolean> {
    const evt = await this.getEventById(id);

    // Hapus file template jika ada
    if (evt.templateImagePath) {
      const coversDir = path.join(process.cwd(), 'uploads', 'covers');
      const filePath = path.join(coversDir, evt.templateImagePath);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn(`Gagal menghapus file template: ${filePath}`, err);
        }
      }
    }

    // Bersihkan file stego dan cover sertifikat jika ada di disk
    const certs = await this.prisma.certificate.findMany({
      where: { eventId: id },
      select: { stegoImagePath: true, coverImagePath: true },
    });

    const certDir = path.join(process.cwd(), 'uploads', 'certificates');
    const coversDir = path.join(process.cwd(), 'uploads', 'covers');

    for (const cert of certs) {
      if (cert.stegoImagePath) {
        const p = path.join(certDir, cert.stegoImagePath);
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p);
          } catch {}
        }
      }
      if (cert.coverImagePath) {
        const p = path.join(coversDir, cert.coverImagePath);
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p);
          } catch {}
        }
      }
    }

    // Hapus seluruh sertifikat terkait event
    await this.prisma.certificate.deleteMany({
      where: { eventId: id },
    });

    // Hapus event
    await this.prisma.event.delete({
      where: { id },
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

  async addRecipient(eventId: string, dto: CreateRecipientDto): Promise<Certificate> {
    await this.getEventById(eventId);

    const name = dto.recipientName.trim();
    const identifier = dto.recipientIdentifier.trim();
    const role = dto.recipientRole?.trim() || 'Peserta';
    const certNum =
      dto.certificateNumber?.trim() ||
      `UINSA/FST/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

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
    await this.getEventById(eventId);

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
      firstLine.includes('nomor_sertifikat') ||
      firstLine.includes('nim')
    ) {
      hasHeader = true;
      const headers = parseCsvLine(firstLine).map((h) => h.toLowerCase());
      colCertNumIdx = headers.indexOf('nomor_sertifikat');
      colNameIdx = headers.indexOf('nama');
      colIdIdx = headers.indexOf('nim_email');
      if (colIdIdx === -1) colIdIdx = headers.indexOf('nim');
      colRoleIdx = headers.indexOf('peran');
      if (colNameIdx === -1 || colIdIdx === -1) {
        throw new BadRequestException(
          'Header CSV tidak valid. Wajib memiliki kolom: nama, nim_email (atau nim)',
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

    let rowNum = hasHeader ? 2 : 1;

    for (const line of dataLines) {
      const parts = parseCsvLine(line);
      const name = colNameIdx !== -1 ? parts[colNameIdx] || '' : parts[0] || '';
      const identifier = colIdIdx !== -1 ? parts[colIdIdx] || '' : parts[1] || '';
      const role = colRoleIdx !== -1 ? parts[colRoleIdx] || 'Peserta' : parts[2] || 'Peserta';
      let certNum =
        colCertNumIdx !== -1 && parts[colCertNumIdx]
          ? parts[colCertNumIdx]
          : `UINSA/FST/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

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
    return 'nomor_sertifikat,nama,nim_email,peran\nUINSA/FST/2026/001,Ahmad Fulan,09020623001,Peserta\nUINSA/FST/2026/002,Siti Nurhaliza,09020623002,Pemateri';
  }
}
