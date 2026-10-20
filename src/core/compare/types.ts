import type { Diagnostic, ParsedFile, VarOccurrence } from '../types';

export type FileRole = 'reference' | 'target';

/** Per-(key, file) state. `differs` is a row-level annotation, not a presence. */
export type Presence = 'present' | 'empty' | 'placeholder' | 'commented' | 'absent';

export type RowSeverity = 'error' | 'warning' | 'info' | 'ok';

export type Bucket = 'missing' | 'needsValue' | 'extra' | 'commented' | 'different' | 'matching';

export type CellAction = 'add' | 'uncomment' | 'remove' | 'fill';

export interface Cell {
  fileId: string;
  presence: Presence;
  /** True when the value looks sensitive — drives masking and the report. */
  isSecret: boolean;
  /** What the UI should offer for this cell, if anything. */
  action?: CellAction;
  occurrence?: VarOccurrence;
}

export interface KeyRow {
  key: string;
  /** In file order: reference first, then targets. */
  cells: Cell[];
  severity: RowSeverity;
  bucket: Bucket;
  /** Every file defines it with a `present` value, but they are not identical. */
  valueDiffers: boolean;
  /** True when the key exists only in the reference file. */
  onlyInReference: boolean;
}

export interface FileInput {
  id: string;
  name: string;
  role: FileRole;
  parsed: ParsedFile;
}

export interface FileSummary {
  fileId: string;
  name: string;
  role: FileRole;
  counts: Record<Presence, number>;
  diagnostics: Diagnostic[];
}

export interface ComparisonSummary {
  missing: number;
  needsValue: number;
  extra: number;
  commented: number;
  different: number;
  matching: number;
  total: number;
}

export interface Comparison {
  referenceId: string;
  targetIds: string[];
  rows: KeyRow[];
  perFile: FileSummary[];
  summary: ComparisonSummary;
  diagnostics: Record<string, Diagnostic[]>;
}

export const SEVERITY_RANK: Record<RowSeverity, number> = {
  ok: 0,
  info: 1,
  warning: 2,
  error: 3,
};

export const PRESENCE_LABEL: Record<Presence, string> = {
  present: 'Set',
  empty: 'Set, but empty',
  placeholder: 'Still the example value',
  commented: 'Commented out',
  absent: 'Missing from this file',
};
