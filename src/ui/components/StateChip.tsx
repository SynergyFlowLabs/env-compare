import { PRESENCE_LABEL, type Presence } from '../../core/compare';

const ICON: Record<Presence, string> = {
  present: '✓',
  empty: '!',
  placeholder: '✎',
  commented: '//',
  absent: '⊘',
};

interface StateChipProps {
  presence: Presence;
  /** Present cells are the default case: icon only, full label for screen readers. */
  quiet?: boolean;
}

export function StateChip({ presence, quiet = false }: StateChipProps) {
  const label = PRESENCE_LABEL[presence];
  return (
    <span className="state">
      <span className="state__icon" aria-hidden="true">
        {ICON[presence]}
      </span>
      {quiet ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </span>
  );
}
