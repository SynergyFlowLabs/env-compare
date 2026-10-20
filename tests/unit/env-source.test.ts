import { describe, expect, it } from 'vitest';
import { formatValue, readEnvSource, serializeEnv } from '../../src/core/mask';

/**
 * Issue #13: a `.env` is not a spreadsheet. Two columns, no header, and the
 * things that are not variables — comments, blank lines, unreadable lines —
 * are counted rather than rendered.
 */

const BANNERED = `# ============================================
# ZeroExam v3 — Environment Variables
# Copy to .env, then fill in values. Never commit .env to git.
# ============================================

BETTER_AUTH_SECRET=
GOOGLE_GENERATIVE_AI_API_KEY=
DATABASE_URL=postgresql://user:pw@localhost:5432/app
LOG_LEVEL=info
`;

describe('readEnvSource', () => {
  it('reads one entry per variable, in file order', () => {
    const source = readEnvSource(BANNERED);
    expect(source.entries.map((entry) => entry.key)).toEqual([
      'BETTER_AUTH_SECRET',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'DATABASE_URL',
      'LOG_LEVEL',
    ]);
    expect(source.entries[2]).toMatchObject({
      key: 'DATABASE_URL',
      value: 'postgresql://user:pw@localhost:5432/app',
      line: 8,
    });
  });

  it('never treats a comment or a blank line as a variable', () => {
    const source = readEnvSource(BANNERED);
    expect(source.entries).toHaveLength(4);
    expect(source.entries.some((entry) => entry.key.startsWith('#'))).toBe(false);
    // 4 banner lines + the blank line after them.
    expect(source.skipped).toEqual({ comments: 4, blank: 1, unreadable: 0 });
  });

  it('reads the first line as a variable when it is one', () => {
    const source = readEnvSource('DATABASE_URL=postgresql://user:pw@host/db\nLOG_LEVEL=info\n');
    expect(source.entries.map((entry) => entry.key)).toEqual(['DATABASE_URL', 'LOG_LEVEL']);
    expect(source.entries[0]?.value).toBe('postgresql://user:pw@host/db');
  });

  it('keeps the last value of a duplicated key and counts the others', () => {
    const source = readEnvSource('LOG_LEVEL=debug\nLOG_LEVEL=info\n');
    expect(source.entries).toEqual([{ key: 'LOG_LEVEL', value: 'info', line: 2, duplicates: 1 }]);
    expect(source.diagnostics.some((item) => item.code === 'DUP_KEY')).toBe(true);
  });

  it('handles export, quoting and trailing comments like the compare page', () => {
    const source = readEnvSource(
      'export API_URL="https://api.example.com"\nTOKEN=abc123 # rotate me\nGREETING="hello world"\n',
    );
    expect(source.entries.map((entry) => entry.value)).toEqual([
      'https://api.example.com',
      'abc123',
      'hello world',
    ]);
  });

  it('counts unreadable lines instead of inventing variables from them', () => {
    const source = readEnvSource('MY KEY=value\nkey:value\nGOOD_ONE=1\n');
    expect(source.entries.map((entry) => entry.key)).toEqual(['GOOD_ONE']);
    expect(source.skipped.unreadable).toBe(2);
  });

  it('reports a multi-column CSV as such rather than guessing a table', () => {
    const source = readEnvSource('key,value,environment\nDATABASE_URL,x,production\n');
    expect(source.entries).toEqual([]);
    expect(source.looksLikeTable).toBe(true);
  });

  it('does not call a plain-key env file a table', () => {
    const source = readEnvSource('JUST_A_KEY\n');
    expect(source.looksLikeTable).toBe(false);
  });

  it('keeps the file’s line ending', () => {
    expect(readEnvSource('A=1\r\nB=2\r\n').lineEnding).toBe('\r\n');
    expect(readEnvSource('A=1\nB=2\n').lineEnding).toBe('\n');
  });
});

describe('formatValue', () => {
  it('leaves ordinary values alone', () => {
    expect(formatValue('info')).toBe('info');
    expect(formatValue('postgresql://user:pw@host:5432/db')).toBe('postgresql://user:pw@host:5432/db');
    expect(formatValue('********')).toBe('********');
    expect(formatValue('')).toBe('');
  });

  it('quotes what would otherwise be re-read as something else', () => {
    // Single quotes are taken verbatim, so they round-trip exactly.
    expect(formatValue('has space at end ')).toBe("'has space at end '");
    expect(formatValue('with # hash')).toBe("'with # hash'");
    // A double quote inside a value is kept verbatim by single-quoting it.
    expect(formatValue('a"b')).toBe(`'a"b'`);
    expect(formatValue('line\nbreak')).toBe('"line\\nbreak"');
  });

  it('round-trips a quoted value through the reader', () => {
    const value = 'a "quoted" # value with \\ backslash';
    const text = serializeEnv([{ key: 'TRICKY', value }]);
    expect(readEnvSource(text).entries[0]?.value).toBe(value);
  });
});

describe('serializeEnv', () => {
  it('writes KEY=value lines in the file’s dialect', () => {
    const text = serializeEnv(
      [
        { key: 'DATABASE_URL', value: '********' },
        { key: 'LOG_LEVEL', value: 'info' },
      ],
      { lineEnding: '\r\n' },
    );
    expect(text).toBe('DATABASE_URL=********\r\nLOG_LEVEL=info\r\n');
  });

  it('drops comments and blank lines: they are not part of the output', () => {
    const source = readEnvSource(BANNERED);
    const text = serializeEnv(source.entries.map((entry) => ({ key: entry.key, value: entry.value })));
    expect(text).not.toContain('#');
    expect(text.trim().split('\n')).toHaveLength(4);
  });

  it('can omit the trailing newline', () => {
    expect(serializeEnv([{ key: 'A', value: '1' }], { trailingNewline: false })).toBe('A=1');
  });
});
