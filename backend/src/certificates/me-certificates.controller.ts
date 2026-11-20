import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import * as fs from 'fs';

@Controller('api/me/certificates')
@UseGuards(JwtAuthGuard)
export class MeCertificatesController {
  constructor(private readonly certService: CertificatesService) {}

  /**
   * Portal Mahasiswa - Cari dan lihat sertifikat milik akun sendiri
   */
  @Get()
  async getMyCertificates(@Request() req: any, @Query('q') query?: string) {
    const studentNim = req.user?.username || '';
    return this.certService.getStudentCertificates(studentNim, query);
  }

  /**
   * Verifikasi berkas tersimpan milik mahasiswa di server
   */
  @Post(':id/verify')
  async verifyMyCertificate(@Param('id') id: string, @Request() req: any) {
    const studentNim = req.user?.username || '';
    const isAdmin = req.user?.role === 'admin';
    return this.certService.verifyStudentCertificate(id, studentNim, isAdmin);
  }

  /**
   * Unduh sertifikat milik akun sendiri langsung dari Portal Mahasiswa
   */
  @Get(':id/download')
  async downloadMyCertificate(
    @Param('id') id: string,
    @Res() res: Response,
    @Request() req: any,
  ) {
    const cert = await this.certService.getCertificateById(id);
    const studentNim = req.user?.username || '';
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && cert.recipientIdentifier.toLowerCase() !== studentNim.toLowerCase()) {
      throw new ForbiddenException('Akses ditolak: sertifikat bukan milik akun Anda');
    }

    const filePath = this.certService.getStegoFilePath(id);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Berkas stego sertifikat tidak ditemukan');
    }

    const safeFilename = `Sertifikat-${cert.recipientName.replace(/[^a-zA-Z0-9_-]/g, '_')}-${cert.certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
