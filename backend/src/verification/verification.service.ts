import { Injectable } from '@nestjs/common';
import { DatabaseService, VerificationLog } from '../database/database.service';
import { LsbSteganoService, VerificationResult } from '../security/lsb-stego.service';

@Injectable()
export class VerificationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly lsbService: LsbSteganoService,
  ) {}

  async verifyUploadedCertificate(
    imageBuffer: Buffer,
    ipAddress = '127.0.0.1',
  ): Promise<VerificationResult> {
    const result = await this.lsbService.extractAndVerify(imageBuffer);

    // Cari sertifikat terkait di database jika ada
    let certId: string | undefined = undefined;
    if (result.metadata?.nomor) {
      const found = this.db.certificates.find(
        (c) => c.certificateNumber.toLowerCase() === result.metadata!.nomor.toLowerCase(),
      );
      if (found) certId = found.id;
    }

    // Catat ke VerificationLogs
    const log: VerificationLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      certificateId: certId,
      certificateNumber: result.metadata?.nomor,
      recipientName: result.metadata?.nama,
      ipAddress,
      verificationStatus: result.status,
      verifiedAt: new Date().toISOString(),
      message: result.message,
      storedHash: result.storedHash,
      recomputedHash: result.recomputedHash,
    };

    this.db.verificationLogs.unshift(log);
    this.db.saveData();

    return result;
  }

  getLogs(limit = 100): VerificationLog[] {
    return this.db.verificationLogs.slice(0, limit);
  }

  getStats() {
    const total = this.db.verificationLogs.length;
    const valid = this.db.verificationLogs.filter((l) => l.verificationStatus === 'ASLI_VALID').length;
    const manipulated = this.db.verificationLogs.filter(
      (l) => l.verificationStatus === 'MANIPULASI_TERDETEKSI',
    ).length;
    const invalidFormat = this.db.verificationLogs.filter(
      (l) => l.verificationStatus === 'FORMAT_TIDAK_VALID',
    ).length;

    return {
      totalVerifications: total,
      validCount: valid,
      manipulatedCount: manipulated,
      invalidFormatCount: invalidFormat,
      totalCertificatesIssued: this.db.certificates.length,
      totalEvents: this.db.events.length,
    };
  }
}
