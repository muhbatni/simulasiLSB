import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DatabaseService, User } from '../database/database.service';

const JWT_SECRET = process.env.JWT_SECRET || 'simulasi-lsb-uin-secret-key-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Spec F-01 & 4.7

interface LoginAttempt {
  count: number;
  firstAttemptAt: number;
}

@Injectable()
export class AuthService {
  // Rate limiting login: 5 attempts per minute per IP (Spec F-01)
  private loginAttempts = new Map<string, LoginAttempt>();

  constructor(private readonly db: DatabaseService) {}

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

    const user = this.db.users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );

    if (!user) {
      this.recordFailedAttempt(ipAddress);
      // F-01: Pesan "Username atau password salah" (tidak menyebut mana yang salah)
      throw new UnauthorizedException('Username atau password salah');
    }

    // Bandingkan password dengan hash bcrypt di tabel Users (F-01, NF-03)
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

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: (JWT_EXPIRES_IN as any) || '1h',
    });

    const { passwordHash, ...userClean } = user;
    return { accessToken, user: userClean };
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
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
