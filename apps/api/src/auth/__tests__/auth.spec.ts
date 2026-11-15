import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Controller, Get, UseGuards } from '@nestjs/common';
import request from 'supertest';
import { parseCookie } from 'cookie';
import crypto from 'node:crypto';
import { configureApp } from '../../configure';
import { ConfigModule } from '../../config/config.module';
import { setTestConfig } from '../../config/env.config';
import { createLoggingModule } from '../../common/logging.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth.module';
import { AuthService } from '../auth.service';
import { GOOGLE_TOKEN_VERIFIER, GoogleTokenVerifier, GoogleTokenPayload } from '../google-verifier.interface';
import { AuthGuard, SESSION_COOKIE_NAME } from '../auth.guard';
import { RolesGuard } from '../roles.guard';
import { Roles } from '../roles.decorator';
import { CsrfGuard } from '../csrf.guard';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from '../../health/health.module';

@Controller('admin-test')
class AdminTestController {
  @Get('dashboard')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  getAdminDashboard() {
    return { status: 'admin_granted' };
  }
}

class MockGoogleVerifier implements GoogleTokenVerifier {
  public mockPayload: GoogleTokenPayload | null = null;
  public shouldThrow: Error | null = null;

  async verify(_idToken: string): Promise<GoogleTokenPayload> {
    if (this.shouldThrow) {
      throw this.shouldThrow;
    }
    if (!this.mockPayload) {
      throw new Error('No mock payload configured');
    }
    return this.mockPayload;
  }
}

describe('Authentication & Sessions E2E Tests (Step 1.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockVerifier: MockGoogleVerifier;
  let authService: AuthService;

  const TEST_ALLOWED_ORIGIN = 'http://localhost:3000';
  const ADMIN_EMAIL = 'admin@example.com';
  const USER_EMAIL = 'regular-user@example.com';
  const DB_URL =
    process.env.DATABASE_URL ??
    'postgres://pre-launch:6y_nlSJ1RgtL9eU3LmrjX1XeRHSQkLw9@localhost:5436/pre-launch';

  beforeAll(async () => {
    setTestConfig({
      NODE_ENV: 'test',
      PORT: 3001,
      DATABASE_URL: DB_URL,
      CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
      TRUST_TUNNEL_PROXY: false,
      THROTTLE_TTL_MS: 60000,
      THROTTLE_LIMIT: 100,
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      ADMIN_EMAILS: [ADMIN_EMAIL],
      SESSION_LIFETIME_SECONDS: 3600,
      COOKIE_SECURE_OVERRIDE: false, // allow asserting cookies in test environment
    });

    mockVerifier = new MockGoogleVerifier();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        createLoggingModule(),
        PrismaModule,
        HealthModule,
        AuthModule,
      ],
      controllers: [AdminTestController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: CsrfGuard,
        },
      ],
    })
      .overrideProvider(GOOGLE_TOKEN_VERIFIER)
      .useValue(mockVerifier)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    authService = moduleFixture.get(AuthService);
  });

  beforeEach(async () => {
    mockVerifier.mockPayload = null;
    mockVerifier.shouldThrow = null;

    // Clean up test users and sessions
    try {
      await prisma.session.deleteMany();
      await prisma.user.deleteMany();
    } catch {
      // ignore
    }
  });

  afterAll(async () => {
    try {
      await prisma.session.deleteMany();
      await prisma.user.deleteMany();
    } catch {
      // ignore
    }
    await app.close();
  });

  describe('POST /auth/google (Login & Token Verification)', () => {
    it('successfully logs in, upserts user with role=user, and sets secure HttpOnly cookie', async () => {
      mockVerifier.mockPayload = {
        sub: 'google-sub-12345',
        email: USER_EMAIL,
        email_verified: true,
        name: 'Regular User',
        picture: 'https://example.com/avatar.png',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'valid-google-id-token' });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: USER_EMAIL,
        name: 'Regular User',
        role: 'user',
      });

      // Verify Set-Cookie header
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieStr).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(cookieStr).toContain('Path=/');

      // Check DB persistence: session stored with SHA-256 hash, raw token never stored
      const parsed = parseCookie(cookieStr);
      const rawToken = parsed[SESSION_COOKIE_NAME];
      expect(rawToken).toBeDefined();
      expect(rawToken.length).toBe(64); // 32 bytes hex = 64 characters

      const expectedHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest();
      const sessionInDb = await prisma.session.findUnique({
        where: { idHash: expectedHash },
        include: { user: true },
      });

      expect(sessionInDb).toBeDefined();
      expect(sessionInDb?.user.email).toBe(USER_EMAIL);
      expect(sessionInDb?.revokedAt).toBeNull();
    });

    it('assigns role=admin when email is present in the admin allowlist', async () => {
      mockVerifier.mockPayload = {
        sub: 'google-sub-admin-999',
        email: ADMIN_EMAIL,
        email_verified: true,
        name: 'Admin Boss',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'valid-admin-token' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user.email).toBe(ADMIN_EMAIL);
    });

    it('asserts Secure cookie flag is present when COOKIE_SECURE_OVERRIDE=true or in production', async () => {
      setTestConfig({
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: DB_URL,
        CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
        TRUST_TUNNEL_PROXY: false,
        THROTTLE_TTL_MS: 60000,
        THROTTLE_LIMIT: 100,
        GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
        ADMIN_EMAILS: [ADMIN_EMAIL],
        SESSION_LIFETIME_SECONDS: 3600,
        COOKIE_SECURE_OVERRIDE: true,
      });

      mockVerifier.mockPayload = {
        sub: 'google-sub-secure',
        email: 'secure@example.com',
        email_verified: true,
      };

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieStr.toLowerCase()).toContain('secure');

      // Reset back to dev override
      setTestConfig({
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: DB_URL,
        CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
        TRUST_TUNNEL_PROXY: false,
        THROTTLE_TTL_MS: 60000,
        THROTTLE_LIMIT: 100,
        GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
        ADMIN_EMAILS: [ADMIN_EMAIL],
        SESSION_LIFETIME_SECONDS: 3600,
        COOKIE_SECURE_OVERRIDE: false,
      });
    });

    it('ignores COOKIE_SECURE_OVERRIDE=false when NODE_ENV is production (always Secure)', async () => {
      setTestConfig({
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: DB_URL,
        CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
        TRUST_TUNNEL_PROXY: false,
        THROTTLE_TTL_MS: 60000,
        THROTTLE_LIMIT: 100,
        GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
        ADMIN_EMAILS: [ADMIN_EMAIL],
        SESSION_LIFETIME_SECONDS: 3600,
        COOKIE_SECURE_OVERRIDE: false, // Must be ignored because NODE_ENV === 'production'
      });

      mockVerifier.mockPayload = {
        sub: 'google-sub-prod-secure',
        email: 'prod-secure@example.com',
        email_verified: true,
      };

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'valid-token' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(cookieStr.toLowerCase()).toContain('secure');

      // Reset back to dev override
      setTestConfig({
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: DB_URL,
        CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
        TRUST_TUNNEL_PROXY: false,
        THROTTLE_TTL_MS: 60000,
        THROTTLE_LIMIT: 100,
        GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
        ADMIN_EMAILS: [ADMIN_EMAIL],
        SESSION_LIFETIME_SECONDS: 3600,
        COOKIE_SECURE_OVERRIDE: false,
      });
    });

    it('recomputes role from ADMIN_EMAILS allowlist in both directions (promote and demote)', async () => {
      const targetEmail = 'demote-test@example.com';
      const targetSub = 'demote-test-sub';

      // 1. Initial login with email in ADMIN_EMAILS -> promoted to admin
      setTestConfig({
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: DB_URL,
        CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
        TRUST_TUNNEL_PROXY: false,
        THROTTLE_TTL_MS: 60000,
        THROTTLE_LIMIT: 100,
        GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
        ADMIN_EMAILS: [ADMIN_EMAIL, targetEmail],
        SESSION_LIFETIME_SECONDS: 3600,
        COOKIE_SECURE_OVERRIDE: false,
      });

      mockVerifier.mockPayload = {
        sub: targetSub,
        email: targetEmail,
        email_verified: true,
        name: 'Target User',
      };

      const login1 = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'token' });

      expect(login1.status).toBe(200);
      expect(login1.body.user.role).toBe('admin');

      const userAfterLogin1 = await prisma.user.findUnique({
        where: { googleSub: targetSub },
      });
      expect(userAfterLogin1?.role).toBe('admin');

      // 2. Remove email from ADMIN_EMAILS allowlist
      setTestConfig({
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: DB_URL,
        CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
        TRUST_TUNNEL_PROXY: false,
        THROTTLE_TTL_MS: 60000,
        THROTTLE_LIMIT: 100,
        GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
        ADMIN_EMAILS: [ADMIN_EMAIL], // targetEmail removed!
        SESSION_LIFETIME_SECONDS: 3600,
        COOKIE_SECURE_OVERRIDE: false,
      });

      // 3. Login again -> role recomputed to 'user' (demoted)
      const login2 = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'token' });

      expect(login2.status).toBe(200);
      expect(login2.body.user.role).toBe('user');

      const userAfterLogin2 = await prisma.user.findUnique({
        where: { googleSub: targetSub },
      });
      expect(userAfterLogin2?.role).toBe('user');
    });

    // Negative tests for Google ID token verification
    it('rejects invalid or unverified token', async () => {
      mockVerifier.shouldThrow = new Error('Invalid signature');

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Google authentication failed');
    });

    it('rejects token when email_verified is false', async () => {
      mockVerifier.shouldThrow = new Error('Google email is not verified');

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'unverified-email-token' });

      expect(res.status).toBe(401);
    });

    it('rejects token when audience does not match', async () => {
      mockVerifier.shouldThrow = new Error('Wrong recipient, payload audience != requiredAudience');

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'wrong-audience-token' });

      expect(res.status).toBe(401);
    });

    it('rejects expired token', async () => {
      mockVerifier.shouldThrow = new Error('Google ID token is expired');

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'expired-token' });

      expect(res.status).toBe(401);
    });
  });

  describe('CSRF Protection on Mutating Requests', () => {
    it('rejects mutating request with missing Origin and missing Referer', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ idToken: 'any-token' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Origin or Referer header required');
    });

    it('rejects mutating request from disallowed Origin', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', 'https://attacker.evil.com')
        .send({ idToken: 'any-token' });

      expect(res.status).toBe(500); // Caught and blocked by strict CORS allowlist
    });

    it('accepts safe GET request without Origin header', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /me (Session Authentication & Session States)', () => {
    it('returns 401 when no session cookie or token is provided', async () => {
      const res = await request(app.getHttpServer()).get('/me');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('returns current user profile when valid session cookie is provided', async () => {
      mockVerifier.mockPayload = {
        sub: 'google-sub-me-test',
        email: 'me-test@example.com',
        email_verified: true,
        name: 'Me User',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'valid-token' });

      const cookieHeader = loginRes.headers['set-cookie'];

      const meRes = await request(app.getHttpServer())
        .get('/me')
        .set('Cookie', cookieHeader);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user).toMatchObject({
        email: 'me-test@example.com',
        name: 'Me User',
        role: 'user',
      });
    });

    it('rejects expired sessions', async () => {
      // Create user and expired session in database
      const user = await prisma.user.create({
        data: {
          googleSub: 'expired-sub',
          email: 'expired@example.com',
          name: 'Expired User',
        },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const idHash = authService.hashToken(rawToken);

      await prisma.session.create({
        data: {
          idHash,
          userId: user.id,
          expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
        },
      });

      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired session');
    });

    it('rejects a valid session token sent via Bearer authorization header with 401 (cookies only)', async () => {
      const user = await prisma.user.create({
        data: {
          googleSub: 'bearer-sub',
          email: 'bearer@example.com',
          name: 'Bearer User',
        },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const idHash = authService.hashToken(rawToken);

      await prisma.session.create({
        data: {
          idHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000), // valid
        },
      });

      // Send token via Authorization: Bearer <token> without cookie
      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Authorization', `Bearer ${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('rejects revoked sessions', async () => {
      const user = await prisma.user.create({
        data: {
          googleSub: 'revoked-sub',
          email: 'revoked@example.com',
          name: 'Revoked User',
        },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const idHash = authService.hashToken(rawToken);

      await prisma.session.create({
        data: {
          idHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600000),
          revokedAt: new Date(), // revoked
        },
      });

      const res = await request(app.getHttpServer())
        .get('/me')
        .set('Cookie', `${SESSION_COOKIE_NAME}=${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired session');
    });
  });

  describe('POST /auth/logout (Revocation)', () => {
    it('revokes session in database and clears the session cookie', async () => {
      mockVerifier.mockPayload = {
        sub: 'google-sub-logout',
        email: 'logout@example.com',
        email_verified: true,
        name: 'Logout User',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'valid-token' });

      const cookieHeader = loginRes.headers['set-cookie'];
      const parsed = parseCookie(Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader);
      const rawToken = parsed[SESSION_COOKIE_NAME];

      // Logout request
      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookieHeader);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body).toEqual({ success: true });

      // Assert clear-cookie header
      const clearCookie = logoutRes.headers['set-cookie'];
      const clearStr = Array.isArray(clearCookie) ? clearCookie[0] : clearCookie;
      expect(clearStr).toContain(`${SESSION_COOKIE_NAME}=;`);
      expect(clearStr.toLowerCase()).toContain('httponly');

      // Assert DB state: revokedAt is now populated
      const idHash = authService.hashToken(rawToken);
      const sessionInDb = await prisma.session.findUnique({
        where: { idHash },
      });
      expect(sessionInDb?.revokedAt).toBeDefined();
      expect(sessionInDb?.revokedAt).not.toBeNull();

      // Subsequent /me request must fail with 401
      const meAfterLogout = await request(app.getHttpServer())
        .get('/me')
        .set('Cookie', cookieHeader);
      expect(meAfterLogout.status).toBe(401);
    });
  });

  describe('RolesGuard (Authorization)', () => {
    it('denies access (403) to non-admin users', async () => {
      mockVerifier.mockPayload = {
        sub: 'google-sub-regular',
        email: 'regular@example.com',
        email_verified: true,
        name: 'Regular Joe',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'token' });

      const cookieHeader = loginRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .get('/admin-test/dashboard')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied: required role admin');
    });

    it('allows access to admin users', async () => {
      mockVerifier.mockPayload = {
        sub: 'google-sub-admin-real',
        email: ADMIN_EMAIL,
        email_verified: true,
        name: 'Admin Boss',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ idToken: 'token' });

      const cookieHeader = loginRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .get('/admin-test/dashboard')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'admin_granted' });
    });
  });
});
