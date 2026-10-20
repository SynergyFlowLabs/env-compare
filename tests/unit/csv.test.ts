import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, quoteField, serialiseCsv } from '../../src/core/csv';

/**
 * The CSV layer only has to be right about one thing: what goes in comes out.
 * A masking tool that silently drops a row, mangles a quoted comma, or rewrites
 * the reader's line endings has lost the data it promised to protect.
 */
describe('parseCsv', () => {
  it('reads a header and rows', () => {
    const table = parseCsv('key,value\nA,1\nB,2\n');
    expect(table.header).toEqual(['key', 'value']);
    expect(table.rows).toEqual([
      ['A', '1'],
      ['B', '2'],
    ]);
  });

  it('strips a BOM instead of gluing it to the first header name', () => {
    const table = parseCsv('\uFEFFkey,value\nA,1\n');
    expect(table.header[0]).toBe('key');
  });

  it('keeps delimiters, quotes and newlines inside quoted fields', () => {
    const table = parseCsv('key,value\nA,"one,two"\nB,"line\nbreak"\nC,"say ""hi"""\n');
    expect(table.rows).toEqual([
      ['A', 'one,two'],
      ['B', 'line\nbreak'],
      ['C', 'say "hi"'],
    ]);
  });

  it('does not invent a row for a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n\n').rows).toEqual([['1', '2']]);
  });

  it('pads short rows and reports them rather than dropping data', () => {
    const table = parseCsv('a,b,c\n1,2\n');
    expect(table.rows).toEqual([['1', '2', '']]);
    expect(table.diagnostics).toContainEqual({ kind: 'ragged', row: 1, expected: 3, actual: 2 });
  });

  it('reports an unterminated quote but keeps the content', () => {
    const table = parseCsv('key,value\nA,"never closed\nmore text');
    expect(table.diagnostics.some((d) => d.kind === 'unterminated-quote')).toBe(true);
    expect(table.rows[0]?.[1]).toContain('never closed');
  });

  it('reports empty input instead of returning a phantom row', () => {
    const table = parseCsv('   \n');
    expect(table.rows).toEqual([]);
    expect(table.diagnostics).toEqual([{ kind: 'empty', row: 0 }]);
  });

  it('detects semicolons, tabs and pipes', () => {
    expect(detectDelimiter('a;b\n1;2')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('a|b\n1|2')).toBe('|');
  });

  it('prefers consistency over frequency when choosing a delimiter', () => {
    // Commas appear more often, but only in one line; the semicolon is the
    // separator both rows agree on.
    expect(detectDelimiter('key,with,commas;value\nA;B')).toBe(';');
  });

  it('keeps the file’s own line ending so the export matches', () => {
    expect(parseCsv('a,b\r\n1,2\r\n').lineEnding).toBe('\r\n');
    expect(parseCsv('a,b\n1,2\n').lineEnding).toBe('\n');
  });

  it('can read a file with no header', () => {
    const table = parseCsv('A,1\nB,2', { hasHeader: false });
    expect(table.rows).toEqual([
      ['A', '1'],
      ['B', '2'],
    ]);
  });
});

describe('serialiseCsv', () => {
  it('quotes only the fields that need it', () => {
    expect(quoteField('plain')).toBe('plain');
    expect(quoteField('has,comma')).toBe('"has,comma"');
    expect(quoteField('has"quote')).toBe('"has""quote"');
    expect(quoteField(' padded ')).toBe('" padded "');
    expect(quoteField('line\nbreak')).toBe('"line\nbreak"');
  });

  it('round-trips everything parseCsv can read', () => {
    const source = 'key,value,notes\nA,"one,two","say ""hi"""\nB,"multi\nline",\n';
    const table = parseCsv(source);
    const written = serialiseCsv([table.header, ...table.rows], {
      delimiter: table.delimiter,
      lineEnding: table.lineEnding,
    });
    expect(parseCsv(written)).toEqual({ ...table, diagnostics: table.diagnostics });
    expect(parseCsv(written).rows).toEqual(table.rows);
  });

  it('uses the delimiter and line ending it is given', () => {
    expect(serialiseCsv([['a', 'b']], { delimiter: ';', lineEnding: '\r\n' })).toBe('a;b\r\n');
  });

  it('can omit the trailing newline', () => {
    expect(serialiseCsv([['a']], { trailingNewline: false })).toBe('a');
  });
});
