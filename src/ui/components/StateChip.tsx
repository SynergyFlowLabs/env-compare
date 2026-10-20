import { PRESENCE_LABEL, type Presence } from '../../core/compare';
import { cn } from '../lib/utils';

const ICON: Record<Presence, string> = {
  present: '✓',
  empty: '!',
  placeholder: '✎',
  commented: '//',
  absent: '⊘',
};

const TONE: Record<Presence, string> = {
  present: 'text-ok',
  empty: 'text-empty',
  placeholder: 'text-placeholder',
  commented: 'text-commented',
  absent: 'text-missing',
};

interface StateChipProps {
  presence: Presence;
  /** Present cells are the default case: icon only, full label for screen readers. */
  quiet?: boolean;
}

export function StateChip({ presence, quiet = false }: StateChipProps) {
  const label = PRESENCE_LABEL[presence];
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium', TONE[presence])}
    >
      <span className="mono leading-none" aria-hidden="true">
        {ICON[presence]}
      </span>
      {quiet ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </span>
  );
}
