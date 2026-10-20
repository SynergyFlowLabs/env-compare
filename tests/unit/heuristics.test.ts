import { describe, expect, it } from 'vitest';
import {
  isHighConfidencePlaceholder,
  isLowConfidencePlaceholder,
  isSecretKey,
  isSecretValue,
  looksLikeLiveCredential,
  looksLikeSecret,
} from '../../src/core/compare';

describe('placeholder detection — high confidence', () => {
  it.each([
    'changeme',
    'CHANGE_ME',
    'replace_me',
    'todo',
    '...',
    'your-api-key-here',
    'your_token',
    'your-project-ref',
    '<YOUR_KEY>',
    '{{API_KEY}}',
    '[INSERT_TOKEN]',
    '__SECRET__',
    '<ADD_YOUR_KEY>',
    'INSERT_KEY_HERE',
    '${SOME_VAR}',
    '$SOME_VAR',
    'sk_test_xxxxxxxxxxxx',
    're_xxxxxxxxxxxx',
    'xxxxxxxx',
    '00000000',
  ])('flags %s', (value) => {
    expect(isHighConfidencePlaceholder(value)).toBe(true);
  });

  it.each([
    // Real values that must never be reported as placeholders (PRD §12.9).
    'postgresql://user:password@localhost:5432/app',
    'true',
    'false',
    '0',
    '3000',
    'production',
    'development',
    'sk_live_51HabcDEF123456',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
    'https://example.supabase.co',
    'UA-000000-2',
    'hello world',
    'a3f9c2b1e8',
    'localhost:3000',
    '',
  ])('does not flag %s', (value) => {
    expect(isHighConfidencePlaceholder(value)).toBe(false);
  });

  it('treats low-confidence words as hints only', () => {
    expect(isHighConfidencePlaceholder('test')).toBe(false);
    expect(isLowConfidencePlaceholder('test')).toBe(true);
    expect(isLowConfidencePlaceholder('dummy')).toBe(true);
    expect(isLowConfidencePlaceholder('production')).toBe(false);
  });
});

describe('secret detection', () => {
  it.each([
    'STRIPE_SECRET_KEY',
    'OPENAI_API_KEY',
    'GITHUB_TOKEN',
    'DB_PASSWORD',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'CLIENT_SECRET',
    'SENTRY_DSN',
    'AWS_ACCESS_KEY_ID',
    'JWT_SIGNING_SALT',
  ])('treats %s as a sensitive key name', (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each(['PORT', 'NODE_ENV', 'NEXT_PUBLIC_SITE_URL', 'DEBUG', 'APP_TITLE', 'MAX_UPLOAD_MB'])(
    'does not treat %s as a sensitive key name',
    (key) => {
      expect(isSecretKey(key)).toBe(false);
    },
  );

  // A real Google API key is `AIza` + exactly 35 chars; the length matters to
  // the boundary in the pattern, so the fixture is built rather than typed.
  const googleKey = 'AIza' + 'x'.repeat(35);

  it.each([
    'sk_live_51HabcDEF1234567890',
    'ghp_1234567890abcdefABCDEF1234567890abcd',
    'AKIAIOSFODNN7EXAMPLE',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...',
    'postgres://user:s3cret@db.example.com:5432/app',
    'xoxb-1234567890-abcdefghijkl',
    googleKey,
  ])('recognises a credential-shaped value: %s', (value) => {
    expect(isSecretValue(value)).toBe(true);
  });

  it.each([
    'production',
    '3000',
    'https://example.com',
    'postgres://localhost/app',
    'a short string',
    'true',
  ])('does not treat %s as a credential value', (value) => {
    expect(isSecretValue(value)).toBe(false);
  });

  it('masks by key name even when the value has no recognisable shape', () => {
    expect(looksLikeSecret('STRIPE_SECRET_KEY', 'abc')).toBe(true);
    expect(looksLikeSecret('PORT', '3000')).toBe(false);
    expect(looksLikeSecret('NEXT_PUBLIC_SITE_URL', 'https://example.com')).toBe(false);
  });

  it('only nags about live credentials, never about obvious placeholders', () => {
    expect(looksLikeLiveCredential('sk_live_51HabcDEF1234567890')).toBe(true);
    expect(looksLikeLiveCredential('sk_test_xxxxxxxxxxxx')).toBe(false);
    expect(looksLikeLiveCredential('changeme')).toBe(false);
  });
});
