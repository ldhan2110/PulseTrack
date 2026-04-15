import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '@pm/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const keycloakUrl = config.get<string>('KEYCLOAK_URL');
    const realm = config.get<string>('KEYCLOAK_REALM');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
      issuer: `${keycloakUrl}/realms/${realm}`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { keycloakId: payload.preferred_username },
    });

    if (!user) {
      throw new UnauthorizedException('You are not allowed to access the app');
    }

    // Sync name and imageUrl from Keycloak user-info claim
    const userInfo = payload['user-info'];
    if (userInfo) {
      const blueprintUrl = this.config.get<string>('BLUEPRINT_URL') || '';
      const name = userInfo.usrNm ?? null;
      const email = userInfo.usrEml ?? '';
      const imageUrl = userInfo.imgUrl
        ? `${blueprintUrl}/upload/${userInfo.imgUrl.replace(/\\/g, '/')}`
        : null;

      if (user.name !== name || user.email !== email || user.imageUrl !== imageUrl) {
        return this.prisma.user.update({
          where: { id: user.id },
          data: { name, email, imageUrl },
        });
      }
    }

    return user;
  }
}
