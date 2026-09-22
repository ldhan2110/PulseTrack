import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Order matters: try the local HS256 'external-jwt' first (in-process verify, no
// network). It validates external tokens instantly and fails fast for Keycloak
// tokens, so the network+rate-limited JWKS 'jwt' strategy only runs for a real
// Keycloak token — instead of on every request, where its throttled key misses
// stalled external users on page load.
export class JwtAuthGuard extends AuthGuard(['external-jwt', 'jwt']) {}
