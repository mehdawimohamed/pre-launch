import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { parseCookie, stringifySetCookie } from 'cookie';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AuthGuard, AuthenticatedRequest, SESSION_COOKIE_NAME } from './auth.guard';
import { getConfig } from '../config/env.config';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private isCookieSecure(): boolean {
    const config = getConfig();
    if (config.COOKIE_SECURE_OVERRIDE !== undefined) {
      return config.COOKIE_SECURE_OVERRIDE;
    }
    return config.NODE_ENV === 'production';
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  // Strict rate limit on login endpoint: 10 attempts per minute
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const { rawToken, expiresAt, user } = await this.authService.loginWithGoogle(
      dto.idToken,
      userAgent,
    );

    const isSecure = this.isCookieSecure();
    const config = getConfig();

    // Set HttpOnly; Secure; SameSite=Lax cookie
    const cookieHeader = stringifySetCookie({
      name: SESSION_COOKIE_NAME,
      value: rawToken,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
      maxAge: config.SESSION_LIFETIME_SECONDS,
    });

    res.setHeader('Set-Cookie', cookieHeader);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        role: user.role,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieHeader = req.headers.cookie;
    let rawToken: string | undefined;

    if (cookieHeader) {
      const parsed = parseCookie(cookieHeader);
      rawToken = parsed[SESSION_COOKIE_NAME];
    }

    if (!rawToken && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        rawToken = parts[1];
      }
    }

    if (rawToken) {
      await this.authService.revokeSession(rawToken);
    }

    const isSecure = this.isCookieSecure();

    // Clear cookie
    const clearCookieHeader = stringifySetCookie({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    });

    res.setHeader('Set-Cookie', clearCookieHeader);

    return { success: true };
  }
}

@Controller()
export class MeController {
  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
}
