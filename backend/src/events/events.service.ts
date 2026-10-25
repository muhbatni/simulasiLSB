import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService, EventEntity, CertificateEntity } from '../database/database.service';

export interface CreateRecipientDto {
  certificateNumber?: string;
  recipientName: string;
  recipientIdentifier: string;
  recipientRole?: string;
}

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
  constructor(private readonly db: DatabaseService) {}

  getAllEvents(): EventEntity[] {
    return this.db.events.map((evt) => {
      const count = this.db.certificates.filter(
        (c) => c.eventId === evt.id && c.status === 'TERBIT',
      ).length;
      return { ...evt, totalCertificates: count };
    });
  }

  getEventById(id: string): EventEntity {
    const evt = this.db.events.find((e) => e.id === id);
    if (!evt) throw new NotFoundException(`Event dengan ID ${id} tidak ditemukan`);
    const count = this.db.certificates.filter(
      (c) => c.eventId === evt.id && c.status === 'TERBIT',
    ).length;
    return { ...evt, totalCertificates: count };
  }

  createEvent(data: {
    eventName: string;
    eventDate: string;
    organizer: string;
    templateImagePath?: string;
    createdBy: string;
  }): EventEntity {
    if (!data.eventName || !data.eventDate || !data.organizer) {
      throw new BadRequestException('Nama event, tanggal pelaksanaan, dan penyelenggara wajib diisi');
    }

    const newEvent: EventEntity = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eventName: data.eventName.trim(),
      eventDate: data.eventDate.trim(),
      organizer: data.organizer.trim(),
      templateImagePath: data.templateImagePath,
      isActive: true,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
    };

    this.db.events.unshift(newEvent);
    this.db.saveData();
    return newEvent;
  }

  updateEvent(
    id: string,
    data: {
      eventName?: string;
      eventDate?: string;
      organizer?: string;
      isActive?: boolean;
    },
  ): EventEntity {
    const evt = this.db.events.find((e) => e.id === id);
    if (!evt) throw new NotFoundException(`Event dengan ID ${id} tidak ditemukan`);

    if (data.eventName !== undefined) evt.eventName = data.eventName.trim();
    if (data.eventDate !== undefined) evt.eventDate = data.eventDate.trim();
    if (data.organizer !== undefined) evt.organizer = data.organizer.trim();
    if (data.isActive !== undefined) evt.isActive = data.isActive;

    this.db.saveData();
    return evt;
  }

  deleteEvent(id: string): boolean {
    const idx = this.db.events.findIndex((e) => e.id === id);
    if (idx === -1) throw new NotFoundException(`Event dengan ID ${id} tidak ditemukan`);

    // F-03: Event yang sudah memiliki sertifikat terbit tidak boleh dihapus, hanya dinonaktifkan
    const issuedCerts = this.db.certificates.filter(
      (c) => c.eventId === id && c.status === 'TERBIT',
    );
    if (issuedCerts.length > 0) {
      throw new BadRequestException(
        `Event yang sudah memiliki sertifikat terbit (${issuedCerts.length} berkas) tidak dapat dihapus, hanya dapat dinonaktifkan.`,
      );
    }

    // Hapus juga calon penerima yang belum terbit
    this.db.certificates = this.db.certificates.filter((c) => c.eventId !== id);
    this.db.events.splice(idx, 1);
    this.db.saveData();
    return true;
  }

  // F-04: Kelola Penerima Event
  getEventRecipients(eventId: string): CertificateEntity[] {
    const evt = this.db.events.find((e) => e.id === eventId);
    if (!evt) throw new NotFoundException(`Event dengan ID ${eventId} tidak ditemukan`);
    return this.db.certificates.filter((c) => c.eventId === eventId);
  }

  addRecipient(eventId: string, dto: CreateRecipientDto): CertificateEntity {
    const evt = this.db.events.find((e) => e.id === eventId);
    if (!evt) throw new NotFoundException(`Event dengan ID ${eventId} tidak ditemukan`);

    const name = dto.recipientName ? dto.recipientName.trim() : '';
    const identifier = dto.recipientIdentifier ? dto.recipientIdentifier.trim() : '';
    const role = dto.recipientRole ? dto.recipientRole.trim() : 'Peserta';

    if (!name || !identifier) {
      throw new BadRequestException('Nama penerima dan NIM/Identifikasi wajib diisi');
    }

    if (name.length > 100) {
      throw new BadRequestException('Nama penerima maksimal 100 karakter');
    }
    if (role.length > 30) {
      throw new BadRequestException('Peran penerima maksimal 30 karakter');
    }

    const certNum =
      dto.certificateNumber?.trim() ||
      `UINSA/FST/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

    // Cek keunikan nomor sertifikat
    const existing = this.db.certificates.find(
      (c) => c.certificateNumber.toLowerCase() === certNum.toLowerCase(),
    );
    if (existing) {
      throw new BadRequestException(`Nomor sertifikat '${certNum}' sudah digunakan`);
    }

    const newRecipient: CertificateEntity = {
      id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eventId,
      certificateNumber: certNum,
      recipientName: name,
      recipientIdentifier: identifier,
      recipientRole: role,
      sha256Hash: '',
      status: 'BELUM_TERBIT',
      mse: 0,
      psnr: 0,
      eventName: evt.eventName,
      organizer: evt.organizer,
    };

    this.db.certificates.push(newRecipient);
    this.db.saveData();
    return newRecipient;
  }

  // F-05: Impor Massal CSV Penerima
  processCsvImport(
    eventId: string,
    csvContent: string,
    executeImport = false,
  ): {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    rows: CsvImportRow[];
    importedItems?: CertificateEntity[];
  } {
    const evt = this.db.events.find((e) => e.id === eventId);
    if (!evt) throw new NotFoundException(`Event dengan ID ${eventId} tidak ditemukan`);

    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      throw new BadRequestException('Berkas CSV kosong');
    }

    // Maksimum 500 baris per berkas (spec F-05)
    if (lines.length > 501) {
      throw new BadRequestException('Maksimum 500 baris per berkas CSV');
    }

    // Periksa header
    const firstLine = lines[0].toLowerCase();
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
      const headers = firstLine.split(',').map((h) => h.trim());
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
    const usedCertNumbers = new Set(
      this.db.certificates.map((c) => c.certificateNumber.toLowerCase()),
    );

    let rowNum = hasHeader ? 2 : 1;

    for (const line of dataLines) {
      const parts = line.split(',').map((p) => p.trim());
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
      } else if (name.length > 100) {
        isValid = false;
        errorMessage = 'Nama melebihi 100 karakter';
      } else if (!identifier) {
        isValid = false;
        errorMessage = 'NIM/Identifier tidak boleh kosong';
      } else if (usedCertNumbers.has(certNum.toLowerCase())) {
        isValid = false;
        errorMessage = `Nomor sertifikat '${certNum}' duplikat di basis data`;
      } else {
        usedCertNumbers.add(certNum.toLowerCase());
      }

      parsedRows.push({
        rowNumber: rowNum++,
        certificateNumber: certNum,
        recipientName: name,
        recipientIdentifier: identifier,
        recipientRole: role,
        isValid,
        errorMessage: errorMessage || undefined,
      });
    }

    const validRows = parsedRows.filter((r) => r.isValid);
    const invalidRows = parsedRows.filter((r) => !r.isValid);

    const importedItems: CertificateEntity[] = [];

    if (executeImport && validRows.length > 0) {
      for (const row of validRows) {
        const item: CertificateEntity = {
          id: `rec-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          eventId,
          certificateNumber: row.certificateNumber,
          recipientName: row.recipientName,
          recipientIdentifier: row.recipientIdentifier,
          recipientRole: row.recipientRole || 'Peserta',
          sha256Hash: '',
          status: 'BELUM_TERBIT',
          mse: 0,
          psnr: 0,
          eventName: evt.eventName,
          organizer: evt.organizer,
        };
        this.db.certificates.push(item);
        importedItems.push(item);
      }
      this.db.saveData();
    }

    return {
      totalRows: parsedRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      rows: parsedRows,
      importedItems: executeImport ? importedItems : undefined,
    };
  }

  getCsvTemplate(): string {
    return 'nomor_sertifikat,nama,nim_email,peran\nUINSA/FST/2026/001,Ahmad Fulan,09020623041,Peserta\nUINSA/FST/2026/002,Siti Nurhaliza,09020623088,Pemateri\n';
  }
}
