import type { CsvTable } from '../csv';
import { isSecretValue } from '../compare';
import type { MaskMode, MaskSettings } from './mask';

/**
 * The first guess, so the page opens already safe.
 *
 * The rule is the one the rest of the product follows: detection may only ever
 * *add* masking. It never unmasks, never rewrites a value, and the reader can
 * override every part of it. Being wrong in the cautious direction costs one
 * click; being wrong in the other direction leaks a token.
 */

/** Header names that hold the variable name rather than its value. */
const KEY_HEADERS = [
  'key',
  'variable',
  'variable_name',
  'var',
  'env_key',
  'env',
  'name',
  'setting',
  'parameter',
  'param',
  'field',
] as const;

/** Header names that usually hold a value worth hiding. */
const VALUE_HEADER = /value|secret|token|password|passwd|credential|api_?key|private|dsn|connection|conn_?str|url|uri|signature|salt|hash/i;

function normalise(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** The column that names the variable, in preference order, or null. */
export function suggestKeyColumn(header: readonly string[]): number | null {
  const names = header.map(normalise);
  for (const candidate of KEY_HEADERS) {
    const index = names.indexOf(candidate);
    if (index !== -1) return index;
  }
  return null;
}

/**
 * Columns to mask on load.
 *
 * Order of evidence: the header name, then the values themselves (a column of
 * JWTs is a column of secrets whatever it is called), then — for the common
 * two-column `key,value` file with unhelpful headers — the rightmost column,
 * which is where the value lives in every layout of that shape.
 */
export function suggestMaskColumns(table: Pick<CsvTable, 'header' | 'rows'>): number[] {
  const keyColumn = suggestKeyColumn(table.header);
  const candidates = table.header.map((_, index) => index).filter((index) => index !== keyColumn);
  if (candidates.length === 0) return [];

  const byHeader = candidates.filter((index) => VALUE_HEADER.test(table.header[index] ?? ''));
  if (byHeader.length > 0) return byHeader;

  const byValue = candidates.filter((index) =>
    table.rows.some((row) => isSecretValue(row[index] ?? '')),
  );
  if (byValue.length > 0) return byValue;

  return [candidates[candidates.length - 1]!];
}

/** Safe defaults for a freshly parsed table. */
export function defaultSettings(table: Pick<CsvTable, 'header' | 'rows'>): MaskSettings {
  const columnModes: Record<number, MaskMode> = {};
  for (const index of suggestMaskColumns(table)) columnModes[index] = 'hide';
  return { columnModes, keyModes: {}, keyColumn: suggestKeyColumn(table.header), keep: 4 };
}
