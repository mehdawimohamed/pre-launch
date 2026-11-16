import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { CampaignsService } from './campaigns.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createCampaignSchema,
  updateCampaignSchema,
  CreateCampaignInput,
  UpdateCampaignInput,
} from '@pre-launch/shared';

@Controller('campaigns')
@UseGuards(AuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createCampaignSchema))
  async createDraft(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCampaignInput,
  ) {
    const campaign = await this.campaignsService.createDraft(req.user.id, body);
    return { campaign };
  }

  @Get('my')
  async listMyCampaigns(@Req() req: AuthenticatedRequest) {
    const campaigns = await this.campaignsService.listMyCampaigns(req.user.id);
    return { campaigns };
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCampaignSchema)) body: UpdateCampaignInput,
  ) {
    const campaign = await this.campaignsService.update(req.user.id, id, body);
    return { campaign };
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  async submitForReview(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const campaign = await this.campaignsService.submitForReview(req.user.id, id);
    return { campaign };
  }
}
