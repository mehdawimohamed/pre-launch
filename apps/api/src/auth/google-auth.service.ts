import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { getConfig } from '../config/env.config';
import { GoogleTokenPayload, GoogleTokenVerifier } from './google-verifier.interface';

@Injectable()
export class GoogleAuthService implements GoogleTokenVerifier {
  private client: OAuth2Client;

  constructor() {
    const config = getConfig();
    this.client = new OAuth2Client(config.GOOGLE_CLIENT_ID);
  }

  async verify(idToken: string): Promise<GoogleTokenPayload> {
    const config = getConfig();
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google ID token payload');
      }

      // 1. Validate issuer
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!payload.iss || !validIssuers.includes(payload.iss)) {
        throw new UnauthorizedException(`Invalid token issuer: ${payload.iss}`);
      }

      // 2. Validate email and email_verified
      if (!payload.email) {
        throw new UnauthorizedException('Token payload does not contain an email');
      }

      if (!payload.email_verified) {
        throw new UnauthorizedException('Google email is not verified');
      }

      // 3. Validate expiration
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (!payload.exp || payload.exp < nowInSeconds) {
        throw new UnauthorizedException('Google ID token is expired');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Token verification failed';
      throw new UnauthorizedException(`Google authentication failed: ${message}`);
    }
  }
}
