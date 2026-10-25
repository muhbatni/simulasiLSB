import { HashCryptoService } from '../src/security/hash-crypto.service';
import { LsbSteganoService, CertificateMetadata } from '../src/security/lsb-stego.service';
import sharp from 'sharp';

describe('Unit Test Modul Kriptografi & Steganografi LSB (NF-11)', () => {
  let hashService: HashCryptoService;
  let lsbService: LsbSteganoService;

  beforeAll(() => {
    hashService = new HashCryptoService();
    lsbService = new LsbSteganoService(hashService);
  });

  describe('1. HashCryptoService (SHA-256 & Avalanche Effect)', () => {
    it('harus menghasilkan intisari SHA-256 deterministik 64 digit heksadesimal lowercase', () => {
      const input = 'FST/2026/001#Ahmad Fulan#Peserta#Seminar Nasional SI#2026-10-16#UIN Sunan Ampel Surabaya';
      const hash1 = hashService.computeSha256(input);
      const hash2 = hashService.computeSha256(input);

      expect(hash1).toBeDefined();
      expect(hash1.length).toBe(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);
    });

    it('harus mendeteksi avalanche effect saat 1 karakter teks diubah', () => {
      const orig = 'UINSA/2026/001#Ahmad Fauzi#Peserta#Seminar AI#2026-10-20#FST UINSA';
      const mod = 'UINSA/2026/001#Ahmed Fauzi#Peserta#Seminar AI#2026-10-20#FST UINSA';

      const avalanche = hashService.calculateAvalancheEffect(orig, mod);

      expect(avalanche.bitDifferences).toBeGreaterThan(0);
      expect(avalanche.avalanchePercentage).toBeGreaterThan(35); // Standar kriptografis > 35-50%
      expect(avalanche.originalHash).not.toBe(avalanche.modifiedHash);
    });
  });

  describe('2. Sanitasi Delimiter (# dan @) sesuai Spesifikasi 4.3 & F-04', () => {
    it('harus me-replace karakter # menjadi %23 dan @ menjadi %40', () => {
      const rawText = 'Sertifikat #01 @Event_UINSA';
      const escaped = lsbService.escapeField(rawText);

      expect(escaped).toBe('Sertifikat %2301 %40Event_UINSA');
      expect(escaped).not.toContain('#');
      expect(escaped).not.toContain('@');

      const unescaped = lsbService.unescapeField(escaped);
      expect(unescaped).toBe(rawText);
    });
  });

  describe('3. LsbSteganoService (Operasi Bitwise, Embedding & Extraction)', () => {
    let dummyPngBuffer: Buffer;

    beforeAll(async () => {
      // Buat citra PNG sintetis 100x100 RGB
      dummyPngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 240, g: 240, b: 240 },
        },
      })
        .png({ compressionLevel: 9 })
        .toBuffer();
    });

    it('harus memvalidasi magic bytes PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
      expect(lsbService.isPng(dummyPngBuffer)).toBe(true);

      const fakeJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(lsbService.isPng(fakeJpg)).toBe(false);
    });

    it('harus berhasil melakukan round-trip embedding dan ekstraksi dengan integritas hash 100% cocok (Zero Bit Error)', async () => {
      const metadata: CertificateMetadata = {
        nomor: 'UINSA/FST/2026/001',
        nama: 'Muh. Batni Mukharroro',
        peran: 'Peserta Utama',
        kegiatan: 'Seminar Nasional Riset LSB & SHA-256',
        tanggal: '2026-10-25',
        lembaga: 'UIN Sunan Ampel Surabaya',
      };

      const embedRes = await lsbService.embedPayload(dummyPngBuffer, metadata);

      expect(embedRes.stegoBuffer).toBeDefined();
      expect(embedRes.mse).toBeLessThan(0.05);
      expect(embedRes.psnr).toBeGreaterThanOrEqual(45.0);

      // Verifikasi ekstraksi
      const verifRes = await lsbService.extractAndVerify(embedRes.stegoBuffer);

      expect(verifRes.isValid).toBe(true);
      expect(verifRes.status).toBe('ASLI_VALID');
      expect(verifRes.hashMatch).toBe(true);
      expect(verifRes.metadata?.nama).toBe(metadata.nama);
      expect(verifRes.metadata?.nomor).toBe(metadata.nomor);
    });

    it('harus mendeteksi manipulasi jika piksel diubah (Tamper Detection)', async () => {
      const metadata: CertificateMetadata = {
        nomor: 'UINSA/TAMPER/001',
        nama: 'Budi Santoso',
        peran: 'Peserta',
        kegiatan: 'Workshop Siber',
        tanggal: '2026-10-25',
        lembaga: 'FST UINSA',
      };

      const embedRes = await lsbService.embedPayload(dummyPngBuffer, metadata);

      // Manipulasi piksel pada buffer stego
      const tampered = lsbService.tamperPixel(embedRes.stegoBuffer, 0, 0, 10);

      const verifRes = await lsbService.extractAndVerify(tampered);

      expect(verifRes.isValid).toBe(false);
      expect(verifRes.status).toBe('MANIPULASI_TERDETEKSI');
    });

    it('harus menolak bila ukuran payload melebihi kapasitas citra (Capacity Overflow)', async () => {
      const tinyPng = await sharp({
        create: { width: 5, height: 5, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .png()
        .toBuffer();

      const metadata: CertificateMetadata = {
        nomor: 'OVERFLOW/001',
        nama: 'Penerima Dengan Nama Sangat Panjang Melebihi Total Kapasitas Citra',
        peran: 'Peserta',
        kegiatan: 'Kegiatan Panjang Sekali',
        tanggal: '2026-10-25',
        lembaga: 'UINSA',
      };

      await expect(lsbService.embedPayload(tinyPng, metadata)).rejects.toThrow(
        /Kapasitas citra tidak mencukupi/,
      );
    });
  });
});
