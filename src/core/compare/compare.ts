import type { Diagnostic, ParsedFile } from '../types';
import { findUnresolvedRefs } from '../parse';
import { isHighConfidencePlaceholder } from './placeholder';
import { looksLikeSecret } from './secrets';
import {
  SEVERITY_RANK,
  type Bucket,
  type Cell,
  type Comparison,
  type ComparisonSummary,
  type FileInput,
  type FileSummary,
  type KeyRow,
  type Presence,
  type RowSeverity,
} from './types';

/**
 * Compare a reference file against one or more targets (docs/PRD.md §9.4).
 *
 * Row order: the reference's order first, then keys that only exist in targets,
 * in first-appearance order across the targets.
 */
export function compare(inputs: FileInput[]): Comparison {
  const reference = inputs.find((f) => f.role === 'reference') ?? inputs[0];
  if (!reference) {
    return emptyComparison();
  }
  const targets = inputs.filter((f) => f.id !== reference.id);
  const ordered = [reference, ...targets];

  const keys = collectKeys(reference.parsed, targets.map((t) => t.parsed));
  const rows = keys.map((key) => buildRow(key, reference, targets));

  const perFile: FileSummary[] = ordered.map((file) => ({
    fileId: file.id,
    name: file.name,
    role: file.role,
    counts: countPresence(rows, file.id),
    diagnostics: [...file.parsed.diagnostics, ...findUnresolvedRefs(file.parsed)],
  }));

  const diagnostics: Record<string, Diagnostic[]> = {};
  for (const file of perFile) diagnostics[file.fileId] = file.diagnostics;

  return {
    referenceId: reference.id,
    targetIds: targets.map((t) => t.id),
    rows,
    perFile,
    summary: summarize(rows),
    diagnostics,
  };
}

const BUCKET_PRIORITY: Record<Bucket, number> = {
  missing: 6,
  needsValue: 5,
  extra: 4,
  commented: 3,
  different: 2,
  matching: 1,
};

function collectKeys(reference: ParsedFile, targets: ParsedFile[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of reference.order) {
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  // Optional integrations documented as `# SENTRY_DSN=` belong in the table
  // too: the user needs to see that the option exists and is switched off.
  for (const key of reference.commentedKeys.keys()) {
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  for (const target of targets) {
    for (const key of target.order) {
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

function buildRow(key: string, reference: FileInput, targets: FileInput[]): KeyRow {
  const referenceCell = classify(key, reference);
  const targetCells = targets.map((target) => classify(key, target));
  const cells = [referenceCell, ...targetCells];

  const outcome = decide(referenceCell, targetCells);
  const valueDiffers =
    cells.every((cell) => cell.presence === 'present') &&
    new Set(cells.map((cell) => cell.occurrence?.value ?? '')).size > 1;

  const onlyInReference =
    referenceCell.presence !== 'absent' &&
    targetCells.every((cell) => cell.presence === 'absent' || cell.presence === 'commented');

  return {
    key,
    cells,
    severity: valueDiffers && outcome.severity === 'ok' ? 'info' : outcome.severity,
    bucket: valueDiffers && outcome.bucket === 'matching' ? 'different' : outcome.bucket,
    valueDiffers,
    onlyInReference,
  };
}

function classify(key: string, file: FileInput): Cell {
  const occurrence = file.parsed.effective.get(key);
  const base = { fileId: file.id, occurrence };

  if (!occurrence) {
    const commented = file.parsed.commentedKeys.has(key);
    return {
      ...base,
      presence: commented ? 'commented' : 'absent',
      isSecret: looksLikeSecret(key, ''),
    };
  }

  const presence: Presence =
    occurrence.value === ''
      ? 'empty'
      : isHighConfidencePlaceholder(occurrence.value)
        ? 'placeholder'
        : 'present';

  return {
    ...base,
    presence,
    isSecret: looksLikeSecret(key, occurrence.value),
  };
}

interface Outcome {
  severity: RowSeverity;
  bucket: Bucket;
}

/**
 * Row verdict from the reference cell plus every target cell.
 *
 * The rule that a per-file state cannot express: when the *reference* documents
 * a key only as a comment (`# SENTRY_DSN=`), an absent target is not an error.
 * It is an optional integration that is switched off (PRD §9.4).
 */
function decide(reference: Cell, targets: Cell[]): Outcome {
  if (reference.presence === 'absent') {
    // Key lives only in the targets: leftovers, never an error.
    const anyTarget = targets.some(
      (cell) => cell.presence === 'present' || cell.presence === 'empty',
    );
    const anyCommented = targets.some((cell) => cell.presence === 'commented');
    if (anyTarget) {
      for (const cell of targets) {
        if (cell.presence === 'present' || cell.presence === 'empty') cell.action = 'remove';
      }
      return { severity: 'info', bucket: 'extra' };
    }
    if (anyCommented) return { severity: 'info', bucket: 'commented' };
    return { severity: 'ok', bucket: 'matching' };
  }

  let worst: Outcome = { severity: 'ok', bucket: 'matching' };

  for (const cell of targets) {
    const outcome = classifyTargetCell(reference.presence, cell);
    const rank = SEVERITY_RANK[outcome.severity] - SEVERITY_RANK[worst.severity];
    // Same severity but different problems (e.g. absent in one file, empty in
    // another): report the most actionable one, so "missing" wins over "empty".
    if (rank > 0 || (rank === 0 && BUCKET_PRIORITY[outcome.bucket] > BUCKET_PRIORITY[worst.bucket])) {
      worst = outcome;
    }
  }

  return worst;
}

function classifyTargetCell(reference: Presence, cell: Cell): Outcome {
  switch (cell.presence) {
    case 'absent':
      if (reference === 'commented') return { severity: 'info', bucket: 'commented' };
      cell.action = 'add';
      return { severity: 'error', bucket: 'missing' };
    case 'commented':
      if (reference === 'commented') return { severity: 'info', bucket: 'commented' };
      cell.action = 'uncomment';
      return { severity: 'error', bucket: 'missing' };
    case 'empty':
      cell.action = 'fill';
      return { severity: 'error', bucket: 'needsValue' };
    case 'placeholder':
      cell.action = 'fill';
      return { severity: 'warning', bucket: 'needsValue' };
    case 'present':
      return { severity: 'ok', bucket: 'matching' };
  }
}

function countPresence(rows: KeyRow[], fileId: string): Record<Presence, number> {
  const counts: Record<Presence, number> = {
    present: 0,
    empty: 0,
    placeholder: 0,
    commented: 0,
    absent: 0,
  };
  for (const row of rows) {
    const cell = row.cells.find((c) => c.fileId === fileId);
    if (cell) counts[cell.presence] += 1;
  }
  return counts;
}

function summarize(rows: KeyRow[]): ComparisonSummary {
  const summary: ComparisonSummary = {
    missing: 0,
    needsValue: 0,
    extra: 0,
    commented: 0,
    different: 0,
    matching: 0,
    total: rows.length,
  };
  for (const row of rows) summary[row.bucket] += 1;
  return summary;
}

function emptyComparison(): Comparison {
  return {
    referenceId: '',
    targetIds: [],
    rows: [],
    perFile: [],
    summary: {
      missing: 0,
      needsValue: 0,
      extra: 0,
      commented: 0,
      different: 0,
      matching: 0,
      total: 0,
    },
    diagnostics: {},
  };
}

/** Optional alphabetical ordering for the table. Stable and case-insensitive. */
export function sortRows(rows: KeyRow[], mode: 'file' | 'alpha'): KeyRow[] {
  if (mode === 'file') return rows;
  return [...rows].sort((a, b) => {
    const lower = a.key.toLowerCase().localeCompare(b.key.toLowerCase());
    return lower !== 0 ? lower : a.key.localeCompare(b.key);
  });
}
