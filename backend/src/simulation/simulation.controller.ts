import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { HashCryptoService } from '../security/hash-crypto.service';

@Controller('api/simulation')
export class SimulationController {
  constructor(
    private readonly simService: SimulationService,
    private readonly hashCryptoService: HashCryptoService,
  ) {}

  /**
   * Endpoint menjalankan 9 Pengujian Black-Box (Tabel 3.1 Proposal)
   */
  @Get('black-box')
  async runBlackBox() {
    return this.simService.runBlackBoxTesting();
  }

  /**
   * Endpoint menjalankan Pengujian Reliabilitas Iterasi Sampling (Tabel 3.2 Proposal)
   */
  @Get('iterative-test')
  async runIterativeTest(@Query('count') count?: string) {
    const num = count ? parseInt(count, 10) : 50;
    return this.simService.runIterativeReliabilityTest(num);
  }

  /**
   * Endpoint simulasi 5 skenario Tamper Detection & Avalanche Effect (Tabel 3.4 Proposal)
   */
  @Get('tamper-test')
  async runTamperTest() {
    return this.simService.runTamperDetectionSimulation();
  }

  /**
   * Endpoint interaktif untuk menguji Avalanche Effect antara dua string
   */
  @Post('avalanche')
  calculateAvalanche(@Body() body: { textA: string; textB: string }) {
    return this.hashCryptoService.calculateAvalancheEffect(
      body.textA || '',
      body.textB || '',
    );
  }
}
