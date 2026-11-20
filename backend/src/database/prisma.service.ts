import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  public readonly uploadsDir = path.join(process.cwd(), 'uploads');
  public readonly coversDir = path.join(this.uploadsDir, 'covers');
  public readonly stegoDir = path.join(this.uploadsDir, 'stego');

  async onModuleInit() {
    this.ensureDirs();
    try {
      await this.$connect();
      this.logger.log('Prisma ORM berhasil terhubung ke PostgreSQL.');
    } catch (error: any) {
      this.logger.warn(
        `Koneksi PostgreSQL via Prisma belum tersambung: ${error.message}. Layanan tetap aktif.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  public ensureDirs() {
    const requiredDirs = [this.uploadsDir, this.coversDir, this.stegoDir];
    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`[Storage] Direktori otomatis dibuat: ${dir}`);
      }
    }
  }
}
