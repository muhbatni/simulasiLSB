import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DatabaseService, User } from '../database/database.service';

const JWT_SECRET = process.env.JWT_SECRET || 'simulasi-lsb-uin-secret-key-2026';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login(usernameInput: string, pass: string): Promise<{ accessToken: string; user: Omit<User, 'passwordHash'> }> {
    const username = usernameInput ? usernameInput.trim() : '';
    if (!username) {
      throw new UnauthorizedException('Username atau NIM tidak boleh kosong');
    }

    // Password seragam "123" sesuai requirement
    const isValidPass = pass === '123' || pass === 'admin123' || pass === 'uin2026';
    if (!isValidPass) {
      throw new UnauthorizedException('Kata sandi keliru! Silakan gunakan password: 123');
    }

    let user = this.db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());

    // Jika pengguna belum terdaftar, buat akun dinamis otomatis:
    // Bedakan role dari username: jika diawali/mengandung admin atau hima -> role 'admin', selain itu -> 'mahasiswa'
    if (!user) {
      const lower = username.toLowerCase();
      const isAdmin = lower.includes('admin') || lower.includes('hima') || lower.includes('fakultas') || lower.includes('dosen');
      const role = isAdmin ? 'admin' : 'mahasiswa';
      const name = isAdmin
        ? `Petugas ${username.toUpperCase()}`
        : `Mahasiswa (${username})`;

      const salt = await bcrypt.genSalt(10);
      const hash123 = await bcrypt.hash('123', salt);

      user = {
        id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        username,
        passwordHash: hash123,
        name,
        role,
        createdAt: new Date().toISOString(),
      };

      this.db.users.push(user);
      this.db.saveData();
    }

    const payload = { sub: user.id, username: user.username, role: user.role, name: user.name };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    const { passwordHash, ...userClean } = user;
    return { accessToken, user: userClean };
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      throw new UnauthorizedException('Token JWT kadaluarsa atau tidak valid');
    }
  }
}
