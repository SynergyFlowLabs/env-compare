import { useTheme, type Theme } from '../lib/theme';

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
    <div className="theme-switch" role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="theme-switch__option"
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
