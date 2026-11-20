import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Input Validation Pipe (Spec F-01 to F-11 & NF Security)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS aman: Batasi origin ke frontend terkonfigurasi (Bab 3.1.4.1 NF Security)
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
    : [
        'http://localhost',
        'http://localhost:80',
        'http://localhost:5173',
        'http://127.0.0.1',
        'http://127.0.0.1:80',
        'http://127.0.0.1:5173',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Akses diblokir oleh kebijakan CORS'));
      }
    },
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
