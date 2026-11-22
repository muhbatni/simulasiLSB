import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Memulai seeding data awal PostgreSQL...');

  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || '123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // 1. Seed Users
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      name: 'Administrator Prodi Sistem Informasi',
    },
    create: {
      id: 'usr-admin-1',
      username: 'admin',
      passwordHash,
      name: 'Administrator Prodi Sistem Informasi',
      role: Role.admin,
    },
  });

  const mahasiswa = await prisma.user.upsert({
    where: { username: '09020623041' },
    update: {},
    create: {
      id: 'usr-mhs-1',
      username: '09020623041',
      passwordHash,
      name: 'Muh. Batni Mukharroro',
      role: Role.mahasiswa,
    },
  });

  const himasi = await prisma.user.upsert({
    where: { username: 'himasi' },
    update: {},
    create: {
      id: 'usr-hima-1',
      username: 'himasi',
      passwordHash,
      name: 'Himpunan Mahasiswa Sistem Informasi (HIMAPROSIF) UINSA',
      role: Role.admin,
    },
  });

  console.log(`[Seed] Berhasil membuat 3 akun pengguna: admin, himasi, 09020623041`);

  // 2. Seed Events
  const evt1 = await prisma.event.upsert({
    where: { id: 'evt-ai-sec-2026' },
    update: {
      certificatePrefix: '041/HIMAPROSIF/XI/2026/',
    },
    create: {
      id: 'evt-ai-sec-2026',
      eventName: 'Seminar Nasional AI & Keamanan Informasi Digital 2026',
      eventDate: '2026-10-16',
      startTime: '08:30',
      endTime: '12:00',
      organizer: 'Fakultas Sains dan Teknologi UIN Sunan Ampel Surabaya',
      certificatePrefix: '041/HIMAPROSIF/XI/2026/',
      createdBy: admin.id,
    },
  });

  const evt2 = await prisma.event.upsert({
    where: { id: 'evt-web-nest-vue' },
    update: {
      certificatePrefix: '042/HIMAPROSIF/XI/2026/',
    },
    create: {
      id: 'evt-web-nest-vue',
      eventName: 'Workshop Fullstack Modern NestJS & Vue.js 3',
      eventDate: '2026-10-18',
      startTime: '09:00',
      endTime: '15:00',
      organizer: 'Himpunan Mahasiswa Program Studi Sistem Informasi (HIMAPROSIF) UINSA',
      certificatePrefix: '042/HIMAPROSIF/XI/2026/',
      createdBy: himasi.id,
    },
  });

  const evt3 = await prisma.event.upsert({
    where: { id: 'evt-crypto-stego' },
    update: {
      certificatePrefix: '043/LAB-RPL/XI/2026/',
    },
    create: {
      id: 'evt-crypto-stego',
      eventName: 'Pelatihan Keamanan Siber: LSB Steganography & SHA-256',
      eventDate: '2026-10-20',
      startTime: '13:00',
      endTime: '16:30',
      organizer: 'Laboratorium Rekayasa Perangkat Lunak & Siber FST UINSA',
      certificatePrefix: '043/LAB-RPL/XI/2026/',
      createdBy: admin.id,
    },
  });

  // Pastikan semua event yang belum memiliki certificatePrefix terisi nilai default
  await prisma.event.updateMany({
    where: { certificatePrefix: null },
    data: { certificatePrefix: '041/HIMAPROSIF/XI/2026/' },
  });

  console.log(`[Seed] Berhasil membuat 3 data event default.`);
  console.log('[Seed] Seeding data selesai dengan sukses.');
}

main()
  .catch((e) => {
    console.error('[Seed] Error saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
