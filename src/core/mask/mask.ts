import { serialiseCsv } from '../csv';
import { isSecretKey, isSecretValue } from '../compare';

/**
 * Value masking for the CSV page (issue #10).
 *
 * What this is: **formatting, not encryption.** A masked value is the original
 * with characters replaced by `*`. There is no key, no salt and no cipher, and
 * the output cannot be un-masked from the file — the originals live only in the
 * page's memory, which is the same promise the rest of the app makes.
 *
 * What it does preserve, on purpose:
 *   - the same input masks to the same output, so two rows that hold the same
 *     secret still look identical after masking (that is often the very thing
 *     being checked);
 *   - the shape of the CSV: row order, column order, delimiter, quoting.
 *
 * What it deliberately does not preserve: anything the chosen mode keeps.
 * `hide` also hides the length, which is why it is the default for a column
 * that looks like it holds credentials.
 */

export type MaskMode = 'none' | 'hide' | 'start' | 'middle' | 'end';

export const MASK_RUN = '********';

export interface MaskSettings {
  /** Column index → mode. Missing means `none`. */
  columnModes: Readonly<Record<number, MaskMode>>;
  /** Key name → mode, overriding the column. Only used when `keyColumn` is set. */
  keyModes?: Readonly<Record<string, MaskMode>>;
  keyColumn?: number | null;
  /** How many characters a `start` / `middle` / `end` mask leaves visible. */
  keep: number;
}

export interface MaskCell {
  original: string;
  masked: string;
  mode: MaskMode;
  /** Index of an earlier data row with the same original in this column, or null. */
  duplicateOf: number | null;
}

export type MaskWarning =
  | { kind: 'unmasked-secret'; column: number; columnName: string; rows: number[] }
  | { kind: 'key-column-masked'; column: number; columnName: string };

export interface MaskedCsv {
  header: string[];
  /** The masked data rows, ready to serialise. */
  rows: string[][];
  /** Per-cell detail, aligned with `rows`, for the preview and the duplicate hints. */
  cells: MaskCell[][];
  counts: { masked: number; unmasked: number; empty: number };
  warnings: MaskWarning[];
}

/** Clamp `keep` to something that always leaves the value mostly hidden. */
export function normaliseKeep(keep: number): number {
  if (!Number.isFinite(keep)) return 4;
  return Math.min(8, Math.max(1, Math.floor(keep)));
}

/**
 * Mask one value.
 *
 * A value too short to keep anything meaningful would otherwise be "masked" by
 * revealing all of it, so it is hidden completely instead: a mask that shows
 * the whole secret is worse than no mask, because it looks safe.
 */
export function maskValue(value: string, mode: MaskMode, keep = 4): string {
  if (mode === 'none' || value === '') return value;

  const n = normaliseKeep(keep);
  const star = (count: number) => '*'.repeat(Math.max(3, count));

  switch (mode) {
    case 'hide':
      return MASK_RUN;

    case 'start': {
      // Obfuscate from the start: the tail stays readable.
      if (value.length <= n) return MASK_RUN;
      return `${star(value.length - n)}${value.slice(-n)}`;
    }

    case 'end': {
      // Obfuscate from the end: the head stays readable, the way prefixes like
      // `sk-` are conventionally kept.
      if (value.length <= n) return MASK_RUN;
      return `${value.slice(0, n)}${star(value.length - n)}`;
    }

    case 'middle': {
      const head = Math.ceil(n / 2);
      const tail = Math.floor(n / 2);
      if (value.length <= n + 1 || tail === 0) return MASK_RUN;
      return `${value.slice(0, head)}${star(value.length - n)}${value.slice(-tail)}`;
    }
  }
}

function modeFor(settings: MaskSettings, column: number, key: string | undefined): MaskMode {
  if (key !== undefined && key !== '') {
    const override = settings.keyModes?.[key];
    if (override !== undefined) return override;
  }
  return settings.columnModes[column] ?? 'none';
}

/** Apply the settings to a parsed table. Pure: the originals are only read, never replaced. */
export function maskCsv(
  table: { header: string[]; rows: string[][] },
  settings: MaskSettings,
): MaskedCsv {
  const keep = normaliseKeep(settings.keep);
  const keyColumn =
    settings.keyColumn !== null && settings.keyColumn !== undefined && settings.keyColumn >= 0
      ? settings.keyColumn
      : null;

  /** Per column, the first data row each original appeared in. */
  const firstSeen: Array<Map<string, number>> = table.header.map(() => new Map<string, number>());

  const cells: MaskCell[][] = table.rows.map((row, rowIndex) =>
    table.header.map((_, column) => {
      const original = row[column] ?? '';
      const key = keyColumn === null ? undefined : (row[keyColumn] ?? '').trim();
      const mode = modeFor(settings, column, key);
      const masked = maskValue(original, mode, keep);

      // Duplicates are reported, not encoded into the mask: a hash-suffixed mask
      // would let anyone who can guess the secret confirm the guess.
      let duplicateOf: number | null = null;
      if (mode !== 'none' && original !== '') {
        const seen = firstSeen[column]!;
        const previous = seen.get(original);
        if (previous === undefined) seen.set(original, rowIndex);
        else duplicateOf = previous;
      }

      return { original, masked, mode, duplicateOf };
    }),
  );

  let masked = 0;
  let unmasked = 0;
  let empty = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (cell.original === '') empty += 1;
      else if (cell.mode !== 'none') masked += 1;
      else unmasked += 1;
    }
  }

  const warnings: MaskWarning[] = [];
  table.header.forEach((name, column) => {
    const suspiciousRows: number[] = [];
    cells.forEach((row, rowIndex) => {
      const cell = row[column]!;
      if (cell.mode === 'none' && cell.original !== '' && isSecretValue(cell.original)) {
        suspiciousRows.push(rowIndex);
      }
    });

    if (suspiciousRows.length === 0) return;
    warnings.push({
      kind: 'unmasked-secret',
      column,
      columnName: name,
      rows: suspiciousRows.slice(0, 20),
    });
  });
  // A column whose *name* says secret and that is left wide open is worth a
  // warning even when no value matched a known credential shape.
  table.header.forEach((name, column) => {
    if (warnings.some((warning) => warning.column === column)) return;
    const hasValues = cells.some((row) => row[column]?.mode === 'none' && row[column]!.original !== '');
    if (hasValues && isSecretKey(name)) {
      warnings.push({ kind: 'unmasked-secret', column, columnName: name, rows: [] });
    }
  });

  if (keyColumn !== null && (settings.columnModes[keyColumn] ?? 'none') !== 'none') {
    warnings.push({
      kind: 'key-column-masked',
      column: keyColumn,
      columnName: table.header[keyColumn] ?? `Column ${keyColumn + 1}`,
    });
  }

  return {
    header: table.header,
    rows: cells.map((row) => row.map((cell) => cell.masked)),
    cells,
    counts: { masked, unmasked, empty },
    warnings,
  };
}

/** The exported text: header plus masked rows, in the file's own dialect. */
export function maskedText(
  masked: MaskedCsv,
  dialect: { delimiter: string; lineEnding: '\n' | '\r\n' },
  options: { includeHeader?: boolean } = {},
): string {
  const includeHeader = options.includeHeader ?? true;
  return serialiseCsv(includeHeader ? [masked.header, ...masked.rows] : masked.rows, {
    delimiter: dialect.delimiter,
    lineEnding: dialect.lineEnding,
  });
}
