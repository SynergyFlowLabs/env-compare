import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  formatValue,
  keysToMask,
  maskEnv,
  maskValue,
  readEnvSource,
  serializeEnv,
  shouldMaskOnArrival,
} from '../../src/core/mask';

const SOURCE = readEnvSource(`# --- Database ---
DATABASE_URL=postgresql://user:password@localhost:5432/app
# --- AI ---
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz
CDN_BASE_URL=https://cdn.example.com/assets
LOG_LEVEL=info
PORT=3000
`);

const settings = { valueMode: 'hide' as const, keyModes: {}, keep: 4 };

describe('maskValue', () => {
  it('leaves a value alone when the mode is none', () => {
    expect(maskValue('sk-live-1234', 'none')).toBe('sk-live-1234');
  });

  it('never masks an empty value into a fake one', () => {
    expect(maskValue('', 'hide')).toBe('');
    expect(maskValue('', 'end')).toBe('');
  });

  it('hides completely without leaking the length', () => {
    expect(maskValue('abc', 'hide')).toBe(maskValue('a'.repeat(64), 'hide'));
    expect(maskValue('abc', 'hide')).toMatch(/^\*+$/);
  });

  it('keeps the tail when masking the start', () => {
    expect(maskValue('abcdefghij', 'start', 4)).toBe('******ghij');
  });

  it('keeps the head when masking the end', () => {
    // 18 characters, 4 kept, so 14 masked.
    expect(maskValue('sk-proj-abcdefghij', 'end', 4)).toBe(`sk-p${'*'.repeat(14)}`);
  });

  it('keeps both ends when masking the middle', () => {
    expect(maskValue('abcdefghij', 'middle', 4)).toBe('ab******ij');
  });

  it('hides a value that is too short to keep anything hidden', () => {
    // Keeping 4 of "abc" would "mask" it by showing all of it.
    expect(maskValue('abc', 'end', 4)).toMatch(/^\*+$/);
    expect(maskValue('abcdef', 'middle', 6)).toMatch(/^\*+$/);
  });

  it('always leaves at least three stars, so a mask never looks like the value', () => {
    expect(maskValue('abcdefghij', 'middle', 8)).toBe('abcd***ghij');
  });

  it('clamps a nonsensical keep value into 1…8', () => {
    expect(maskValue('abcdefghij', 'end', -5)).toBe(`a${'*'.repeat(9)}`);
    expect(maskValue('abcdefghij', 'end', 1000)).toBe(`abcdefgh${'*'.repeat(3)}`);
  });
});

describe('shouldMaskOnArrival', () => {
  it('hides anything whose name looks like a credential', () => {
    expect(shouldMaskOnArrival('STRIPE_SECRET_KEY', 'sk_test_x')).toBe(true);
    expect(shouldMaskOnArrival('DATABASE_URL', 'postgres://x')).toBe(true);
    // A harmless-looking value does not outrank a dangerous name.
    expect(shouldMaskOnArrival('SESSION_SECRET', 'abc123')).toBe(true);
  });

  it('leaves plain configuration visible', () => {
    expect(shouldMaskOnArrival('LOG_LEVEL', 'info')).toBe(false);
    expect(shouldMaskOnArrival('PORT', '3000')).toBe(false);
    // A CDN URL with no credentials in it is configuration, not a secret.
    expect(shouldMaskOnArrival('CDN_BASE_URL', 'https://cdn.example.com/assets')).toBe(false);
    expect(shouldMaskOnArrival('NODE_ENV', 'production')).toBe(false);
  });

  it('never masks an empty value, which has nothing to hide', () => {
    expect(shouldMaskOnArrival('API_KEY', '')).toBe(false);
  });
});

describe('defaults', () => {
  it('hides the secrets and leaves the obvious configuration readable', () => {
    const defaults = defaultSettings(SOURCE);
    expect(defaults.valueMode).toBe('hide');
    expect(keysToMask(SOURCE)).toEqual(['DATABASE_URL', 'OPENAI_API_KEY']);
    expect(defaults.keyModes).toEqual({ CDN_BASE_URL: 'none', LOG_LEVEL: 'none', PORT: 'none' });
  });
});

describe('maskEnv', () => {
  it('masks the value of every entry and never the key', () => {
    const masked = maskEnv(SOURCE, settings);
    expect(masked.entries.map((entry) => entry.key)).toEqual([
      'DATABASE_URL',
      'OPENAI_API_KEY',
      'CDN_BASE_URL',
      'LOG_LEVEL',
      'PORT',
    ]);
    expect(masked.entries.every((entry) => entry.masked === '********')).toBe(true);
    expect(masked.counts).toEqual({ masked: 5, unmasked: 0, empty: 0 });
  });

  it('counts an empty value as empty, not as masked', () => {
    const source = readEnvSource('A_TOKEN=\nB_TOKEN=x\n');
    const masked = maskEnv(source, settings);
    expect(masked.counts).toEqual({ masked: 1, unmasked: 0, empty: 1 });
  });

  it('lets one key override the file-wide mode', () => {
    const masked = maskEnv(SOURCE, {
      valueMode: 'hide',
      keyModes: { OPENAI_API_KEY: 'end', LOG_LEVEL: 'none' },
      keep: 4,
    });
    const openai = 'sk-proj-abcdefghijklmnopqrstuvwxyz';
    expect(masked.entries[1]?.masked).toBe(`sk-p${'*'.repeat(openai.length - 4)}`);
    expect(masked.entries[3]?.masked).toBe('info');
    expect(masked.entries[0]?.masked).toBe('********');
  });

  it('masks the same value to the same output and names the duplicate', () => {
    const source = readEnvSource('A_SECRET=shared-secret\nB_SECRET=shared-secret\nC_SECRET=other\n');
    const masked = maskEnv(source, { valueMode: 'end', keyModes: {}, keep: 4 });
    expect(masked.entries[0]?.masked).toBe(masked.entries[1]?.masked);
    expect(masked.entries[1]?.duplicateOf).toBe(0);
    expect(masked.entries[2]?.duplicateOf).toBeNull();
  });

  it('warns about a visible value that looks like a credential', () => {
    const masked = maskEnv(SOURCE, { valueMode: 'none', keyModes: {}, keep: 4 });
    const warning = masked.warnings.find((item) => item.kind === 'unmasked-secret');
    expect(warning).toEqual({
      kind: 'unmasked-secret',
      // `postgresql://user:password@…` and the `sk-proj-` key.
      keys: ['DATABASE_URL', 'OPENAI_API_KEY'],
    });
  });

  it('warns separately when only the name suggests a secret', () => {
    const source = readEnvSource('SESSION_SECRET=abc123\nLOG_LEVEL=info\n');
    const masked = maskEnv(source, { valueMode: 'none', keyModes: {}, keep: 4 });
    expect(masked.warnings).toContainEqual({ kind: 'unmasked-secret-name', keys: ['SESSION_SECRET'] });
  });

  it('is pure: the source is untouched', () => {
    const before = JSON.stringify(SOURCE.entries);
    maskEnv(SOURCE, settings);
    expect(JSON.stringify(SOURCE.entries)).toBe(before);
  });
});

describe('export', () => {
  it('writes an env file with no original values in it', () => {
    const masked = maskEnv(SOURCE, settings);
    const text = serializeEnv(
      masked.entries.map((entry) => ({ key: entry.key, value: entry.masked })),
      { lineEnding: '\n' },
    );

    expect(text.split('\n').filter(Boolean)).toHaveLength(5);
    expect(text).toContain('DATABASE_URL=********');
    expect(text).not.toContain('postgresql://');
    expect(text).not.toContain('sk-proj-');
    expect(text).not.toContain('#');
  });

  it('round-trips: the masked file reads back as the same keys and masked values', () => {
    const masked = maskEnv(SOURCE, settings);
    const text = serializeEnv(
      masked.entries.map((entry) => ({ key: entry.key, value: entry.masked })),
      { lineEnding: '\n' },
    );
    const reparsed = readEnvSource(text);
    expect(reparsed.entries.map((entry) => entry.key)).toEqual(masked.entries.map((entry) => entry.key));
    expect(reparsed.entries.map((entry) => entry.value)).toEqual(masked.entries.map((entry) => entry.masked));
    expect(reparsed.skipped.unreadable).toBe(0);
  });

  it('quotes a value that would otherwise be re-read differently', () => {
    expect(formatValue('two words')).toBe('two words');
    expect(formatValue('# not a comment')).toBe("'# not a comment'");
  });
});
