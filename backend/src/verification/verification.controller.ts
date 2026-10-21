import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { VerificationService } from './verification.service';
import * as path from 'path';

@Controller('api/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  /**
   * Endpoint Verifikasi Publik E-Sertifikat (Dapat diakses tanpa autentikasi login)
   */
  @Post('verify')
  @UseInterceptors(
    FileInterceptor('certificateImage', {
      limits: { fileSize: 50 * 1024 * 1024 }, // Mendukung sertifikat 300 DPI hingga 50MB
      fileFilter: (req, file, cb) => {
        // Cek ekstensi file
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.png' && file.mimetype !== 'image/png') {
          return cb(
            new BadRequestException('Format bukan PNG lossless; data LSB tidak valid'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async verifyCertificate(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Berkas citra e-sertifikat harus diunggah');
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    return this.verificationService.verifyUploadedCertificate(file.buffer, ipAddress);
  }

  @Get('logs')
  getLogs() {
    return this.verificationService.getLogs();
  }

  @Get('stats')
  getStats() {
    return this.verificationService.getStats();
  }
}
