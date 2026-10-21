import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface AvalancheResult {
  originalText: string;
  modifiedText: string;
  originalHash: string;
  modifiedHash: string;
  bitDifferences: number;
  totalBits: number;
  avalanchePercentage: number;
  hexDiffMap: Array<{ original: string; modified: string; changed: boolean }>;
}

@Injectable()
export class HashCryptoService {
  /**
   * Menghitung nilai intisari hash SHA-256 deterministik 64 digit heksadesimal (256-bit)
   */
  computeSha256(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  /**
   * Menghitung efek longsor (avalanche effect) antara dua teks
   * Digunakan untuk simulasi dan validasi pengujian integritas (Bab 3.1.4.4)
   */
  calculateAvalancheEffect(originalText: string, modifiedText: string): AvalancheResult {
    const originalHash = this.computeSha256(originalText);
    const modifiedHash = this.computeSha256(modifiedText);

    // Bandingkan bit demi bit pada 256 bit (32 byte)
    const origBuf = Buffer.from(originalHash, 'hex');
    const modBuf = Buffer.from(modifiedHash, 'hex');

    let bitDiffCount = 0;
    const totalBits = 256;

    for (let i = 0; i < origBuf.length; i++) {
      let xor = origBuf[i] ^ modBuf[i];
      while (xor > 0) {
        if (xor & 1) bitDiffCount++;
        xor >>= 1;
      }
    }

    const hexDiffMap = [];
    for (let i = 0; i < originalHash.length; i++) {
      hexDiffMap.push({
        original: originalHash[i],
        modified: modifiedHash[i],
        changed: originalHash[i] !== modifiedHash[i],
      });
    }

    return {
      originalText,
      modifiedText,
      originalHash,
      modifiedHash,
      bitDifferences: bitDiffCount,
      totalBits,
      avalanchePercentage: Number(((bitDiffCount / totalBits) * 100).toFixed(2)),
      hexDiffMap,
    };
  }
}
