import { Module } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { HashCryptoService } from './security/hash-crypto.service';
import { LsbSteganoService } from './security/lsb-stego.service';
import { CertificateGeneratorService } from './certificates/certificate-generator.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';
import { EventsService } from './events/events.service';
import { EventsController } from './events/events.controller';
import { CertificatesService } from './certificates/certificates.service';
import { CertificatesController } from './certificates/certificates.controller';
import { MeCertificatesController } from './certificates/me-certificates.controller';
import { VerificationService } from './verification/verification.service';
import { VerificationController } from './verification/verification.controller';
import { SimulationService } from './simulation/simulation.service';
import { SimulationController } from './simulation/simulation.controller';

@Module({
  imports: [],
  controllers: [
    AuthController,
    EventsController,
    CertificatesController,
    MeCertificatesController,
    VerificationController,
    SimulationController,
  ],
  providers: [
    PrismaService,
    HashCryptoService,
    LsbSteganoService,
    CertificateGeneratorService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    EventsService,
    CertificatesService,
    VerificationService,
    SimulationService,
  ],
})
export class AppModule {}
