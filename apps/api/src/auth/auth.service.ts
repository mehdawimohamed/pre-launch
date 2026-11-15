import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getConfig } from '../config/env.config';
import { GOOGLE_TOKEN_VERIFIER, GoogleTokenVerifier, GoogleTokenPayload } from './google-verifier.interface';
import { User, Prisma } from '@prisma/client';

export interface AuthSessionResult {
  rawToken: string;
  expiresAt: Date;
  user: User;
}

export type SessionWithUser = Prisma.SessionGetPayload<{ include: { user: true } }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GOOGLE_TOKEN_VERIFIER)
    private readonly googleVerifier: GoogleTokenVerifier,
  ) {}

  /**
   * Hashes a raw session token with SHA-256 into a Buffer.
   */
  hashToken(token: string): Buffer {
    return crypto.createHash('sha256').update(token, 'utf8').digest();
  }

  /**
   * Converts a Buffer to the exact Uint8Array<ArrayBuffer> required by Prisma 7 on TypeScript 5.7+.
   */
  private toPrismaBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
    return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) as Uint8Array<ArrayBuffer>;
  }

  /**
   * Verifies Google token, upserts User, determines admin role from allowlist, creates Session.
   */
  async loginWithGoogle(
    idToken: string,
    userAgent?: string,
  ): Promise<AuthSessionResult> {
    const config = getConfig();

    // 1. Verify token with Google verifier (real or mocked)
    let payload: GoogleTokenPayload;
    try {
      payload = await this.googleVerifier.verify(idToken);
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Token verification failed';
      throw new UnauthorizedException(`Google authentication failed: ${message}`);
    }

    // 2. Check if email is in the admin allowlist
    const normalizedEmail = payload.email.trim().toLowerCase();
    const isAdmin = config.ADMIN_EMAILS.includes(normalizedEmail);
    const assignedRole = isAdmin ? 'admin' : 'user';

    // 3. Upsert user by googleSub
    const userName = payload.name ?? payload.email.split('@')[0] ?? 'User';
    const user = await this.prisma.user.upsert({
      where: { googleSub: payload.sub },
      update: {
        email: normalizedEmail,
        name: userName,
        avatarUrl: payload.picture ?? null,
        lastLoginAt: new Date(),
        // If an existing user became admin in allowlist, promote; if removed, demote
        role: assignedRole,
      },
      create: {
        googleSub: payload.sub,
        email: normalizedEmail,
        name: userName,
        avatarUrl: payload.picture ?? null,
        locale: 'fr',
        role: assignedRole,
        lastLoginAt: new Date(),
      },
    });

    // 4. Generate cryptographically secure random session token (32 bytes = 256 bits hex)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const idHashBuf = this.hashToken(rawToken);
    const idHash = this.toPrismaBytes(idHashBuf);

    // 5. Calculate expiration time
    const expiresAt = new Date(Date.now() + config.SESSION_LIFETIME_SECONDS * 1000);

    // 6. Store session with hashed token only (never rawToken)
    await this.prisma.session.create({
      data: {
        idHash,
        userId: user.id,
        expiresAt,
        userAgent: userAgent ?? null,
      },
    });

    return {
      rawToken,
      expiresAt,
      user,
    };
  }

  /**
   * Validates a session by raw token. Returns user and session if valid, null otherwise.
   */
  async validateSession(rawToken: string): Promise<{ user: User; session: { idHash: Uint8Array<ArrayBuffer>; expiresAt: Date } } | null> {
    if (!rawToken || typeof rawToken !== 'string') {
      return null;
    }

    const idHashBuf = this.hashToken(rawToken);
    const idHash = this.toPrismaBytes(idHashBuf);

    const session = (await this.prisma.session.findUnique({
      where: { idHash },
      include: { user: true },
    })) as SessionWithUser | null;

    if (!session || !session.user) {
      return null;
    }

    // Check if revoked
    if (session.revokedAt !== null) {
      return null;
    }

    // Check if expired
    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      user: session.user,
      session: {
        idHash: session.idHash,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Revokes a session by setting revokedAt = now()
   */
  async revokeSession(rawToken: string): Promise<void> {
    if (!rawToken) {
      return;
    }
    const idHashBuf = this.hashToken(rawToken);
    const idHash = this.toPrismaBytes(idHashBuf);

    await this.prisma.session.updateMany({
      where: { idHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
