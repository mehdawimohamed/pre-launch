import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateConfig, setTestConfig } from '../env.config';

describe('Config Module & env validation', () => {
  beforeEach(() => {
    setTestConfig(null);
  });

  afterEach(() => {
    setTestConfig(null);
  });

  it('fails fast on invalid values', () => {
    expect(() =>
      validateConfig({
        PORT: 'invalid-port-string',
      }),
    ).toThrow('[ConfigValidationError]');
  });

  it('fails fast on invalid NODE_ENV', () => {
    expect(() =>
      validateConfig({
        NODE_ENV: 'staging',
      }),
    ).toThrow('[ConfigValidationError]');
  });

  it('fails fast when DATABASE_URL is missing or empty', () => {
    expect(() =>
      validateConfig({
        PORT: '3001',
      }),
    ).toThrow('[ConfigValidationError]');

    expect(() =>
      validateConfig({
        DATABASE_URL: '',
      }),
    ).toThrow('[ConfigValidationError]');
  });

  it('applies defaults for optional fields when DATABASE_URL is provided', () => {
    const config = validateConfig({
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/testdb',
    });
    expect(config.DATABASE_URL).toBe('postgresql://postgres:pass@localhost:5432/testdb');
    expect(config.PORT).toBe(3001);
    expect(config.NODE_ENV).toBe('development');
    expect(config.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000']);
    expect(config.TRUST_TUNNEL_PROXY).toBe(false);
    expect(config.THROTTLE_LIMIT).toBe(60);
    expect(config.GOOGLE_CLIENT_ID).toBe('placeholder-google-client-id.apps.googleusercontent.com');
    expect(config.ADMIN_EMAILS).toEqual(['admin@example.com']);
    expect(config.SESSION_LIFETIME_SECONDS).toBe(604800);
    expect(config.COOKIE_SECURE_OVERRIDE).toBeUndefined();
  });

  it('parses comma-separated CORS origins into an exact allowlist', () => {
    const config = validateConfig({
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/testdb',
      CORS_ALLOWED_ORIGINS: 'https://prelaunch.tn, https://admin.prelaunch.tn',
    });
    expect(config.CORS_ALLOWED_ORIGINS).toEqual([
      'https://prelaunch.tn',
      'https://admin.prelaunch.tn',
    ]);
  });

  it('correctly enables TRUST_TUNNEL_PROXY only when explicitly true or 1', () => {
    const base = { DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/testdb' };
    expect(validateConfig({ ...base, TRUST_TUNNEL_PROXY: 'false' }).TRUST_TUNNEL_PROXY).toBe(false);
    expect(validateConfig({ ...base, TRUST_TUNNEL_PROXY: '0' }).TRUST_TUNNEL_PROXY).toBe(false);
    expect(validateConfig({ ...base, TRUST_TUNNEL_PROXY: 'true' }).TRUST_TUNNEL_PROXY).toBe(true);
    expect(validateConfig({ ...base, TRUST_TUNNEL_PROXY: '1' }).TRUST_TUNNEL_PROXY).toBe(true);
  });

  it('parses admin emails allowlist to normalized lowercase strings', () => {
    const config = validateConfig({
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/testdb',
      ADMIN_EMAILS: 'Admin@Prelaunch.tn, SuperAdmin@Example.com ',
    });
    expect(config.ADMIN_EMAILS).toEqual([
      'admin@prelaunch.tn',
      'superadmin@example.com',
    ]);
  });

  it('parses cookie secure override boolean values', () => {
    const base = { DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/testdb' };
    expect(validateConfig({ ...base, COOKIE_SECURE_OVERRIDE: 'false' }).COOKIE_SECURE_OVERRIDE).toBe(false);
    expect(validateConfig({ ...base, COOKIE_SECURE_OVERRIDE: 'true' }).COOKIE_SECURE_OVERRIDE).toBe(true);
    expect(validateConfig({ ...base, COOKIE_SECURE_OVERRIDE: '1' }).COOKIE_SECURE_OVERRIDE).toBe(true);
    expect(validateConfig({ ...base, COOKIE_SECURE_OVERRIDE: '0' }).COOKIE_SECURE_OVERRIDE).toBe(false);
  });
});
