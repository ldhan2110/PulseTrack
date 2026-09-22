import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface ExternalJwtPayload {
  sub: string;
  userType?: string;
  typ?: string;
}

/**
 * PulseTrack-owned auth for EXTERNAL customers.
 * HS256, signed with EXTERNAL_JWT_SECRET, iss=pulsetrack — deliberately
 * separate signing material + issuer from the Keycloak RS256 strategy so
 * neither can validate the other's tokens (token-confusion defense).
 * Never touches Blueprint (external users have no Blueprint identity).
 */
@Injectable()
export class ExternalJwtStrategy extends PassportStrategy(Strategy, 'external-jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('EXTERNAL_JWT_SECRET') || '',
      issuer: 'pulsetrack',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: ExternalJwtPayload) {
    // Refresh tokens share the same secret + issuer as access tokens; they must
    // never authorize a guarded route — only /auth/refresh accepts them.
    if (payload.typ === 'refresh') {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    // Only EXTERNAL rows are reachable via this strategy — an internal user's
    // id must never resolve here even if a token is forged with the right secret.
    if (!user || user.userType !== 'EXTERNAL') {
      throw new UnauthorizedException();
    }

    return user;
  }
}
