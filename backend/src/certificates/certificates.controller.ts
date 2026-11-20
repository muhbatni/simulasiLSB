import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CertificatesService } from './certificates.service';
import {
  GenerateCertDto,
  IssueCertificatesDto,
  BulkGenerateDto,
} from './dto/certificate.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LsbSteganoService } from '../security/lsb-stego.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/certificates')
export class CertificatesController {
  constructor(
    private readonly certService: CertificatesService,
    private readonly lsbService: LsbSteganoService,
  ) {}

  // Hanya Admin yang dapat melihat seluruh daftar sertifikat sistem
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  getAll() {
    return this.certService.getAllCertificates();
  }

  // Pencarian sertifikat ber-guard: Mahasiswa dibatasi hanya NIM sendiri, Admin dapat mencari semua
  @UseGuards(JwtAuthGuard)
  @Get('search')
  search(@Query('q') query: string, @Request() req: any) {
    const studentFilter = req.user?.role === 'admin' ? undefined : req.user?.username;
    return this.certService.searchCertificates(query || '', studentFilter);
  }

  // Penerbitan Terpusat dari Daftar Penerima
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('issue')
  async issue(@Body() body: IssueCertificatesDto) {
    return this.certService.issueCertificates(
      body.eventId,
      body.recipientIds,
      body.resolution || '1080p',
    );
  }

  // Unduh ZIP Banyak Sertifikat Sekaligus (Store mode lossless)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('download-zip')
  downloadZip(@Body() body: { certificateIds: string[] }, @Res() res: Response) {
    return this.certService.streamZipArchive(body.certificateIds || [], res);
  }

  // Akses detail sertifikat ber-guard: Admin atau pemilik akun mahasiswa
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getOne(@Param('id') id: string, @Request() req: any) {
    const cert = await this.certService.getCertificateById(id);
    if (
      req.user?.role !== 'admin' &&
      cert.recipientIdentifier.toLowerCase() !== req.user?.username?.toLowerCase()
    ) {
      throw new ForbiddenException('Akses ditolak: sertifikat bukan milik akun Anda');
    }
    return cert;
  }

  // Mengunduh e-sertifikat stego PNG utuh tanpa kompresi visual
  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res() res: Response,
    @Request() req: any,
  ) {
    const cert = await this.certService.getCertificateById(id);
    if (
      req.user?.role !== 'admin' &&
      cert.recipientIdentifier.toLowerCase() !== req.user?.username?.toLowerCase()
    ) {
      throw new ForbiddenException('Akses ditolak: sertifikat bukan milik akun Anda');
    }

    const filePath = this.certService.getStegoFilePath(id);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('Berkas e-sertifikat belum diterbitkan atau tidak ditemukan');
    }

    const safeFilename = `Sertifikat-${cert.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${cert.certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('generate')
  @UseInterceptors(
    FileInterceptor('coverImage', {
      limits: { fileSize: 10 * 1024 * 1024 },
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
    if (file && !this.lsbService.isPng(file.buffer)) {
      throw new BadRequestException('Berkas bukan format PNG lossless valid (magic bytes mismatch)');
    }
    return this.certService.generateCertificate(body, file?.buffer);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('bulk-generate')
  async bulkGenerate(@Body() body: BulkGenerateDto) {
    return this.certService.bulkGenerateFromList(body.eventId, body.recipients);
  }
}
