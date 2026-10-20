import { PRESENCE_LABEL, type Cell, type Comparison, type FileSummary } from '../compare';

export type Redaction = 'keys' | 'masked' | 'full';

export interface ReportOptions {
  redaction?: Redaction;
  /** Injected for deterministic tests; defaults to now. */
  now?: Date;
  /** Local timezone label for the timestamp, e.g. "Asia/Karachi". */
  timeZone?: string;
}

/**
 * A shareable Markdown report (docs/PRD.md US-18).
 *
 * The default is **key names only**. This is the artefact people paste into a
 * PR, a Slack thread, or an AI chat, so it must be safe to share before anyone
 * thinks about whether it is.
 */
export function buildReport(comparison: Comparison, options: ReportOptions = {}): string {
  const redaction = options.redaction ?? 'keys';
  const now = options.now ?? new Date();
  const stamp = formatTimestamp(now, options.timeZone);
  const reference = comparison.perFile.find((f) => f.role === 'reference');
  const targets = comparison.perFile.filter((f) => f.role === 'target');
  const files = [...(reference ? [reference] : []), ...targets];

  const lines: string[] = [];
  lines.push('# EnvCompare report');
  lines.push('');
  lines.push(`Generated ${stamp} · [EnvCompare](https://github.com/SynergyFlowLabs/env-compare) · ran in the browser, nothing was uploaded.`);
  lines.push('');
  lines.push(
    `**Compared:** ${reference ? code(reference.name) : '—'} (reference) → ${targets
      .map((t) => code(t.name))
      .join(', ')}`,
  );
  lines.push('');

  // Counts per file.
  lines.push('| | ' + files.map((f) => code(f.name)).join(' | ') + ' |');
  lines.push('| --- |' + files.map(() => ' ---: |').join(''));
  for (const presence of ['absent', 'empty', 'placeholder', 'commented', 'present'] as const) {
    const label = presence === 'absent' ? 'Missing' : presence === 'present' ? 'Set' : PRESENCE_LABEL[presence];
    lines.push(`| ${label} | ${files.map((f) => f.counts[presence]).join(' | ')} |`);
  }
  lines.push('');

  const interesting = comparison.rows.filter((row) => row.bucket !== 'matching');
  const matching = comparison.rows.length - interesting.length;

  lines.push('## Variables');
  lines.push('');
  if (interesting.length === 0) {
    lines.push('Nothing is missing. Every key in the reference file is present.');
  } else {
    lines.push('| Key | ' + files.map((f) => code(f.name)).join(' | ') + ' |');
    lines.push('| --- |' + files.map(() => ' --- |').join(''));
    for (const row of interesting) {
      const cells = files.map((file) => describeCell(row.cells.find((c) => c.fileId === file.fileId), redaction));
      lines.push(`| ${code(row.key)} | ${cells.join(' | ')} |`);
    }
  }
  lines.push('');
  if (matching > 0) {
    lines.push(`${matching} other ${matching === 1 ? 'variable matches' : 'variables match'} and ${matching === 1 ? 'is' : 'are'} not listed.`);
    lines.push('');
  }

  const diagnostics = collectDiagnostics(comparison);
  if (diagnostics.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const note of diagnostics.slice(0, 8)) lines.push(`- ${note}`);
    if (diagnostics.length > 8) lines.push(`- …and ${diagnostics.length - 8} more.`);
    lines.push('');
  }

  lines.push('---');
  lines.push(redactionNote(redaction));
  return lines.join('\n');
}

function describeCell(cell: Cell | undefined, redaction: Redaction): string {
  if (!cell) return '—';
  const label = PRESENCE_LABEL[cell.presence];
  if (redaction === 'keys') return label;
  if (cell.presence !== 'present' && cell.presence !== 'placeholder') return label;

  const value = cell.occurrence?.value ?? '';
  if (redaction === 'masked') {
    if (value === '') return label;
    // Two lengths only: revealing the exact length is a (small) oracle.
    return `${label}: ${value.length > 12 ? '••••••••' : '••••'}`;
  }
  const shown = value.replace(/\|/g, '\\|').replace(/\n/g, '⏎');
  return `${label}: \`${shown}\``;
}

function collectDiagnostics(comparison: Comparison): string[] {
  const notes: string[] = [];
  for (const file of comparison.perFile) {
    for (const diagnostic of file.diagnostics) {
      if (diagnostic.severity === 'info' && diagnostic.code === 'MULTILINE') continue;
      notes.push(`${code(file.name)} line ${diagnostic.line}: ${diagnostic.message}`);
    }
  }
  return notes;
}

function redactionNote(redaction: Redaction): string {
  switch (redaction) {
    case 'keys':
      return '_Generated locally by EnvCompare. Contains key names only — no values._';
    case 'masked':
      return '_Generated locally by EnvCompare. Values are masked; lengths are rounded._';
    case 'full':
      return '> **This report contains real values.** Treat it like a password. Do not paste it into a chat, an issue, or a PR.';
  }
}

function formatTimestamp(date: Date, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone, timeZoneName: 'short' as const } : {}),
  });
  return formatter.format(date).replace(',', '');
}

function code(text: string): string {
  return `\`${text}\``;
}

/** Row-level counts, used by the summary card and the report. */
export function summarizeForFiles(perFile: FileSummary[]): string {
  return perFile
    .map((file) => `${file.name}: ${Object.entries(file.counts).map(([k, v]) => `${k} ${v}`).join(', ')}`)
    .join(' · ');
}
