import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Aktifkan CORS untuk komunikasi Frontend Vue.js
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Limit body payload untuk berkas resolusi tinggi (A4 300 DPI)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`==========================================================`);
  console.log(`[LSB-SHA256 Backend] Berjalan aktif di http://localhost:${port}`);
  console.log(`Arsitektur Three-Tier: Security Engine, LSB & SHA-256 Siap`);
  console.log(`==========================================================`);
}

bootstrap();
