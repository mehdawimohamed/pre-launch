import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// DATABASE_URL is required — no fallback. These tests are skipped when it is
// not set (local dev without a database). CI always provides it via the
// Postgres service container.
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('Database Integration Tests (Constraints, Deduplication, Cascades)', () => {
  let pool: Pool;
  let prisma: PrismaClient;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.event.deleteMany();
    await prisma.pushSubscription.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.aiEnhancementJob.deleteMany();
    await prisma.pledge.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Pledge Deduplication (UNIQUE constraint)', () => {
    it('rejects duplicate pledge from same user on the same campaign', async () => {
      const user = await prisma.user.create({
        data: {
          googleSub: 'sub-user-pledge-1',
          email: 'pledger@example.com',
          name: 'Pledger One',
        },
      });

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: user.id,
          slug: 'unique-pledge-test-campaign',
          title: 'Unique Pledge Test',
          pitch: 'Testing duplicate pledge rejection at database level.',
          category: 'tech',
          story: { content: 'test' },
          goalTnd: 1000,
          deadline: new Date(Date.now() + 100000),
        },
      });

      // First pledge succeeds
      await prisma.pledge.create({
        data: {
          userId: user.id,
          campaignId: campaign.id,
        },
      });

      // Second pledge from same user on same campaign MUST fail
      await expect(
        prisma.pledge.create({
          data: {
            userId: user.id,
            campaignId: campaign.id,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('CHECK Constraints Validation', () => {
    it('rejects user with invalid locale', async () => {
      await expect(
        prisma.user.create({
          data: {
            googleSub: 'sub-invalid-locale',
            email: 'badlocale@example.com',
            name: 'Bad Locale User',
            locale: 'es', // Only 'ar', 'fr', 'en' allowed
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects user with empty or oversized name', async () => {
      // Empty name
      await expect(
        prisma.user.create({
          data: {
            googleSub: 'sub-empty-name',
            email: 'emptyname@example.com',
            name: '',
          },
        }),
      ).rejects.toThrow();

      // Oversized name (>120 chars)
      await expect(
        prisma.user.create({
          data: {
            googleSub: 'sub-long-name',
            email: 'longname@example.com',
            name: 'A'.repeat(121),
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects campaign with non-positive goal_tnd', async () => {
      const user = await prisma.user.create({
        data: {
          googleSub: 'sub-goal-test',
          email: 'creator-goal@example.com',
          name: 'Goal Creator',
        },
      });

      await expect(
        prisma.campaign.create({
          data: {
            creatorId: user.id,
            slug: 'zero-goal-campaign',
            title: 'Zero Goal Campaign',
            pitch: 'Campaign with invalid non-positive goal target.',
            category: 'tech',
            story: {},
            goalTnd: 0, // CHECK constraint goal_tnd > 0
            deadline: new Date(Date.now() + 100000),
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects campaign with invalid slug pattern', async () => {
      const user = await prisma.user.create({
        data: {
          googleSub: 'sub-slug-test',
          email: 'creator-slug@example.com',
          name: 'Slug Creator',
        },
      });

      await expect(
        prisma.campaign.create({
          data: {
            creatorId: user.id,
            slug: 'Invalid_Slug_With_Uppercase!',
            title: 'Invalid Slug Campaign',
            pitch: 'Testing slug regex validation constraint.',
            category: 'tech',
            story: {},
            goalTnd: 500,
            deadline: new Date(Date.now() + 100000),
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects campaign with more than 5 external links', async () => {
      const user = await prisma.user.create({
        data: {
          googleSub: 'sub-links-test',
          email: 'creator-links@example.com',
          name: 'Links Creator',
        },
      });

      const sixLinks = [
        { label: '1', url: 'https://1.com' },
        { label: '2', url: 'https://2.com' },
        { label: '3', url: 'https://3.com' },
        { label: '4', url: 'https://4.com' },
        { label: '5', url: 'https://5.com' },
        { label: '6', url: 'https://6.com' },
      ];

      await expect(
        prisma.campaign.create({
          data: {
            creatorId: user.id,
            slug: 'six-links-campaign',
            title: 'Six Links Campaign',
            pitch: 'Campaign with too many external links attached.',
            category: 'tech',
            story: {},
            goalTnd: 500,
            deadline: new Date(Date.now() + 100000),
            links: sixLinks,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('Foreign Key Cascade Behavior', () => {
    it('deleting user cascades to sessions, pledges, and notifications', async () => {
      const creator = await prisma.user.create({
        data: {
          googleSub: 'sub-creator-cascade',
          email: 'cascade-creator@example.com',
          name: 'Cascade Creator',
        },
      });

      const backer = await prisma.user.create({
        data: {
          googleSub: 'sub-backer-cascade',
          email: 'cascade-backer@example.com',
          name: 'Cascade Backer',
        },
      });

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: creator.id,
          slug: 'cascade-test-campaign',
          title: 'Cascade Test Campaign',
          pitch: 'Testing foreign key cascade on user delete.',
          category: 'art',
          story: {},
          goalTnd: 1000,
          deadline: new Date(Date.now() + 100000),
        },
      });

      // Create session for backer
      await prisma.session.create({
        data: {
          idHash: Buffer.from('dummyhashforauthtesting1234567890'),
          userId: backer.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Create pledge from backer
      const pledge = await prisma.pledge.create({
        data: {
          userId: backer.id,
          campaignId: campaign.id,
        },
      });

      // Create notification for backer
      const notification = await prisma.notification.create({
        data: {
          userId: backer.id,
          type: 'welcome',
          payload: { welcome: true },
        },
      });

      // Delete backer user
      await prisma.user.delete({ where: { id: backer.id } });

      // Sessions, pledges, notifications of that user must be deleted (ON DELETE CASCADE)
      const sessions = await prisma.session.findMany({ where: { userId: backer.id } });
      const pledges = await prisma.pledge.findMany({ where: { id: pledge.id } });
      const notifications = await prisma.notification.findMany({ where: { id: notification.id } });

      expect(sessions).toHaveLength(0);
      expect(pledges).toHaveLength(0);
      expect(notifications).toHaveLength(0);
    });

    it('deleting creator user fails when creator has active campaigns (ON DELETE RESTRICT)', async () => {
      const creator = await prisma.user.create({
        data: {
          googleSub: 'sub-restrict-creator',
          email: 'restrict-creator@example.com',
          name: 'Restrict Creator',
        },
      });

      await prisma.campaign.create({
        data: {
          creatorId: creator.id,
          slug: 'restricted-campaign',
          title: 'Restricted Delete Campaign',
          pitch: 'Testing ON DELETE RESTRICT foreign key protection.',
          category: 'books',
          story: {},
          goalTnd: 2000,
          deadline: new Date(Date.now() + 100000),
        },
      });

      // Deleting creator must fail due to ON DELETE RESTRICT on campaigns.creator_id
      await expect(prisma.user.delete({ where: { id: creator.id } })).rejects.toThrow();
    });

    it('deleting campaign cascades to pledges', async () => {
      const creator = await prisma.user.create({
        data: {
          googleSub: 'sub-camp-casc-creator',
          email: 'camp-casc-creator@example.com',
          name: 'Campaign Cascade Creator',
        },
      });

      const backer = await prisma.user.create({
        data: {
          googleSub: 'sub-camp-casc-backer',
          email: 'camp-casc-backer@example.com',
          name: 'Campaign Cascade Backer',
        },
      });

      const campaign = await prisma.campaign.create({
        data: {
          creatorId: creator.id,
          slug: 'campaign-to-delete',
          title: 'Campaign To Delete',
          pitch: 'Testing pledge deletion on campaign cascade.',
          category: 'games',
          story: {},
          goalTnd: 5000,
          deadline: new Date(Date.now() + 100000),
        },
      });

      const pledge = await prisma.pledge.create({
        data: {
          userId: backer.id,
          campaignId: campaign.id,
        },
      });

      // Delete campaign
      await prisma.campaign.delete({ where: { id: campaign.id } });

      const pledges = await prisma.pledge.findMany({ where: { id: pledge.id } });
      expect(pledges).toHaveLength(0);
    });
  });
});

