import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocketAuthService {
  private readonly jwksClient: jwksRsa.JwksClient;
  private readonly issuer: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const keycloakUrl = this.config.get<string>('KEYCLOAK_URL');
    const realm = this.config.get<string>('KEYCLOAK_REALM');

    this.issuer = `${keycloakUrl}/realms/${realm}`;

    this.jwksClient = jwksRsa({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
    });
  }

  async extractUserFromHandshake(handshake: any): Promise<string | null> {
    try {
      const rawToken: string | undefined =
        handshake?.auth?.token ?? handshake?.headers?.authorization;

      if (!rawToken) return null;

      const token = rawToken.startsWith('Bearer ')
        ? rawToken.slice(7)
        : rawToken;

      const payload = await this.verifyToken(token);
      if (!payload) return null;

      const keycloakId = (payload as any).preferred_username as string | undefined;
      if (!keycloakId) return null;

      const user = await this.prisma.user.findUnique({
        where: { keycloakId },
        select: { id: true },
      });

      return user?.id ?? null;
    } catch {
      return null;
    }
  }

  private verifyToken(token: string): Promise<jwt.JwtPayload | null> {
    return new Promise((resolve) => {
      const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
        this.jwksClient.getSigningKey(header.kid, (err, key) => {
          if (err || !key) {
            callback(err ?? new Error('Signing key not found'));
            return;
          }
          callback(null, key.getPublicKey());
        });
      };

      jwt.verify(
        token,
        getKey,
        { algorithms: ['RS256'], issuer: this.issuer },
        (err, decoded) => {
          if (err || !decoded) {
            resolve(null);
          } else {
            resolve(decoded as jwt.JwtPayload);
          }
        },
      );
    });
  }
}
