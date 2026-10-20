import type { Comparison } from '../../core/compare';

interface SummaryLineProps {
  comparison: Comparison;
}

/**
 * The one sentence a non-technical user needs (PRD US-06).
 *
 * Deliberately a sentence, not a dashboard: counts are emphasised inline, file
 * names are monospaced, and the whole thing is announced politely once.
 */
export function SummaryLine({ comparison }: SummaryLineProps) {
  const reference = comparison.perFile.find((f) => f.role === 'reference');
  const targets = comparison.perFile.filter((f) => f.role === 'target');
  const targetLabel = targets.map((t) => t.name).join(' and ') || 'your file';
  const referenceLabel = reference?.name ?? 'the reference file';
  const { missing, needsValue, extra, commented } = comparison.summary;

  const problems = missing + needsValue;
  const clauses: Array<{ text: string; tone: 'problem' | 'note' }> = [];

  if (missing > 0) {
    clauses.push({
      text: `${missing} ${missing === 1 ? 'variable is' : 'variables are'} in ${referenceLabel} but missing from ${targetLabel}.`,
      tone: 'problem',
    });
  }
  if (needsValue > 0) {
    clauses.push({
      text: `${needsValue} ${needsValue === 1 ? 'needs' : 'need'} a value — ${needsValue === 1 ? 'it is' : 'they are'} empty or still the example.`,
      tone: 'problem',
    });
  }
  if (extra > 0) {
    clauses.push({
      text: `${extra} ${extra === 1 ? 'is' : 'are'} only in ${targetLabel} and no longer in ${referenceLabel}.`,
      tone: 'note',
    });
  }
  if (commented > 0) {
    clauses.push({
      text: `${commented} ${commented === 1 ? 'is' : 'are'} commented out in ${referenceLabel} — optional, nothing to do.`,
      tone: 'note',
    });
  }

  const clean = problems === 0 && extra === 0;

  if (comparison.summary.total === 0) {
    return (
      <p className="flex items-start gap-2 text-[15px] text-muted-foreground" aria-live="polite">
        <span className="mt-px shrink-0 select-none text-faint" aria-hidden="true">
          ·
        </span>
        <span>Paste both files to see what is missing.</span>
      </p>
    );
  }

  if (clean) {
    return (
      <p className="flex items-start gap-2 text-[15px]" aria-live="polite">
        <span className="mt-px shrink-0 select-none font-semibold text-ok" aria-hidden="true">
          ✓
        </span>
        <span>
          Nothing is missing. {targetLabel} matches {referenceLabel} across{' '}
          {comparison.summary.total} {comparison.summary.total === 1 ? 'variable' : 'variables'}.
        </span>
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 text-[15px]" aria-live="polite">
      <span className="mt-px shrink-0 select-none text-missing" aria-hidden="true">
        ⚠
      </span>
      <span>
        {clauses.map((clause, index) => (
          <span key={clause.text} className={clause.tone === 'note' ? 'text-muted-foreground' : undefined}>
            {index > 0 ? ' ' : ''}
            {clause.text}
          </span>
        ))}
      </span>
    </p>
  );
}
