import 'reflect-metadata';
import path from 'node:path';
import fs from 'node:fs';

// Load root .env BEFORE any application imports.
// AppModule's decorator calls getConfig() at import time (e.g. createLoggingModule),
// so process.env must already be populated before those imports execute.
const rootEnv = path.resolve(__dirname, '..', '..', '..', '.env');
if (fs.existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConfig, validateConfig } from './config/env.config';
import { configureApp } from './configure';

async function bootstrap() {
  // Fail fast immediately on invalid/missing environment variables
  validateConfig();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);

  const config = getConfig();
  await app.listen(config.PORT);
}

void bootstrap();
