import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'mahasiswa';
  createdAt: string;
}

export interface EventEntity {
  id: string;
  eventName: string;
  eventDate: string;
  organizer: string;
  templateImagePath?: string;
  createdBy: string;
  createdAt: string;
  totalCertificates?: number;
}

export interface CertificateEntity {
  id: string;
  eventId: string;
  certificateNumber: string;
  recipientName: string;
  recipientIdentifier: string; // NIM atau Email
  recipientRole: string; // Peserta, Pemateri, Panitia
  sha256Hash: string;
  stegoImagePath: string;
  coverImagePath?: string;
  mse: number;
  psnr: number;
  issuedAt: string;
  eventName?: string;
  organizer?: string;
}

export interface VerificationLog {
  id: string;
  certificateId?: string;
  certificateNumber?: string;
  recipientName?: string;
  ipAddress: string;
  verificationStatus: 'ASLI_VALID' | 'MANIPULASI_TERDETEKSI' | 'FORMAT_TIDAK_VALID';
  verifiedAt: string;
  message: string;
  storedHash?: string;
  recomputedHash?: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private dataDir = path.join(process.cwd(), 'data');
  private dbFile = path.join(this.dataDir, 'db.json');
  private uploadsDir = path.join(process.cwd(), 'uploads');

  public users: User[] = [];
  public events: EventEntity[] = [];
  public certificates: CertificateEntity[] = [];
  public verificationLogs: VerificationLog[] = [];

  async onModuleInit() {
    this.ensureDirs();
    this.loadData();
    if (this.users.length === 0) {
      await this.seedInitialData();
    }
  }

  private ensureDirs() {
    if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.uploadsDir)) fs.mkdirSync(this.uploadsDir, { recursive: true });
    const coversDir = path.join(this.uploadsDir, 'covers');
    const stegoDir = path.join(this.uploadsDir, 'stego');
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
    if (!fs.existsSync(stegoDir)) fs.mkdirSync(stegoDir, { recursive: true });
  }

  private loadData() {
    if (fs.existsSync(this.dbFile)) {
      try {
        const raw = fs.readFileSync(this.dbFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.users = parsed.users || [];
        this.events = parsed.events || [];
        this.certificates = parsed.certificates || [];
        this.verificationLogs = parsed.verificationLogs || [];
      } catch (e) {
        console.warn('Gagal membaca db.json, menginisialisasi baru', e);
      }
    }
  }

  public saveData() {
    try {
      const data = {
        users: this.users,
        events: this.events,
        certificates: this.certificates,
        verificationLogs: this.verificationLogs,
      };
      fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Gagal menyimpan db.json', e);
    }
  }

  private async seedInitialData() {
    const salt = await bcrypt.genSalt(10);
    const pass123 = await bcrypt.hash('123', salt);

    this.users = [
      {
        id: 'usr-admin-1',
        username: 'admin',
        passwordHash: pass123,
        name: 'Administrator Fakultas (FST UINSA)',
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-mhs-1',
        username: '09020623041',
        passwordHash: pass123,
        name: 'Muh. Batni Mukharroro',
        role: 'mahasiswa',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-hima-1',
        username: 'himasi',
        passwordHash: pass123,
        name: 'HIMA Sistem Informasi UINSA',
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
    ];

    this.events = [
      {
        id: 'evt-ai-sec-2026',
        eventName: 'Seminar Nasional AI & Keamanan Informasi Digital 2026',
        eventDate: '2026-10-16',
        organizer: 'Fakultas Sains dan Teknologi UIN Sunan Ampel Surabaya',
        createdBy: 'usr-admin-1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'evt-web-nest-vue',
        eventName: 'Workshop Fullstack Modern NestJS & Vue.js 3',
        eventDate: '2026-10-18',
        organizer: 'Himpunan Mahasiswa Sistem Informasi (HIMASI) UINSA',
        createdBy: 'usr-hima-1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'evt-crypto-stego',
        eventName: 'Pelatihan Keamanan Siber: LSB Steganography & SHA-256',
        eventDate: '2026-10-20',
        organizer: 'Laboratorium Rekayasa Perangkat Lunak & Siber FST UINSA',
        createdBy: 'usr-admin-1',
        createdAt: new Date().toISOString(),
      },
    ];

    this.saveData();
  }
}
