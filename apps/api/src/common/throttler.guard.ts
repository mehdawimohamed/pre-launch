import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { getConfig } from '../config/env.config';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const expressReq = req as unknown as Request;
    const config = getConfig();

    // Trust CF-Connecting-IP ONLY when TRUST_TUNNEL_PROXY is enabled.
    // Otherwise, an untrusted client could spoof their IP via headers.
    if (config.TRUST_TUNNEL_PROXY) {
      const cfIp = expressReq.headers['cf-connecting-ip'];
      if (typeof cfIp === 'string' && cfIp.trim().length > 0) {
        return cfIp.trim();
      }
    }

    const socketIp = expressReq.socket?.remoteAddress;
    return socketIp ?? expressReq.ip ?? '127.0.0.1';
  }
}
