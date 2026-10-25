import {
  Controller,
  Post,
  Get,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LsbSteganoService } from '../security/lsb-stego.service';

interface VerifRateLimit {
  count: number;
  firstRequestAt: number;
}

@Controller('api/verification')
export class VerificationController {
  // Rate limiting: 20 permintaan per menit per IP (Spec F-09)
  private rateLimits = new Map<string, VerifRateLimit>();

  constructor(
    private readonly verificationService: VerificationService,
    private readonly lsbService: LsbSteganoService,
  ) {}

  /**
   * F-09: Endpoint Verifikasi Publik E-Sertifikat (Tanpa Login)
   */
  @Post('verify')
  @UseInterceptors(
    FileInterceptor('certificateImage', {
      limits: { fileSize: 50 * 1024 * 1024 }, // Mendukung hingga 50MB (A4 300 DPI)
    }),
  )
  async verifyCertificate(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Berkas citra e-sertifikat PNG harus diunggah');
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    this.checkRateLimit(ipAddress);

    // Cek magic bytes PNG (89 50 4E 47 0D 0A 1A 0A)
    if (!this.lsbService.isPng(file.buffer)) {
      return {
        status: 'FORMAT_TIDAK_VALID',
        isValid: false,
        message: 'Format bukan PNG lossless; data steganografi rusak atau tidak ditemukan',
        executionTimeMs: 1,
      };
    }

    return this.verificationService.verifyUploadedCertificate(file.buffer, ipAddress);
  }

  // F-11: Log Verifikasi hanya boleh diakses oleh Admin
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('logs')
  getLogs(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    return this.verificationService.getLogs({ status, q, startDate, endDate, limit });
  }

  // F-11: Ekspor CSV Log Verifikasi
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('logs/export-csv')
  exportLogsCsv(@Res() res: Response) {
    const csv = this.verificationService.exportLogsToCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="VerificationLogs-${Date.now()}.csv"`,
    );
    res.send(csv);
  }

  @Get('stats')
  getStats() {
    return this.verificationService.getStats();
  }

  private checkRateLimit(ip: string) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 20;

    const record = this.rateLimits.get(ip);
    if (!record) {
      this.rateLimits.set(ip, { count: 1, firstRequestAt: now });
      return;
    }

    if (now - record.firstRequestAt > windowMs) {
      this.rateLimits.set(ip, { count: 1, firstRequestAt: now });
      return;
    }

    if (record.count >= maxRequests) {
      const waitSeconds = Math.ceil((windowMs - (now - record.firstRequestAt)) / 1000);
      throw new HttpException(
        `Terlalu banyak permintaan verifikasi. Tunggu ${waitSeconds} detik sebelum mencoba lagi.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
  }
}
