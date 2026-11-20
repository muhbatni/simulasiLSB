import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Req,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { LoginDto } from './dto/login.dto';

export function extractClientIp(req: ExpressRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: ExpressRequest) {
    const ipAddress = extractClientIp(req);
    return this.authService.login(body.username, body.password, ipAddress);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return { user: req.user };
  }
}
