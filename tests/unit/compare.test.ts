import { describe, expect, it } from 'vitest';
import { parseEnvFile } from '../../src/core/parse';
import { compare, sortRows, assignRoles, isReferenceName } from '../../src/core/compare';
import type { FileInput, FileRole } from '../../src/core/compare';

function file(id: string, name: string, role: FileRole, text: string): FileInput {
  return { id, name, role, parsed: parseEnvFile(id, text) };
}

function cmp(reference: string, target: string) {
  return compare([
    file('r', '.env.example', 'reference', reference),
    file('t', '.env', 'target', target),
  ]);
}

const row = (comparison: ReturnType<typeof cmp>, key: string) =>
  comparison.rows.find((r) => r.key === key)!;

const EXAMPLE = `# --- Database ---
DATABASE_URL=postgresql://user:password@localhost:5432/app

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=changeme

# --- Payments ---
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=

# --- Email ---
RESEND_API_KEY=re_xxxxxxxxxxxx

# --- Optional ---
# SENTRY_DSN=
`;

const TARGET = `DATABASE_URL=postgresql://user:password@localhost:5432/app
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature
SUPABASE_SERVICE_ROLE_KEY=changeme
STRIPE_WEBHOOK_SECRET=
LEGACY_GA_ID=UA-000000-2
`;

describe('compare — the golden case from the PRD (Appendix A)', () => {
  const comparison = cmp(EXAMPLE, TARGET);

  it('orders keys by the reference file first', () => {
    expect(comparison.rows.map((r) => r.key)).toEqual([
      'DATABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'RESEND_API_KEY',
      'SENTRY_DSN',
      'LEGACY_GA_ID',
    ]);
  });

  it.each([
    ['DATABASE_URL', 'matching', 'ok'],
    ['NEXT_PUBLIC_SUPABASE_URL', 'different', 'info'],
    // A real value replacing an example placeholder is a success, not a difference.
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'matching', 'ok'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'needsValue', 'warning'],
    ['STRIPE_SECRET_KEY', 'missing', 'error'],
    ['STRIPE_WEBHOOK_SECRET', 'needsValue', 'error'],
    ['RESEND_API_KEY', 'missing', 'error'],
    ['SENTRY_DSN', 'commented', 'info'],
    ['LEGACY_GA_ID', 'extra', 'info'],
  ])('%s is %s', (key, bucket, severity) => {
    const r = row(comparison, key as string);
    expect(r.bucket).toBe(bucket);
    expect(r.severity).toBe(severity);
  });

  it('summarises the case', () => {
    expect(comparison.summary).toMatchObject({
      missing: 2,
      needsValue: 2,
      extra: 1,
      commented: 1,
      different: 1,
      matching: 2,
      total: 9,
    });
  });

  it('offers the right action per cell', () => {
    expect(row(comparison, 'STRIPE_SECRET_KEY').cells[1]?.action).toBe('add');
    expect(row(comparison, 'SUPABASE_SERVICE_ROLE_KEY').cells[1]?.action).toBe('fill');
    expect(row(comparison, 'LEGACY_GA_ID').cells[1]?.action).toBe('remove');
  });

  it('marks secrets without revealing them', () => {
    expect(row(comparison, 'STRIPE_SECRET_KEY').cells[0]?.isSecret).toBe(true);
    expect(row(comparison, 'DATABASE_URL').cells[0]?.isSecret).toBe(true);
    expect(row(comparison, 'NEXT_PUBLIC_SUPABASE_URL').cells[0]?.isSecret).toBe(false);
  });

  it('reports per-file counts', () => {
    const target = comparison.perFile.find((f) => f.fileId === 't')!;
    expect(target.counts.absent).toBe(3); // 2 missing + commented optional
    expect(target.counts.placeholder).toBe(1);
    expect(target.counts.empty).toBe(1);
  });
});

describe('compare — state matrix (Appendix B)', () => {
  const cases: Array<{
    name: string;
    ref: string;
    target: string;
    bucket: string;
    severity: string;
  }> = [
    { name: 'present → absent is missing', ref: 'A=1', target: '', bucket: 'missing', severity: 'error' },
    { name: 'present → commented is missing', ref: 'A=1', target: '# A=1', bucket: 'missing', severity: 'error' },
    { name: 'present → empty needs a value', ref: 'A=1', target: 'A=', bucket: 'needsValue', severity: 'error' },
    { name: 'present → placeholder needs a value', ref: 'A=1', target: 'A=changeme', bucket: 'needsValue', severity: 'warning' },
    { name: 'present → same value matches', ref: 'A=1', target: 'A=1', bucket: 'matching', severity: 'ok' },
    { name: 'present → different value is informational', ref: 'A=1', target: 'A=2', bucket: 'different', severity: 'info' },
    { name: 'empty in example → real value matches', ref: 'A=', target: 'A=real', bucket: 'matching', severity: 'ok' },
    { name: 'placeholder in example → real value matches', ref: 'A=your-key', target: 'A=real', bucket: 'matching', severity: 'ok' },
    { name: 'absent → present is an extra', ref: '', target: 'A=1', bucket: 'extra', severity: 'info' },
    { name: 'absent → empty is an extra', ref: '', target: 'A=', bucket: 'extra', severity: 'info' },
    { name: 'commented in example → absent is not an error', ref: '# A=', target: '', bucket: 'commented', severity: 'info' },
    { name: 'commented in example → present matches', ref: '# A=', target: 'A=1', bucket: 'matching', severity: 'ok' },
  ];

  it.each(cases)('$name', ({ ref, target, bucket, severity }) => {
    const r = cmp(ref, target).rows[0]!;
    expect(r.bucket).toBe(bucket);
    expect(r.severity).toBe(severity);
  });
});

describe('compare — structure', () => {
  it('appends target-only keys after reference keys, in first-appearance order', () => {
    const comparison = cmp('A=1\nB=2\n', 'Z=9\nA=1\nY=8\n');
    expect(comparison.rows.map((r) => r.key)).toEqual(['A', 'B', 'Z', 'Y']);
  });

  it('supports more than one target and takes the worst severity', () => {
    const comparison = compare([
      file('r', '.env.example', 'reference', 'A=1\nB=2\n'),
      file('t1', '.env.local', 'target', 'A=1\nB=\n'),
      file('t2', '.env.production', 'target', 'A=1\n'),
    ]);
    expect(comparison.targetIds).toEqual(['t1', 't2']);
    const a = comparison.rows.find((r) => r.key === 'A')!;
    expect(a.cells.map((c) => c.presence)).toEqual(['present', 'present', 'present']);
    const b = comparison.rows.find((r) => r.key === 'B')!;
    expect(b.bucket).toBe('missing'); // worst of "empty" and "absent"
    expect(b.severity).toBe('error');
  });

  it('uses the effective value for duplicates', () => {
    const comparison = cmp('A=1\n', 'A=1\nA=2\n');
    expect(comparison.rows[0]?.cells[1]?.occurrence?.value).toBe('2');
    expect(comparison.rows[0]?.bucket).toBe('different');
  });

  it('returns an empty comparison when there are no files', () => {
    const comparison = compare([]);
    expect(comparison.rows).toEqual([]);
    expect(comparison.summary.total).toBe(0);
  });

  it('surfaces per-file parse diagnostics', () => {
    const comparison = cmp('A=1\n', 'MY KEY=1\nA=1\n');
    expect(comparison.diagnostics.t?.map((d) => d.code)).toContain('PARSE_BAD_KEY');
  });

  it('sorts alphabetically on demand without touching file order', () => {
    const comparison = cmp('B=1\nA=2\n', 'B=1\n');
    expect(sortRows(comparison.rows, 'alpha').map((r) => r.key)).toEqual(['A', 'B']);
    expect(sortRows(comparison.rows, 'file').map((r) => r.key)).toEqual(['B', 'A']);
  });

  it('stays fast on large files', () => {
    const make = (count: number, offset: number) =>
      Array.from({ length: count }, (_, i) => `KEY_${i + offset}=value${i}`).join('\n');
    const start = performance.now();
    const comparison = cmp(make(1200, 0), make(1200, 200));
    const elapsed = performance.now() - start;
    expect(comparison.summary.missing).toBe(200);
    expect(elapsed).toBeLessThan(50);
  });
});

describe('roles', () => {
  it('recognises reference filenames', () => {
    for (const name of ['.env.example', '.env.sample', '.env.template', '.env.dist', 'example.env']) {
      expect(isReferenceName(name)).toBe(true);
    }
    expect(isReferenceName('.env')).toBe(false);
    expect(isReferenceName('.env.local')).toBe(false);
  });

  it('picks the example file as the reference and the first file otherwise', () => {
    expect(assignRoles(['.env', '.env.example'])).toEqual(['target', 'reference']);
    expect(assignRoles(['a.env', 'b.env'])).toEqual(['reference', 'target']);
  });
});
