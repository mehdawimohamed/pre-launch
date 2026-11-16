import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import crypto from 'node:crypto';
import { configureApp } from '../../configure';
import { ConfigModule } from '../../config/config.module';
import { setTestConfig } from '../../config/env.config';
import { createLoggingModule } from '../../common/logging.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../../auth/auth.module';
import { AuthService } from '../../auth/auth.service';
import {
  GOOGLE_TOKEN_VERIFIER,
  GoogleTokenVerifier,
  GoogleTokenPayload,
} from '../../auth/google-verifier.interface';
import { CampaignsModule } from '../campaigns.module';
import { CsrfGuard } from '../../auth/csrf.guard';
import { APP_GUARD } from '@nestjs/core';
import { SESSION_COOKIE_NAME } from '../../auth/auth.guard';

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

describe('Campaign API E2E Tests (Step 2.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockVerifier: MockGoogleVerifier;
  let authService: AuthService;

  const TEST_ALLOWED_ORIGIN = 'http://localhost:3000';
  const DB_URL =
    process.env.DATABASE_URL ??
    'postgres://pre-launch:6y_nlSJ1RgtL9eU3LmrjX1XeRHSQkLw9@localhost:5436/pre-launch';

  const validStory = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Valid campaign rich text story description.',
          },
        ],
      },
    ],
  };

  const getFutureDate = (daysAhead = 30) =>
    new Date(Date.now() + 86400000 * daysAhead).toISOString();

  // Helper to log in a user and return cookie
  async function createAuthenticatedUser(email: string, name: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const idHashBuf = authService.hashToken(rawToken);
    const idHash = new Uint8Array(
      idHashBuf.buffer.slice(idHashBuf.byteOffset, idHashBuf.byteOffset + idHashBuf.byteLength),
    ) as Uint8Array<ArrayBuffer>;

    const user = await prisma.user.create({
      data: {
        googleSub: `sub-${email}`,
        email,
        name,
        locale: 'fr',
        role: 'user',
      },
    });

    await prisma.session.create({
      data: {
        idHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const cookie = `${SESSION_COOKIE_NAME}=${rawToken}`;
    return { user, cookie, rawToken };
  }

  beforeAll(async () => {
    setTestConfig({
      NODE_ENV: 'test',
      PORT: 3001,
      DATABASE_URL: DB_URL,
      CORS_ALLOWED_ORIGINS: [TEST_ALLOWED_ORIGIN],
      TRUST_TUNNEL_PROXY: false,
      THROTTLE_TTL_MS: 60000,
      THROTTLE_LIMIT: 200,
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      ADMIN_EMAILS: ['admin@example.com'],
      SESSION_LIFETIME_SECONDS: 3600,
      COOKIE_SECURE_OVERRIDE: false,
    });

    mockVerifier = new MockGoogleVerifier();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        createLoggingModule(),
        PrismaModule,
        AuthModule,
        CampaignsModule,
      ],
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
    try {
      await prisma.campaign.deleteMany();
      await prisma.session.deleteMany();
      await prisma.user.deleteMany();
    } catch {
      // ignore
    }
  });

  afterAll(async () => {
    try {
      await prisma.campaign.deleteMany();
      await prisma.session.deleteMany();
      await prisma.user.deleteMany();
    } catch {
      // ignore
    }
    await app.close();
  });

  describe('Authentication Enforcement (All Endpoints)', () => {
    it('rejects unauthenticated requests to POST /campaigns with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({
          title: 'My Campaign',
          pitch: 'A good pitch for testing unauthenticated access.',
          category: 'art',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('rejects unauthenticated requests to GET /campaigns/my with 401', async () => {
      const res = await request(app.getHttpServer()).get('/campaigns/my');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated requests to PATCH /campaigns/:id with 401', async () => {
      const res = await request(app.getHttpServer())
        .patch('/campaigns/00000000-0000-0000-0000-000000000000')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .send({ title: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated requests to POST /campaigns/:id/submit with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/campaigns/00000000-0000-0000-0000-000000000000/submit')
        .set('Origin', TEST_ALLOWED_ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /campaigns (Create Draft & Slug Handling)', () => {
    it('creates a draft campaign with safe ASCII slug generated from English title', async () => {
      const { user, cookie } = await createAuthenticatedUser('creator1@example.com', 'Creator One');

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Eco Innovation Project In Sousse',
          pitch: 'An eco-friendly waste management initiative in Tunisia.',
          category: 'technology',
          story: validStory,
          goalTnd: 12000,
          deadline: getFutureDate(45),
          teamInfo: 'Engineers from ENIT',
          links: [{ label: 'Official Site', url: 'https://eco-sousse.tn' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.campaign).toMatchObject({
        title: 'Eco Innovation Project In Sousse',
        slug: 'eco-innovation-project-in-sousse',
        category: 'technology',
        status: 'draft',
        creatorId: user.id,
        goalTnd: 12000,
      });

      const inDb = await prisma.campaign.findUnique({
        where: { id: res.body.campaign.id },
      });
      expect(inDb).toBeDefined();
      expect(inDb?.status).toBe('draft');
      expect(inDb?.slug).toBe('eco-innovation-project-in-sousse');
    });

    it('generates transliterated safe ASCII slug from Arabic title', async () => {
      const { cookie } = await createAuthenticatedUser('creator_ar@example.com', 'Arabic Creator');

      const arabicTitle = 'مشروع تكنولوجيا نظيفة في تونس';
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: arabicTitle,
          pitch: 'وصف قصير للمشروع التكنولوجي الجديد بتونس.',
          category: 'technology',
          story: validStory,
          goalTnd: 5000,
          deadline: getFutureDate(),
        });

      expect(res.status).toBe(201);
      expect(res.body.campaign.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(res.body.campaign.slug.length).toBeLessThanOrEqual(80);
    });

    it('handles slug collisions cleanly by appending a unique suffix', async () => {
      const { cookie } = await createAuthenticatedUser('collision@example.com', 'Collision Tester');

      const payload = {
        title: 'Duplicate Title Test',
        pitch: 'Pitch for first campaign with this title.',
        category: 'games',
        story: validStory,
        goalTnd: 1000,
        deadline: getFutureDate(),
      };

      const res1 = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.campaign.slug).toBe('duplicate-title-test');

      const res2 = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body.campaign.slug).toMatch(/^duplicate-title-test-[a-z0-9]{6}$/);
      expect(res2.body.campaign.slug).not.toBe(res1.body.campaign.slug);
    });

    // Validation negative tests
    it('rejects title shorter than 5 chars (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val1@example.com', 'Val User');

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Tiny',
          pitch: 'A sufficiently long pitch for testing title length.',
          category: 'art',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Title must be at least 5 characters');
    });

    it('rejects pitch shorter than 10 or longer than 280 chars (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val2@example.com', 'Val User');

      const resShort = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Too short',
          category: 'art',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
        });

      expect(resShort.status).toBe(400);

      const resLong = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'x'.repeat(281),
          category: 'art',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
        });

      expect(resLong.status).toBe(400);
    });

    it('rejects invalid category (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val3@example.com', 'Val User');

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for this category test.',
          category: 'non-existent-category',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
        });

      expect(res.status).toBe(400);
    });

    it('rejects goalTnd <= 0 (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val4@example.com', 'Val User');

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for this goal test.',
          category: 'community',
          story: validStory,
          goalTnd: 0,
          deadline: getFutureDate(),
        });

      expect(res.status).toBe(400);
    });

    it('rejects deadline in the past (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val5@example.com', 'Val User');

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for this deadline test.',
          category: 'design',
          story: validStory,
          goalTnd: 1000,
          deadline: new Date(Date.now() - 3600000).toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('rejects non-http(s) link schemes like javascript: and data: (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val6@example.com', 'Val User');

      const resJs = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for this malicious link test.',
          category: 'design',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
          links: [{ label: 'Evil Link', url: 'javascript:alert(document.cookie)' }],
        });

      expect(resJs.status).toBe(400);

      const resData = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for this data link test.',
          category: 'design',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
          links: [{ label: 'Data URI', url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' }],
        });

      expect(resData.status).toBe(400);
    });

    it('rejects more than 5 links (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val7@example.com', 'Val User');

      const links = Array.from({ length: 6 }).map((_, i) => ({
        label: `Link ${i}`,
        url: `https://example.com/${i}`,
      }));

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for this links limit test.',
          category: 'games',
          story: validStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
          links,
        });

      expect(res.status).toBe(400);
    });

    it('rejects disallowed story node types (e.g. script, iframe, rawHtml) (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val8@example.com', 'Val User');

      const disallowedNodeStory = {
        type: 'doc',
        content: [
          {
            type: 'rawHtml',
            content: '<script>alert(1)</script>',
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for disallowed story node test.',
          category: 'food',
          story: disallowedNodeStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('disallowed node type');
    });

    it('rejects story marks containing javascript: links (400)', async () => {
      const { cookie } = await createAuthenticatedUser('val9@example.com', 'Val User');

      const maliciousLinkStory = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click here for free reward',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'javascript:void(0)' },
                  },
                ],
              },
            ],
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Valid Campaign Title',
          pitch: 'Valid pitch for malicious story link test.',
          category: 'fashion',
          story: maliciousLinkStory,
          goalTnd: 1000,
          deadline: getFutureDate(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('link href must be http(s)');
    });
  });

  describe('PATCH /campaigns/:id (Owner Authorization & Status Rules)', () => {
    it('allows owner to update draft campaign', async () => {
      const { user, cookie } = await createAuthenticatedUser('owner_patch@example.com', 'Owner');

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: user.id,
          slug: 'original-slug',
          title: 'Original Title',
          pitch: 'Original pitch for the campaign.',
          category: 'art',
          story: validStory,
          goalTnd: 3000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'draft',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Updated Campaign Title',
          pitch: 'Updated pitch for the campaign now.',
          goalTnd: 4500,
        });

      expect(res.status).toBe(200);
      expect(res.body.campaign.title).toBe('Updated Campaign Title');
      expect(res.body.campaign.goalTnd).toBe(4500);

      const inDb = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      expect(inDb?.title).toBe('Updated Campaign Title');
      expect(inDb?.goalTnd).toBe(4500);
    });

    it('allows owner to update rejected campaign', async () => {
      const { user, cookie } = await createAuthenticatedUser('owner_rej@example.com', 'Owner');

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: user.id,
          slug: 'rejected-campaign',
          title: 'Rejected Campaign Title',
          pitch: 'Pitch that was initially rejected by admin.',
          category: 'publishing',
          story: validStory,
          goalTnd: 3000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'rejected',
          rejectionReason: 'Need more team details',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          teamInfo: 'Team info has now been added in detail.',
        });

      expect(res.status).toBe(200);
      expect(res.body.campaign.teamInfo).toBe('Team info has now been added in detail.');
    });

    it('rejects editing someone else\'s campaign with 403 (Negative Test: Authorization)', async () => {
      const { user: userA } = await createAuthenticatedUser('user_a@example.com', 'User A');
      const { cookie: cookieB } = await createAuthenticatedUser('user_b@example.com', 'User B');

      const campaignA = await prisma.campaign.create({
        data: {
          creatorId: userA.id,
          slug: 'user-a-campaign',
          title: 'User A Campaign',
          pitch: 'Pitch created by user A exclusively.',
          category: 'technology',
          story: validStory,
          goalTnd: 5000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'draft',
        },
      });

      // User B attempts to edit User A's campaign
      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaignA.id}`)
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookieB)
        .send({ title: 'Hacked Title By User B' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('You are not authorized to update this campaign');

      // Verify DB unchanged
      const unchanged = await prisma.campaign.findUnique({ where: { id: campaignA.id } });
      expect(unchanged?.title).toBe('User A Campaign');
    });

    it('rejects editing campaign when status is pending, approved, or unpublished with 400', async () => {
      const { user, cookie } = await createAuthenticatedUser('status_owner@example.com', 'Owner');

      for (const nonEditableStatus of ['pending', 'approved', 'unpublished']) {
        const campaign = await prisma.campaign.create({
          data: {
            creatorId: user.id,
            slug: `campaign-status-${nonEditableStatus}`,
            title: `Campaign in ${nonEditableStatus}`,
            pitch: 'Pitch for non-editable status check.',
            category: 'art',
            story: validStory,
            goalTnd: 2000,
            deadline: new Date(Date.now() + 86400000 * 20),
            status: nonEditableStatus,
          },
        });

        const res = await request(app.getHttpServer())
          .patch(`/campaigns/${campaign.id}`)
          .set('Origin', TEST_ALLOWED_ORIGIN)
          .set('Cookie', cookie)
          .send({ title: 'Attempted Title Change' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(`Cannot edit campaign in "${nonEditableStatus}" status`);
      }
    });

    it('rejects attempt by client to change status via PATCH payload (strips or ignores client status)', async () => {
      const { user, cookie } = await createAuthenticatedUser('client_status@example.com', 'Owner');

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: user.id,
          slug: 'client-status-test',
          title: 'Client Status Test',
          pitch: 'Pitch for client status test.',
          category: 'art',
          story: validStory,
          goalTnd: 2000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'draft',
        },
      });

      // Attempt to self-approve via PATCH body
      const res = await request(app.getHttpServer())
        .patch(`/campaigns/${campaign.id}`)
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie)
        .send({
          title: 'Updated Title',
          status: 'approved', // Client trying to set status directly!
        });

      expect(res.status).toBe(200);
      expect(res.body.campaign.status).toBe('draft'); // Remains draft

      const inDb = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      expect(inDb?.status).toBe('draft');
    });
  });

  describe('POST /campaigns/:id/submit (Status Transitions & Authorization)', () => {
    it('successfully submits a draft campaign for review (draft -> pending)', async () => {
      const { user, cookie } = await createAuthenticatedUser('submitter1@example.com', 'Submitter');

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: user.id,
          slug: 'draft-to-submit',
          title: 'Ready for Review',
          pitch: 'Pitch that is ready to be submitted for review.',
          category: 'education',
          story: validStory,
          goalTnd: 8000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'draft',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/submit`)
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.campaign.status).toBe('pending');

      const inDb = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      expect(inDb?.status).toBe('pending');
    });

    it('successfully resubmits a rejected campaign for review (rejected -> pending)', async () => {
      const { user, cookie } = await createAuthenticatedUser('submitter2@example.com', 'Submitter');

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: user.id,
          slug: 'rejected-to-resubmit',
          title: 'Fixed Campaign',
          pitch: 'Pitch that was fixed after rejection.',
          category: 'education',
          story: validStory,
          goalTnd: 8000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'rejected',
          rejectionReason: 'Please fix pitch',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/submit`)
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.campaign.status).toBe('pending');
    });

    it('rejects submitting someone else\'s campaign with 403 (Negative Test: Authorization)', async () => {
      const { user: userA } = await createAuthenticatedUser('user_sub_a@example.com', 'User A');
      const { cookie: cookieB } = await createAuthenticatedUser('user_sub_b@example.com', 'User B');

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: userA.id,
          slug: 'user-a-sub-test',
          title: 'User A Sub Campaign',
          pitch: 'Pitch by User A for submit test.',
          category: 'education',
          story: validStory,
          goalTnd: 8000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'draft',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/campaigns/${campaign.id}/submit`)
        .set('Origin', TEST_ALLOWED_ORIGIN)
        .set('Cookie', cookieB);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('You are not authorized to submit this campaign');

      const inDb = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      expect(inDb?.status).toBe('draft');
    });

    it('rejects invalid status transitions (e.g. pending, approved, unpublished -> pending) with 400', async () => {
      const { user, cookie } = await createAuthenticatedUser('invalid_transition@example.com', 'Owner');

      for (const invalidInitialStatus of ['pending', 'approved', 'unpublished']) {
        const campaign = await prisma.campaign.create({
          data: {
            creatorId: user.id,
            slug: `campaign-transition-${invalidInitialStatus}`,
            title: `Campaign in ${invalidInitialStatus}`,
            pitch: 'Pitch for invalid transition check.',
            category: 'other',
            story: validStory,
            goalTnd: 1000,
            deadline: new Date(Date.now() + 86400000 * 20),
            status: invalidInitialStatus,
          },
        });

        const res = await request(app.getHttpServer())
          .post(`/campaigns/${campaign.id}/submit`)
          .set('Origin', TEST_ALLOWED_ORIGIN)
          .set('Cookie', cookie);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain(`Cannot submit campaign in "${invalidInitialStatus}" status`);
      }
    });
  });

  describe('GET /campaigns/my (List Creator Campaigns)', () => {
    it('returns all campaigns owned by the authenticated creator, ordered newest first', async () => {
      const { user: user1, cookie: cookie1 } = await createAuthenticatedUser('list1@example.com', 'User 1');
      const { user: user2 } = await createAuthenticatedUser('list2@example.com', 'User 2');

      // Create 2 campaigns for User 1 with different timestamps
      const camp1 = await prisma.campaign.create({
        data: {
          creatorId: user1.id,
          slug: 'camp-1',
          title: 'First Campaign',
          pitch: 'Pitch 1 for listing test.',
          category: 'art',
          story: validStory,
          goalTnd: 1000,
          deadline: new Date(Date.now() + 86400000 * 10),
          status: 'draft',
          createdAt: new Date(Date.now() - 10000),
        },
      });

      const camp2 = await prisma.campaign.create({
        data: {
          creatorId: user1.id,
          slug: 'camp-2',
          title: 'Second Campaign (Newer)',
          pitch: 'Pitch 2 for listing test.',
          category: 'games',
          story: validStory,
          goalTnd: 2000,
          deadline: new Date(Date.now() + 86400000 * 15),
          status: 'pending',
          createdAt: new Date(),
        },
      });

      // Create 1 campaign for User 2 (should not appear in User 1's list)
      await prisma.campaign.create({
        data: {
          creatorId: user2.id,
          slug: 'camp-user-2',
          title: 'User 2 Campaign',
          pitch: 'Pitch for user 2.',
          category: 'music',
          story: validStory,
          goalTnd: 3000,
          deadline: new Date(Date.now() + 86400000 * 20),
          status: 'draft',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/campaigns/my')
        .set('Cookie', cookie1);

      expect(res.status).toBe(200);
      expect(res.body.campaigns).toHaveLength(2);
      expect(res.body.campaigns[0].id).toBe(camp2.id); // Newer first
      expect(res.body.campaigns[1].id).toBe(camp1.id);
      expect(res.body.campaigns.some((c: { slug: string }) => c.slug === 'camp-user-2')).toBe(false);
    });

    it('returns empty list when user has no campaigns', async () => {
      const { cookie } = await createAuthenticatedUser('empty_user@example.com', 'Empty User');

      const res = await request(app.getHttpServer())
        .get('/campaigns/my')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.campaigns).toEqual([]);
    });
  });
});
