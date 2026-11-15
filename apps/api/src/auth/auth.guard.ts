import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { parseCookie } from 'cookie';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'session_token';

export interface AuthenticatedRequest extends Request {
  user: User;
  sessionToken: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Parse cookie from Cookie header (sessions are read ONLY from the session cookie)
    const cookieHeader = request.headers.cookie;
    let rawToken: string | undefined;

    if (cookieHeader) {
      const parsedCookies = parseCookie(cookieHeader);
      rawToken = parsedCookies[SESSION_COOKIE_NAME];
    }

    if (!rawToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const validation = await this.authService.validateSession(rawToken);
    if (!validation) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Attach user and session token to request
    request.user = validation.user;
    request.sessionToken = rawToken;

    return true;
  }
}
