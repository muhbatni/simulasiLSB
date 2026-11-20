import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { User } from '@prisma/client';

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  // Rate limiting login: 5 attempts per minute per IP
  private loginAttempts = new Map<string, LoginAttempt>();

  constructor(private readonly prisma: PrismaService) {
    const envSecret = process.env.JWT_SECRET;
    if (!envSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: Variabel lingkungan JWT_SECRET wajib diatur di lingkungan produksi!');
      } else {
        this.logger.warn(
          'Peringatan: JWT_SECRET belum diatur di lingkungan. Menggunakan secret default dev.',
        );
        this.jwtSecret = 'simulasi-lsb-uin-secret-key-2026-development-only';
      }
    } else {
      this.jwtSecret = envSecret;
    }

    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
  }

  async login(
    usernameInput: string,
    pass: string,
    ipAddress = '127.0.0.1',
  ): Promise<{ accessToken: string; user: Omit<User, 'passwordHash'> }> {
    this.checkRateLimit(ipAddress);

    const username = usernameInput ? usernameInput.trim() : '';
    const password = pass ? pass.trim() : '';

    if (!username || !password) {
      this.recordFailedAttempt(ipAddress);
      throw new UnauthorizedException('Username atau password salah');
    }

    let user: User | null = null;
    try {
      user = await this.prisma.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: 'insensitive',
          },
        },
      });
    } catch (err: any) {
      this.logger.error('Error saat mencari user di database:', err.message);
      throw new HttpException(
        'Gagal menghubungi basis data autentikasi',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!user) {
      this.recordFailedAttempt(ipAddress);
      // Pesan generik tanpa membocorkan eksistensi akun
      throw new UnauthorizedException('Username atau password salah');
    }

    // Bandingkan password dengan hash bcrypt di basis data Users
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      this.recordFailedAttempt(ipAddress);
      throw new UnauthorizedException('Username atau password salah');
    }

    // Reset percobaan login jika berhasil
    this.loginAttempts.delete(ipAddress);

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: (this.jwtExpiresIn as any) || '1h',
    });

    const { passwordHash, ...userClean } = user;
    return { accessToken, user: userClean };
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch {
      throw new UnauthorizedException('Sesi berakhir atau token tidak valid');
    }
  }

  private checkRateLimit(ip: string) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 menit
    const maxAttempts = 5;

    const attempt = this.loginAttempts.get(ip);
    if (!attempt) return;

    if (now - attempt.firstAttemptAt > windowMs) {
      this.loginAttempts.delete(ip);
      return;
    }

    if (attempt.count >= maxAttempts) {
      const waitSeconds = Math.ceil((windowMs - (now - attempt.firstAttemptAt)) / 1000);
      throw new HttpException(
        `Terlalu banyak percobaan login. Silakan coba kembali dalam ${waitSeconds} detik.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailedAttempt(ip: string) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const attempt = this.loginAttempts.get(ip);

    if (!attempt || now - attempt.firstAttemptAt > windowMs) {
      this.loginAttempts.set(ip, { count: 1, firstAttemptAt: now });
    } else {
      attempt.count += 1;
    }
  }
}
