import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { ConfigModule } from './config/config.module';
import { getConfig } from './config/env.config';
import { createLoggingModule } from './common/logging.module';
import { AppThrottlerGuard } from './common/throttler.guard';

@Module({
  imports: [
    ConfigModule,
    createLoggingModule(),
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const config = getConfig();
        return {
          throttlers: [
            {
              ttl: config.THROTTLE_TTL_MS,
              limit: config.THROTTLE_LIMIT,
            },
          ],
        };
      },
    }),
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
