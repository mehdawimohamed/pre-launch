import { LoggerModule } from 'nestjs-pino';
import { getConfig } from '../config/env.config';

export function createLoggingModule() {
  const config = getConfig();
  const isProd = config.NODE_ENV === 'production';

  return LoggerModule.forRoot({
    pinoHttp: {
      level: isProd ? 'info' : 'debug',
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-access-token"]',
          'req.headers["x-refresh-token"]',
          'res.headers["set-cookie"]',
          '*.email',
          '*.token',
          '*.password',
          '*.secret',
        ],
        censor: '[REDACTED]',
      },
      transport:
        !isProd && process.env.NODE_ENV !== 'test'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
              },
            }
          : undefined,
    },
  });
}
