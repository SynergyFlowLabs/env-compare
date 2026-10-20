/**
 * A CSV reader for the masking page.
 *
 * Deliberately not a general-purpose CSV library: it reads what people actually
 * paste out of a spreadsheet or a secret manager, and it never guesses at
 * meaning. Every decision here is reversible — the parse keeps the delimiter
 * and the line ending it found so the masked file can be written back in the
 * same shape the reader's tools expect.
 *
 * Compliance notes (RFC 4180 plus the lenient parts everybody relies on):
 *   - quoted fields may contain the delimiter, CR, LF, and `""` for a quote;
 *   - a BOM is stripped, not treated as part of the first header name;
 *   - CRLF and LF both work, and the file's own line ending is reported;
 *   - rows with the wrong number of fields are padded and *reported*, never
 *     dropped: silently losing a row is the one failure a masking tool cannot
 *     afford.
 */

export interface CsvDiagnostic {
  /** `ragged` means the row had a different field count and was padded. */
  kind: 'ragged' | 'unterminated-quote' | 'empty';
  /** 1-based data row (the header is not counted); 0 when the row is unknown. */
  row: number;
  expected?: number;
  actual?: number;
}

export interface CsvTable {
  /** First record, exactly as written. Empty names are left empty for the UI to label. */
  header: string[];
  /** Data rows, every one padded to `header.length`. */
  rows: string[][];
  delimiter: string;
  lineEnding: '\n' | '\r\n';
  hasHeader: boolean;
  diagnostics: CsvDiagnostic[];
}

export interface ParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
}

const DELIMITERS = [',', ';', '\t', '|'] as const;
const BOM = /^\uFEFF/;

/** Count delimiters that are not inside a quoted field. */
function countOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      quoted = !quoted;
    } else if (!quoted && ch === delimiter) {
      count += 1;
    }
  }
  return count;
}

function mostFrequent(values: number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0] ?? 0;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Pick the delimiter whose field count is most consistent across the first few
 * lines. Consistency beats raw frequency: a comma-separated file full of
 * decimal numbers (`42,5`) can out-count its own commas, but the counts still
 * line up, and so does the file's real separator.
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== '')
    .slice(0, 10);
  if (lines.length === 0) return ',';

  let best: string = DELIMITERS[0];
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const counts = lines
      .map((line) => countOutsideQuotes(line, delimiter))
      .filter((count) => count > 0);
    if (counts.length === 0) continue;
    const mode = mostFrequent(counts);
    const score = counts.filter((count) => count === mode).length;
    // Strict `>` so ties keep the earlier candidate: comma first, then the rest.
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

export function parseCsv(input: string, options: ParseOptions = {}): CsvTable {
  const text = input.replace(BOM, '');
  const lineEnding: '\n' | '\r\n' = text.includes('\r\n') ? '\r\n' : '\n';
  const hasHeader = options.hasHeader ?? true;

  if (text.trim() === '') {
    return { header: [], rows: [], delimiter: options.delimiter ?? ',', lineEnding, hasHeader, diagnostics: [{ kind: 'empty', row: 0 }] };
  }

  const delimiter = options.delimiter ?? detectDelimiter(text);
  const diagnostics: CsvDiagnostic[] = [];
  const records: string[][] = [];

  let field = '';
  let record: string[] = [];
  let quoted = false;
  /** True once the current record has seen any character, so a trailing newline adds no row. */
  let touched = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '') {
      quoted = true;
      touched = true;
      continue;
    }

    if (ch === delimiter) {
      record.push(field);
      field = '';
      touched = true;
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      touched = false;
      continue;
    }

    field += ch;
    touched = true;
  }

  if (quoted) {
    // An unterminated quote means the file is truncated or was malformed at the
    // source. Take what was written and say so rather than failing the paste.
    diagnostics.push({ kind: 'unterminated-quote', row: records.length });
  }

  if (touched || record.length > 0 || field !== '') {
    record.push(field);
    records.push(record);
  }

  // Drop trailing blank records: a file that ends in "\n\n" has not got a real
  // row of empty values at the end.
  while (records.length > 0 && records[records.length - 1]!.every((value) => value === '')) {
    records.pop();
  }

  if (records.length === 0) {
    return { header: [], rows: [], delimiter, lineEnding, hasHeader, diagnostics: [...diagnostics, { kind: 'empty', row: 0 }] };
  }

  const width = records.reduce((max, row) => Math.max(max, row.length), 0);
  const padded = records.map((row, index) => {
    if (row.length === width) return [...row];
    // The header is row 0; data rows are numbered from 1 for the reader.
    diagnostics.push({
      kind: 'ragged',
      row: hasHeader ? index : index + 1,
      expected: width,
      actual: row.length,
    });
    return [...row, ...Array<string>(width - row.length).fill('')];
  });

  if (!hasHeader) {
    return { header: [], rows: padded, delimiter, lineEnding, hasHeader, diagnostics };
  }

  const [header, ...rows] = padded;
  return { header: header ?? [], rows, delimiter, lineEnding, hasHeader, diagnostics };
}
