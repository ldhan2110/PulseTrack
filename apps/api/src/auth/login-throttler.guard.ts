import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits POST /auth/login per IP + email (5 / 60s → 429). Keying on the
 * email as well as the IP means one attacker can't lock out every account from
 * behind a shared NAT, and one account can't be hammered from one IP.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = Array.isArray(req.ips) && req.ips.length ? req.ips[0] : req.ip;
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    return `login:${ip}:${email}`;
  }
}
