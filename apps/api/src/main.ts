import 'reflect-metadata';
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
