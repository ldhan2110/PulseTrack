import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes, createHash } from 'crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const ISSUER = 'pulsetrack';
export const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectQueue('notification-email') private readonly emailQueue: Queue,
  ) {
    this.secret = this.config.get<string>('EXTERNAL_JWT_SECRET') || '';
  }

  // --- password hashing (argon2id) ---
  hashPassword(password: string): Promise<string> {
    return argonHash(password);
  }

  verifyPassword(hash: string, password: string): Promise<boolean> {
    return argonVerify(hash, password);
  }

  // --- token signing ---
  signTokens(user: Pick<User, 'id'>): AuthTokens {
    const accessToken = this.jwt.sign(
      { sub: user.id, userType: 'EXTERNAL', typ: 'access' },
      { secret: this.secret, issuer: ISSUER, expiresIn: ACCESS_TTL },
    );
    const refreshToken = this.jwt.sign(
      { sub: user.id, typ: 'refresh' },
      { secret: this.secret, issuer: ISSUER, expiresIn: REFRESH_TTL },
    );
    return { accessToken, refreshToken };
  }

  private publicUser(user: User) {
    const { passwordHash, pwResetTokenHash, pwResetTokenExp, ...rest } = user;
    void passwordHash;
    void pwResetTokenHash;
    void pwResetTokenExp;
    return rest;
  }

  // --- login (req-1) ---
  async login(email: string, password: string) {
    const generic = new UnauthorizedException('Invalid email or password');
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (
      !user ||
      user.userType !== 'EXTERNAL' ||
      user.status !== 'ACTIVE' ||
      !user.passwordHash
    ) {
      throw generic;
    }
    const ok = await this.verifyPassword(user.passwordHash, password);
    if (!ok) throw generic;

    return { ...this.signTokens(user), user: this.publicUser(user) };
  }

  // --- refresh (req-5), rotate-on-use ---
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub?: string; typ?: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.secret,
        issuer: ISSUER,
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.typ !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.userType !== 'EXTERNAL' || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }
    return this.signTokens(user);
  }

  // --- set-password / reset token issuance (req-6, req-7, req-8) ---
  private sha256(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Issue a single-use token, store its hash + expiry on the user, return the raw token. */
  async issueSetPasswordToken(userId: string, ttlMs: number): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pwResetTokenHash: this.sha256(raw),
        pwResetTokenExp: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  /** Enqueue the set-password email (used by both invite and forgot-password). */
  async enqueueSetPasswordEmail(email: string, token: string): Promise<void> {
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:5173';
    const link = `${appUrl}/set-password?token=${token}`;
    await this.emailQueue.add('set-password', { email, link });
  }

  // --- set password with token (req-7) ---
  async setPassword(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findFirst({
      where: { pwResetTokenHash: this.sha256(token) },
    });
    if (
      !user ||
      !user.pwResetTokenExp ||
      user.pwResetTokenExp.getTime() < Date.now()
    ) {
      throw new BadRequestException('This link is invalid or has expired');
    }
    const passwordHash = await this.hashPassword(newPassword);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        pwResetTokenHash: null,
        pwResetTokenExp: null,
      },
    });
    return { ...this.signTokens(updated), user: this.publicUser(updated) };
  }

  // --- forgot password (req-8), neutral response ---
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    // Only external users have a PulseTrack password to reset; internal users
    // authenticate via Keycloak. Response is neutral regardless (anti-enumeration).
    if (user && user.userType === 'EXTERNAL') {
      const token = await this.issueSetPasswordToken(user.id, RESET_TOKEN_TTL_MS);
      await this.enqueueSetPasswordEmail(user.email, token);
    }
  }
}
