import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { describe, expect, it } from 'vitest';
import { parseEnvFile } from '../../src/core/parse';

const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'env');
const fixtures: string[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.env'))
  .sort();

/**
 * The parser must agree with dotenv v18 on keys and values for every fixture.
 * This is the guard that keeps the vendored grammar honest (docs/PRD.md §16.1).
 */
describe('dotenv conformance', () => {
  it('has fixtures to test', () => {
    expect(fixtures.length).toBeGreaterThan(20);
  });

  it.each(fixtures)('%s matches dotenv.parse()', (name: string) => {
    const text = readFileSync(join(FIXTURE_DIR, name), 'utf8');
    const ours = Object.fromEntries(
      [...parseEnvFile('f', text).effective.entries()].map(([key, occ]) => [key, occ.value]),
    );
    expect(ours).toEqual(dotenv.parse(text));
  });

  it.each(fixtures)('%s keeps key order stable', (name: string) => {
    const text = readFileSync(join(FIXTURE_DIR, name), 'utf8');
    const parsed = parseEnvFile('f', text);
    expect(parsed.order).toEqual([...parsed.effective.keys()]);
    expect(new Set(parsed.order).size).toBe(parsed.order.length);
  });
});
