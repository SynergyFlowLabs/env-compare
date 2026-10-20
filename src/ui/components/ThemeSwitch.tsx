import { useTheme, type Theme } from '../lib/theme';
import { cn } from '../lib/utils';

const OPTIONS: Array<{ value: Theme; label: string; hint: string }> = [
  { value: 'system', label: 'Auto', hint: 'Follow the operating system' },
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
];

/**
 * Three explicit choices rather than a two-state toggle: "follow my OS" is a
 * real preference, and a toggle silently drops it.
 *
 * Segmented buttons with aria-pressed, not tabs: this is a setting, and tabs
 * would promise a panel that does not exist. Labels stay visible, because an
 * icon-only sun/moon is ambiguous about which state it describes.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary p-0.5"
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-sm px-2 py-1 text-[12px] leading-none text-muted-foreground transition-colors',
            'hover:text-foreground',
            'aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-[0_1px_0_rgb(0_0_0/6%)]',
            'focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
          )}
          aria-pressed={theme === option.value}
          title={option.hint}
          onClick={() => setTheme(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
