import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  slugify,
  OWNER_SUBMITTABLE_STATUSES,
  CampaignStatus,
} from '@pre-launch/shared';
import { Campaign, Prisma } from '@prisma/client';
import crypto from 'node:crypto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a collision-safe ASCII slug from title.
   * Capped at 80 characters total (matches DB CHECK constraint).
   */
  async generateUniqueSlug(title: string, excludeCampaignId?: string): Promise<string> {
    const baseSlug = slugify(title);

    let candidate = baseSlug;
    let attempt = 0;

    while (attempt < 10) {
      const existing = await this.prisma.campaign.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === excludeCampaignId) {
        return candidate;
      }

      attempt++;
      const randomSuffix = crypto.randomBytes(3).toString('hex'); // 6 chars
      const truncatedBase = baseSlug.slice(0, 72); // leave room for -xxxxxx
      candidate = `${truncatedBase}-${randomSuffix}`;
    }

    // High collision fallback
    const randomHex = crypto.randomBytes(6).toString('hex');
    return `campaign-${randomHex}`;
  }

  /**
   * Creates a draft campaign owned by the authenticated user.
   */
  async createDraft(userId: string, input: CreateCampaignInput): Promise<Campaign> {
    const slug = await this.generateUniqueSlug(input.title);

    return this.prisma.campaign.create({
      data: {
        creatorId: userId,
        slug,
        title: input.title,
        pitch: input.pitch,
        category: input.category,
        story: input.story as Prisma.InputJsonValue,
        goalTnd: input.goalTnd,
        deadline: input.deadline,
        teamInfo: input.teamInfo ?? null,
        links: (input.links ?? []) as unknown as Prisma.InputJsonValue,
        status: 'draft',
      },
    });
  }

  /**
   * Updates an existing campaign.
   * Owner-only authorization: only the creator can update.
   * Status restriction: only campaigns in 'draft' or 'rejected' status can be edited.
   */
  async update(userId: string, campaignId: string, input: UpdateCampaignInput): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.creatorId !== userId) {
      throw new ForbiddenException('You are not authorized to update this campaign');
    }

    if (campaign.status !== 'draft' && campaign.status !== 'rejected') {
      throw new BadRequestException(
        `Cannot edit campaign in "${campaign.status}" status. Only draft and rejected campaigns can be edited.`,
      );
    }

    let slug = campaign.slug;
    if (input.title && input.title !== campaign.title) {
      slug = await this.generateUniqueSlug(input.title, campaign.id);
    }

    const data: Prisma.CampaignUpdateInput = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      data.title = input.title;
      data.slug = slug;
    }
    if (input.pitch !== undefined) {
      data.pitch = input.pitch;
    }
    if (input.category !== undefined) {
      data.category = input.category;
    }
    if (input.story !== undefined) {
      data.story = input.story as Prisma.InputJsonValue;
    }
    if (input.goalTnd !== undefined) {
      data.goalTnd = input.goalTnd;
    }
    if (input.deadline !== undefined) {
      data.deadline = input.deadline;
    }
    if (input.teamInfo !== undefined) {
      data.teamInfo = input.teamInfo;
    }
    if (input.links !== undefined) {
      data.links = input.links as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data,
    });
  }

  /**
   * Submits a campaign for review.
   * Owner-only: only creator can submit.
   * Status transition: draft | rejected -> pending.
   */
  async submitForReview(userId: string, campaignId: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.creatorId !== userId) {
      throw new ForbiddenException('You are not authorized to submit this campaign');
    }

    if (!OWNER_SUBMITTABLE_STATUSES.includes(campaign.status as CampaignStatus)) {
      throw new BadRequestException(
        `Cannot submit campaign in "${campaign.status}" status. Only draft or rejected campaigns can be submitted for review.`,
      );
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'pending',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Lists campaigns created by the authenticated user.
   */
  async listMyCampaigns(userId: string): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
