import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { configureApp } from '../../configure';
import { HealthModule } from '../../health/health.module';
import { ConfigModule } from '../../config/config.module';
import { setTestConfig } from '../../config/env.config';
import { createLoggingModule } from '../logging.module';
import { AppThrottlerGuard } from '../throttler.guard';
import { TestEndpointsController } from '../test-endpoints.controller';

describe('API Foundation Integration & Security Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set explicit test config
    setTestConfig({
      NODE_ENV: 'production', // Test production error hiding
      PORT: 3001,
      DATABASE_URL: 'postgresql://postgres:postgrespassword@localhost:5432/crowdfunding_test?schema=public',
      CORS_ALLOWED_ORIGINS: ['https://allowed.example.com'],
      TRUST_TUNNEL_PROXY: false,
      THROTTLE_TTL_MS: 60000,
      THROTTLE_LIMIT: 3, // Low limit to test 429
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        createLoggingModule(),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 3,
          },
        ]),
        HealthModule,
      ],
      controllers: [TestEndpointsController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: AppThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CORS Enforcement (Positive & Negative)', () => {
    it('accepts requests with allowed Origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('Origin', 'https://allowed.example.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects requests from disallowed Origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('Origin', 'https://attacker.com');

      // Disallowed origin by cors middleware results in 500/InternalServerError via CORS callback Error
      expect(res.status).toBe(500);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Global ValidationPipe (Positive & Negative)', () => {
    it('accepts valid request payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-endpoints/validate')
        .send({ name: 'Valid Project' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ received: 'Valid Project' });
    });

    it('rejects payload with non-whitelisted property (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-endpoints/validate')
        .send({ name: 'Valid', maliciousField: 'hack' });

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('should not exist')]));
    });

    it('rejects payload missing required field', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-endpoints/validate')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toEqual(expect.arrayContaining([expect.stringContaining('name')]));
    });
  });

  describe('Rate Limiting & Throttler (429 with Retry-After)', () => {
    it('returns 429 Too Many Requests when limit is exceeded', async () => {
      // Limit is set to 3
      await request(app.getHttpServer()).get('/health');
      await request(app.getHttpServer()).get('/health');
      await request(app.getHttpServer()).get('/health');

      const fourthReq = await request(app.getHttpServer()).get('/health');
      expect(fourthReq.status).toBe(429);
      expect(fourthReq.headers['retry-after']).toBeDefined();
      expect(Number(fourthReq.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('Standard Error Shape & Stack Trace Suppression in Production', () => {
    it('returns standard error structure with NO stack trace when an exception is thrown in production', async () => {
      const res = await request(app.getHttpServer()).get('/test-endpoints/error-throw');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('statusCode', 500);
      expect(res.body).toHaveProperty('error', 'InternalServerError');
      expect(res.body).toHaveProperty('message', 'Internal server error');
      expect(res.body).toHaveProperty('path', '/test-endpoints/error-throw');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('Confidential database connection string');
    });
  });

  describe('Helmet Security Headers', () => {
    it('sets standard security headers', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
