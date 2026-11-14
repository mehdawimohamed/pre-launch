import { Module } from '@nestjs/common';
import { getConfig, AppConfig } from './env.config';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => getConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
