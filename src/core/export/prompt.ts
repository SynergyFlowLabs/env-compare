import type { Comparison } from '../compare';

/**
 * A copy-ready instruction for the AI agent that wrote the `.env.example`
 * (docs/PRD.md US-19).
 *
 * Key names only, never values — the whole reason this tool exists is that the
 * agent is not allowed to see the `.env` contents.
 */
export function buildAgentPrompt(comparison: Comparison, targetId: string): string {
  const target = comparison.perFile.find((f) => f.fileId === targetId);
  const reference = comparison.perFile.find((f) => f.role === 'reference');
  if (!target || !reference) return '';

  const missing: string[] = [];
  const empty: string[] = [];
  for (const row of comparison.rows) {
    const cell = row.cells.find((c) => c.fileId === targetId);
    const refCell = row.cells.find((c) => c.fileId === comparison.referenceId);
    if (refCell?.presence === 'commented') continue;
    if (cell?.action === 'add' || cell?.action === 'uncomment') missing.push(row.key);
    else if (cell?.action === 'fill') empty.push(row.key);
  }

  if (missing.length === 0 && empty.length === 0) return '';

  const lines: string[] = [];
  lines.push(
    `My \`${target.name}\` is out of sync with \`${reference.name}\`. Please help me fix it.`,
  );
  lines.push('');
  if (missing.length > 0) {
    lines.push(`Missing from \`${target.name}\` (present in \`${reference.name}\`):`);
    for (const key of missing) lines.push(`- ${key}`);
    lines.push('');
  }
  if (empty.length > 0) {
    lines.push(`Present but empty or still a placeholder in \`${target.name}\`:`);
    for (const key of empty) lines.push(`- ${key}`);
    lines.push('');
  }
  lines.push(
    `Add the missing keys with empty values and tell me, for each one, where I can obtain a real value. Do not invent values, and do not ask me to paste any secret into this chat.`,
  );
  return lines.join('\n');
}
