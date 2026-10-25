import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('api/me/certificates')
@UseGuards(JwtAuthGuard)
export class MeCertificatesController {
  constructor(private readonly certService: CertificatesService) {}

  /**
   * F-08: Portal Mahasiswa - Cari dan lihat sertifikat milik akun sendiri
   */
  @Get()
  getMyCertificates(@Request() req: any, @Query('q') query?: string) {
    const studentNim = req.user?.username || '';
    return this.certService.getStudentCertificates(studentNim, query);
  }

  /**
   * F-08: Verifikasi berkas tersimpan milik mahasiswa di server
   */
  @Post(':id/verify')
  async verifyMyCertificate(@Param('id') id: string, @Request() req: any) {
    const studentNim = req.user?.username || '';
    const isAdmin = req.user?.role === 'admin';
    return this.certService.verifyStudentCertificate(id, studentNim, isAdmin);
  }
}
