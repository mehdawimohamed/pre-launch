import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgrespassword@localhost:5432/crowdfunding_test?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding development database with fake data...');

  // Clean existing records (order matters due to foreign keys)
  await prisma.event.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.aiEnhancementJob.deleteMany();
  await prisma.pledge.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Users
  const creatorUser = await prisma.user.create({
    data: {
      googleSub: 'google-sub-dev-creator-12345',
      email: 'creator@example.com',
      name: 'Youssef Creator',
      avatarUrl: 'https://example.com/avatar/creator.png',
      locale: 'fr',
      role: 'user',
    },
  });

  const backerUser = await prisma.user.create({
    data: {
      googleSub: 'google-sub-dev-backer-67890',
      email: 'backer@example.com',
      name: 'Amira Backer',
      avatarUrl: 'https://example.com/avatar/backer.png',
      locale: 'ar',
      role: 'user',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      googleSub: 'google-sub-dev-admin-99999',
      email: 'admin@example.com',
      name: 'Admin User',
      avatarUrl: 'https://example.com/avatar/admin.png',
      locale: 'en',
      role: 'admin',
    },
  });

  // 2. Create Campaigns
  const campaignApproved = await prisma.campaign.create({
    data: {
      creatorId: creatorUser.id,
      slug: 'artisanal-olive-oil-tunisia',
      title: 'Artisanal Organic Olive Oil from Teboursouk',
      pitch: 'A family-owned organic olive grove crafting cold-pressed extra virgin olive oil.',
      category: 'agriculture',
      story: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Our mission is to bring sustainable organic olive oil to the world.' }],
          },
        ],
      },
      goalTnd: 25000,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days in future
      teamInfo: 'Founded by two agronomists passionate about high-quality Tunisian agriculture.',
      links: [
        { label: 'Website', url: 'https://example.com/olive' },
        { label: 'Instagram', url: 'https://instagram.com/oliveoil' },
      ],
      coverImageKey: 'uploads/fake-cover-image-1.webp',
      status: 'approved',
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      publishedAt: new Date(),
    },
  });

  const campaignPending = await prisma.campaign.create({
    data: {
      creatorId: creatorUser.id,
      slug: 'traditional-pottery-craft-nabeul',
      title: 'Reviving Ancient Ceramics in Nabeul',
      pitch: 'Empowering local master potters with modern solar-powered kilns.',
      category: 'crafts',
      story: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Handcrafted pottery with solar-powered production.' }],
          },
        ],
      },
      goalTnd: 15000,
      deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      teamInfo: 'Local artisanal guild of master potters.',
      links: [],
      status: 'pending',
    },
  });

  // 3. Create Pledge
  await prisma.pledge.create({
    data: {
      userId: backerUser.id,
      campaignId: campaignApproved.id,
    },
  });

  // 4. Create Notification
  await prisma.notification.create({
    data: {
      userId: creatorUser.id,
      type: 'milestone',
      payload: { milestone: 1, campaignId: campaignApproved.id },
      dedupeKey: `milestone:${campaignApproved.id}:1`,
    },
  });

  // 5. Create Event
  await prisma.event.create({
    data: {
      type: 'campaign_view',
      userId: backerUser.id,
      campaignId: campaignApproved.id,
      meta: { referrer: 'direct' },
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

