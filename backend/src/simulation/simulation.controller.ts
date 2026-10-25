import { Controller, Post, Get, Body, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SimulationService } from './simulation.service';
import { HashCryptoService } from '../security/hash-crypto.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api')
export class SimulationController {
  constructor(
    private readonly simService: SimulationService,
    private readonly hashCryptoService: HashCryptoService,
  ) {}

  /**
   * Endpoint menjalankan 9 Pengujian Black-Box (Tabel 3.1 Proposal)
   */
  @Get('simulation/black-box')
  async runBlackBox() {
    return this.simService.runBlackBoxTesting();
  }

  /**
   * Endpoint menjalankan Pengujian Reliabilitas Iterasi Sampling (Tabel 3.2 Proposal)
   */
  @Get('simulation/iterative-test')
  async runIterativeTest(@Query('count') count?: string) {
    const num = count ? parseInt(count, 10) : 50;
    return this.simService.runIterativeReliabilityTest(num);
  }

  /**
   * Endpoint simulasi 5 skenario Tamper Detection & Avalanche Effect (Tabel 3.4 Proposal)
   */
  @Get('simulation/tamper-test')
  async runTamperTest() {
    return this.simService.runTamperDetectionSimulation();
  }

  /**
   * Endpoint interaktif untuk menguji Avalanche Effect antara dua string
   */
  @Post('simulation/avalanche')
  calculateAvalanche(@Body() body: { textA: string; textB: string }) {
    return this.hashCryptoService.calculateAvalancheEffect(
      body.textA || '',
      body.textB || '',
    );
  }

  /**
   * F-12: Ekspor CSV Hasil Uji (50 Sampel: 25 Full HD + 25 A4 300DPI)
   * Sesuai Tabel 4.5 Spesifikasi REST API (/metrics/export)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('metrics/export')
  async exportMetricsCsv(@Res() res: Response, @Query('count') count?: string) {
    const num = count ? parseInt(count, 10) : 50;
    const csv = await this.simService.exportSamplingCsv(num);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Hasil-Uji-Metrik-50-Sampel-${Date.now()}.csv"`,
    );
    res.send(csv);
  }
}
