import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse } from '@pre-launch/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthCheckResponse {
    return { status: 'ok' };
  }
}
