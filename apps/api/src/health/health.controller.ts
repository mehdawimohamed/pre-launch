import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse } from '@crowdfunding/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthCheckResponse {
    return { status: 'ok' };
  }
}

