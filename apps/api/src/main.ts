import 'reflect-metadata';
import path from 'node:path';
import fs from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConfig, validateConfig } from './config/env.config';
import { configureApp } from './configure';

async function bootstrap() {
  // Load root .env (two levels up from apps/api/src → repo root)
  const rootEnv = path.resolve(__dirname, '..', '..', '..', '.env');
  if (fs.existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }

  // Fail fast immediately on invalid/missing environment variables
  validateConfig();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);

  const config = getConfig();
  await app.listen(config.PORT);
}

void bootstrap();
