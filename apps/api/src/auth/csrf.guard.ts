import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { getConfig } from '../config/env.config';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Safe, non-mutating HTTP methods do not require CSRF origin verification
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method)) {
      return true;
    }

    const config = getConfig();
    const origin = request.headers['origin'] as string | undefined;
    const referer = request.headers['referer'] as string | undefined;

    let requestOrigin: string | undefined = origin;

    if (!requestOrigin && referer) {
      try {
        const url = new URL(referer);
        requestOrigin = url.origin;
      } catch {
        // Malformed referer header
        throw new ForbiddenException('Invalid Referer header for state-changing request');
      }
    }

    // Mutating requests must have a valid Origin or Referer matching CORS_ALLOWED_ORIGINS
    if (!requestOrigin) {
      throw new ForbiddenException('Origin or Referer header required for state-changing request');
    }

    const isAllowed = config.CORS_ALLOWED_ORIGINS.includes(requestOrigin);
    if (!isAllowed) {
      throw new ForbiddenException(`Origin ${requestOrigin} not permitted for state-changing request`);
    }

    return true;
  }
}
