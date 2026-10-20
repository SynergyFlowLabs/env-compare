import { describe, expect, it } from 'vitest';
import { parseEnvFile } from '../../src/core/parse';
import { compare } from '../../src/core/compare';
import type { FileInput } from '../../src/core/compare';
import { buildAgentPrompt, buildFixBlock, buildReport } from '../../src/core/export';

const EXAMPLE = `DATABASE_URL=postgresql://user:password@localhost:5432/app
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
RESEND_API_KEY=re_xxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=changeme
NEXT_PUBLIC_SITE_URL=https://example.com
# SENTRY_DSN=
`;

const TARGET = `DATABASE_URL=postgresql://user:password@localhost:5432/app
SUPABASE_SERVICE_ROLE_KEY=changeme
NEXT_PUBLIC_SITE_URL=https://example.com
LEGACY_GA_ID=UA-000000-2
`;

function files(): FileInput[] {
  return [
    { id: 'r', name: '.env.example', role: 'reference', parsed: parseEnvFile('r', EXAMPLE) },
    { id: 't', name: '.env', role: 'target', parsed: parseEnvFile('t', TARGET) },
  ];
}

const comparison = compare(files());

describe('fix block', () => {
  const block = buildFixBlock(comparison, 't');

  it('lists the missing keys in reference order, with blank values', () => {
    expect(block.keys).toEqual(['STRIPE_SECRET_KEY', 'RESEND_API_KEY']);
    expect(block.text).toBe(
      '# Added by EnvCompare — fill in the values\nSTRIPE_SECRET_KEY=\nRESEND_API_KEY=\n',
    );
  });

  it('never contains a value from any file', () => {
    expect(block.text).not.toContain('sk_test');
    expect(block.text).not.toContain('re_');
    expect(block.text).not.toContain('postgresql');
  });

  it('does not push optional (commented) keys into the file', () => {
    expect(block.text).not.toContain('SENTRY_DSN');
  });

  it('is empty when nothing is missing', () => {
    const clean = compare([
      { id: 'r', name: '.env.example', role: 'reference', parsed: parseEnvFile('r', 'A=1\n') },
      { id: 't', name: '.env', role: 'target', parsed: parseEnvFile('t', 'A=1\n') },
    ]);
    expect(buildFixBlock(clean, 't')).toEqual({ text: '', keys: [] });
  });
});

describe('report', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  it('defaults to key names only', () => {
    const report = buildReport(comparison, { now, timeZone: 'UTC' });
    expect(report).toContain('# EnvCompare report');
    expect(report).toContain('`STRIPE_SECRET_KEY`');
    expect(report).toContain('Missing from this file');
    expect(report).toContain('Contains key names only');
    // The critical assertion: no value from either file leaks.
    expect(report).not.toContain('sk_test');
    expect(report).not.toContain('re_xxxxxxxx');
    expect(report).not.toContain('postgresql://');
    expect(report).not.toContain('changeme');
    expect(report).not.toContain('example.com');
  });

  it('masks values without exposing their content or exact length', () => {
    const report = buildReport(comparison, { redaction: 'masked', now, timeZone: 'UTC' });
    expect(report).toContain('••••');
    expect(report).not.toContain('sk_test');
    expect(report).not.toContain('https://example.com');
  });

  it('includes values only when explicitly asked', () => {
    // The report lists problem rows only; `LEGACY_GA_ID` is an "extra" row, so
    // it is the one whose value can appear in the full-redaction report.
    const report = buildReport(comparison, { redaction: 'full', now, timeZone: 'UTC' });
    expect(report).toContain('UA-000000-2');
    expect(report).toContain('This report contains real values');
    expect(buildReport(comparison, { now, timeZone: 'UTC' })).not.toContain('UA-000000-2');
  });

  it('summarises per-file counts in a table', () => {
    const report = buildReport(comparison, { now, timeZone: 'UTC' });
    expect(report).toContain('| Missing |');
    expect(report).toContain('| `.env.example` | `.env` |');
  });

  it('says so when everything matches', () => {
    const clean = compare([
      { id: 'r', name: '.env.example', role: 'reference', parsed: parseEnvFile('r', 'A=1\n') },
      { id: 't', name: '.env', role: 'target', parsed: parseEnvFile('t', 'A=1\n') },
    ]);
    expect(buildReport(clean, { now, timeZone: 'UTC' })).toContain('Nothing is missing.');
  });
});

describe('agent prompt', () => {
  const prompt = buildAgentPrompt(comparison, 't');

  it('names the missing keys and the files', () => {
    expect(prompt).toContain('.env');
    expect(prompt).toContain('.env.example');
    expect(prompt).toContain('- STRIPE_SECRET_KEY');
    expect(prompt).toContain('- RESEND_API_KEY');
  });

  it('contains no values at all', () => {
    expect(prompt).not.toContain('sk_test');
    expect(prompt).not.toContain('postgresql');
    expect(prompt).not.toContain('https://example.com');
  });

  it('explicitly tells the agent not to invent values', () => {
    expect(prompt).toContain('Do not invent values');
  });
});
