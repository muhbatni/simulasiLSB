import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CertificatesService, GenerateCertDto } from './certificates.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/certificates')
export class CertificatesController {
  constructor(private readonly certService: CertificatesService) {}

  @Get()
  getAll() {
    return this.certService.getAllCertificates();
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.certService.searchCertificates(query || '');
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.certService.getCertificateById(id);
  }

  /**
   * Skenario 7: Mahasiswa mengunduh e-sertifikat
   * Mengalirkan berkas stego PNG utuh tanpa mengalami kompresi visual
   */
  @Get(':id/download')
  downloadFile(@Param('id') id: string, @Res() res: Response) {
    const cert = this.certService.getCertificateById(id);
    const filePath = this.certService.getStegoFilePath(id);

    const safeFilename = `Sertifikat-${cert.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${cert.certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  @UseInterceptors(
    FileInterceptor('coverImage', {
      fileFilter: (req, file, cb) => {
        if (file) {
          const ext = path.extname(file.originalname).toLowerCase();
          if (ext !== '.png' && file.mimetype !== 'image/png') {
            return cb(
              new BadRequestException('Hanya format PNG yang didukung'),
              false,
            );
          }
        }
        cb(null, true);
      },
    }),
  )
  async generate(
    @Body() body: GenerateCertDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.certService.generateCertificate(body, file?.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bulk-generate')
  async bulkGenerate(
    @Body()
    body: {
      eventId: string;
      recipients: Array<{
        name: string;
        identifier: string;
        role?: string;
        certificateNumber?: string;
      }>;
    },
  ) {
    return this.certService.bulkGenerateFromList(body.eventId, body.recipients);
  }
}
