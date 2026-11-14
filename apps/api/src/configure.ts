import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { getConfig } from './config/env.config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

export function configureApp(app: INestApplication): void {
  const config = getConfig();

  // 1. Logger
  app.useLogger(app.get(Logger));

  // 2. Helmet security headers
  app.use(helmet());

  // 3. Strict CORS with exact origin allowlist (never wildcard) and credentials
  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. server-to-server or curl)
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (config.CORS_ALLOWED_ORIGINS.includes(requestOrigin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // 4. Global ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5. Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());
}
