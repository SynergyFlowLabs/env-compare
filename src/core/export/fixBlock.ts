import type { Comparison } from '../compare';

export interface FixBlock {
  text: string;
  keys: string[];
}

/**
 * The block a user pastes into their env file (docs/PRD.md US-16).
 *
 * Values are **always blank**: this block may be built from a reference file
 * whose values are placeholders while the real values live in another file, and
 * copying a value across environments is exactly the mistake this tool exists
 * to prevent.
 */
export function buildFixBlock(comparison: Comparison, targetId: string): FixBlock {
  const keys: string[] = [];

  for (const row of comparison.rows) {
    const cell = row.cells.find((c) => c.fileId === targetId);
    if (!cell) continue;
    const reference = row.cells.find((c) => c.fileId === comparison.referenceId);
    // A key the reference only documents as a comment is optional: never push it
    // into someone's file automatically.
    if (reference?.presence === 'commented') continue;
    if (cell.action === 'add' || cell.action === 'uncomment') keys.push(row.key);
  }

  if (keys.length === 0) return { text: '', keys };

  const body = keys.map((key) => `${key}=`).join('\n');
  return {
    text: `# Added by EnvCompare — fill in the values\n${body}\n`,
    keys,
  };
}
