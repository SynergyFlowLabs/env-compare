import type { FileRole } from './types';

/**
 * Guess which file is the schema. Users should never have to understand the
 * word "reference" (docs/PRD.md US-02); we name the file and let them swap.
 */
const REFERENCE_PATTERNS = [
  /\.example$/i,
  /\.sample$/i,
  /\.template$/i,
  /\.dist$/i,
  /^example\.env$/i,
  /^sample\.env$/i,
  /^template\.env$/i,
  /^\.env\.example$/i,
];

export function isReferenceName(name: string): boolean {
  const trimmed = name.trim();
  return REFERENCE_PATTERNS.some((rx) => rx.test(trimmed));
}

/** Reference = the example-ish file, else the first file. */
export function assignRoles(names: string[]): FileRole[] {
  const referenceIndex = names.findIndex(isReferenceName);
  const index = referenceIndex >= 0 ? referenceIndex : 0;
  return names.map((_, i) => (i === index ? 'reference' : 'target'));
}
