import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../src/core/csv';
import {
  defaultSettings,
  maskCsv,
  maskValue,
  maskedText,
  suggestKeyColumn,
  suggestMaskColumns,
} from '../../src/core/mask';

const TABLE = parseCsv(`key,value,environment
DATABASE_URL,postgresql://user:password@localhost:5432/app,production
OPENAI_API_KEY,sk-proj-abcdefghijklmnopqrstuvwxyz,production
CDN_BASE_URL,https://cdn.example.com/assets,development
`);

describe('maskValue', () => {
  it('leaves a value alone when the mode is none', () => {
    expect(maskValue('sk-live-1234', 'none')).toBe('sk-live-1234');
  });

  it('never masks an empty value into a fake one', () => {
    expect(maskValue('', 'hide')).toBe('');
    expect(maskValue('', 'end')).toBe('');
  });

  it('hides completely without leaking the length', () => {
    const short = maskValue('abc', 'hide');
    const long = maskValue('a'.repeat(64), 'hide');
    expect(short).toBe(long);
    expect(short).toMatch(/^\*+$/);
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
    expect(maskValue('abc', 'start', 4)).toMatch(/^\*+$/);
    expect(maskValue('abcdef', 'middle', 6)).toMatch(/^\*+$/);
  });

  it('always leaves at least three stars, so a mask never looks like the value', () => {
    // `middle` keeps 4 at each end of a 10-character value: 2 would be masked,
    // which is not visually a mask, so the run is widened to 3.
    expect(maskValue('abcdefghij', 'middle', 8)).toBe('abcd***ghij');
  });

  it('clamps a nonsensical keep value into 1…8', () => {
    expect(maskValue('abcdefghij', 'end', -5)).toBe(`a${'*'.repeat(9)}`);
    expect(maskValue('abcdefghij', 'end', 1000)).toBe(`abcdefgh${'*'.repeat(3)}`);
  });
});

describe('suggest', () => {
  it('finds the key column by header name', () => {
    expect(suggestKeyColumn(['id', 'variable', 'value'])).toBe(1);
    expect(suggestKeyColumn(['KEY', 'value'])).toBe(0);
    expect(suggestKeyColumn(['alpha', 'beta'])).toBeNull();
  });

  it('masks the value columns and leaves the key column readable', () => {
    const columns = suggestMaskColumns(TABLE);
    expect(columns).toEqual([1]);
    expect(columns).not.toContain(0);
  });

  it('defaults to hiding a column whose values look like credentials', () => {
    const table = parseCsv('alpha,beta\nsession,sk-proj-abcdefghijklmnopqrstuvwxyz');
    expect(suggestMaskColumns(table)).toEqual([1]);
  });

  it('falls back to the rightmost column for a key,value file with odd headers', () => {
    const table = parseCsv('left,right\nalpha,beta');
    expect(suggestMaskColumns(table)).toEqual([1]);
  });

  it('produces settings that mask by default', () => {
    const settings = defaultSettings(TABLE);
    expect(settings.keyColumn).toBe(0);
    expect(settings.columnModes[1]).toBe('hide');
    expect(settings.columnModes[0]).toBeUndefined();
  });
});

describe('maskCsv', () => {
  const settings = { columnModes: { 1: 'hide' as const }, keyColumn: 0, keep: 4 };

  it('masks only the configured column and keeps the shape', () => {
    const masked = maskCsv(TABLE, settings);
    expect(masked.header).toEqual(['key', 'value', 'environment']);
    expect(masked.rows).toHaveLength(3);
    expect(masked.rows[0]?.[0]).toBe('DATABASE_URL');
    expect(masked.rows[0]?.[1]).toBe('********');
    expect(masked.rows[0]?.[2]).toBe('production');
  });

  it('counts what was masked, what was not, and what was empty', () => {
    const table = parseCsv('key,value\nA,secret\nB,\nC,plain');
    const masked = maskCsv(table, { columnModes: { 1: 'hide' }, keyColumn: 0, keep: 4 });
    // The key column is visible, so its three values count as unmasked.
    expect(masked.counts).toEqual({ masked: 2, unmasked: 3, empty: 1 });
  });

  it('masks a single key differently from its column', () => {
    const masked = maskCsv(TABLE, {
      columnModes: { 1: 'hide' },
      keyModes: { OPENAI_API_KEY: 'end' },
      keyColumn: 0,
      keep: 4,
    });
    expect(masked.rows[1]?.[1]).toBe(`sk-p${'*'.repeat(30)}`);
    expect(masked.rows[0]?.[1]).toBe('********');
  });

  it('applies a key override even when the column is open', () => {
    const masked = maskCsv(TABLE, {
      columnModes: {},
      keyModes: { DATABASE_URL: 'hide' },
      keyColumn: 0,
      keep: 4,
    });
    expect(masked.rows[0]?.[1]).toBe('********');
    expect(masked.rows[1]?.[1]).toBe('sk-proj-abcdefghijklmnopqrstuvwxyz');
  });

  it('masks the same original to the same output and marks the duplicate', () => {
    const table = parseCsv('key,value\nA,shared-secret\nB,shared-secret\nC,other-secret');
    const masked = maskCsv(table, { columnModes: { 1: 'end' }, keyColumn: 0, keep: 4 });
    expect(masked.rows[0]?.[1]).toBe(masked.rows[1]?.[1]);
    expect(masked.cells[1]?.[1]?.duplicateOf).toBe(0);
    expect(masked.cells[2]?.[1]?.duplicateOf).toBeNull();
  });

  it('does not report duplicates across different columns', () => {
    const table = parseCsv('a,b\nsame,same');
    const masked = maskCsv(table, { columnModes: { 0: 'hide', 1: 'hide' }, keyColumn: null, keep: 4 });
    expect(masked.cells[0]?.[0]?.duplicateOf).toBeNull();
    expect(masked.cells[0]?.[1]?.duplicateOf).toBeNull();
  });

  it('warns about an unmasked column that holds credentials', () => {
    const masked = maskCsv(TABLE, { columnModes: {}, keyColumn: 0, keep: 4 });
    expect(masked.warnings).toContainEqual({
      kind: 'unmasked-secret',
      column: 1,
      columnName: 'value',
      // The Postgres URL carries `user:password@`, the OpenAI key its `sk-proj-`
      // prefix; a plain https URL does not look like a credential.
      rows: [0, 1],
    });
  });

  it('warns when the key column itself is masked', () => {
    const masked = maskCsv(TABLE, { columnModes: { 0: 'hide', 1: 'hide' }, keyColumn: 0, keep: 4 });
    expect(masked.warnings.some((warning) => warning.kind === 'key-column-masked')).toBe(true);
  });

  it('is pure: the source table is untouched', () => {
    const before = JSON.stringify(TABLE);
    maskCsv(TABLE, settings);
    expect(JSON.stringify(TABLE)).toBe(before);
  });
});

describe('maskedText', () => {
  it('writes valid CSV in the source dialect with no original values in it', () => {
    const masked = maskCsv(TABLE, { columnModes: { 1: 'hide' }, keyColumn: 0, keep: 4 });
    const text = maskedText(masked, { delimiter: ',', lineEnding: '\n' });

    expect(text.startsWith('key,value,environment\n')).toBe(true);
    expect(text).not.toContain('postgresql://');
    expect(text).not.toContain('sk-proj-');

    const reparsed = parseCsv(text);
    expect(reparsed.header).toEqual(TABLE.header);
    expect(reparsed.rows).toHaveLength(TABLE.rows.length);
    expect(reparsed.diagnostics).toEqual([]);
  });

  it('keeps a value containing a comma quoted, so the output is still CSV', () => {
    const table = parseCsv('key,value\nA,"one,two"');
    const masked = maskCsv(table, { columnModes: {}, keyColumn: 0, keep: 4 });
    expect(maskedText(masked, { delimiter: ',', lineEnding: '\n' })).toContain('"one,two"');
    expect(parseCsv(maskedText(masked, { delimiter: ',', lineEnding: '\n' })).rows).toEqual([['A', 'one,two']]);
  });
});
