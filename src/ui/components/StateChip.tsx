import { Check, CircleAlert, MinusCircle, PenLine, Slash } from 'lucide-react';
import { PRESENCE_LABEL, type Presence } from '../../core/compare';
import { cn } from '../lib/utils';

/**
 * Line icons rather than typographic glyphs: they inherit the text colour, they
 * scale with the row, and they read the same in every font. Lucide is shadcn's
 * default set, so the states sit in the same visual language as the controls.
 */
const ICON: Record<Presence, typeof Check> = {
  present: Check,
  empty: CircleAlert,
  placeholder: PenLine,
  commented: Slash,
  absent: MinusCircle,
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
  const Icon = ICON[presence];
  const label = PRESENCE_LABEL[presence];
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium', TONE[presence])}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" focusable="false" />
      {quiet ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </span>
  );
}
