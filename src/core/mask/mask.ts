import { isSecretKey, isSecretValue } from '../compare';
import type { EnvSource } from './env';

/**
 * Value masking for the env page (issue #10, reshaped by issue #13).
 *
 * What this is: **formatting, not encryption.** A masked value is the original
 * with characters replaced by `*`. There is no key, no salt and no cipher, and
 * the output cannot be un-masked from the file — the originals live only in the
 * page's memory, which is the same promise the rest of the app makes.
 *
 * There is one value column. The key is never masked: a model needs the names
 * to be useful, and a guessable key name tells an attacker far less than the
 * value it holds.
 */

export type MaskMode = 'none' | 'hide' | 'start' | 'middle' | 'end';

export const MASK_RUN = '********';

export interface MaskSettings {
  /** Mode for every value that has no per-key override. */
  valueMode: MaskMode;
  /** Key name → mode. Wins over `valueMode`. */
  keyModes?: Readonly<Record<string, MaskMode>>;
  /** How many characters a `start` / `middle` / `end` mask leaves visible. */
  keep: number;
}

export interface MaskedEntry {
  key: string;
  original: string;
  masked: string;
  mode: MaskMode;
  /** Index of an earlier entry with the same original value, or null. */
  duplicateOf: number | null;
}

export type MaskWarning =
  /** Variables left fully visible whose values look like credentials. */
  | { kind: 'unmasked-secret'; keys: string[] }
  /** Variables left fully visible whose *names* say they hold a secret. */
  | { kind: 'unmasked-secret-name'; keys: string[] };

export interface MaskedEnv {
  entries: MaskedEntry[];
  counts: { masked: number; unmasked: number; empty: number };
  warnings: MaskWarning[];
}

/** Clamp `keep` to something that always leaves the value mostly hidden. */
export function normaliseKeep(keep: number): number {
  if (!Number.isFinite(keep)) return 4;
  return Math.min(8, Math.max(1, Math.floor(keep)));
}

/**
 * Mask one value.
 *
 * A value too short to keep anything meaningful would otherwise be "masked" by
 * revealing all of it, so it is hidden completely instead: a mask that shows
 * the whole secret is worse than no mask, because it looks safe.
 */
export function maskValue(value: string, mode: MaskMode, keep = 4): string {
  if (mode === 'none' || value === '') return value;

  const n = normaliseKeep(keep);
  const star = (count: number) => '*'.repeat(Math.max(3, count));

  switch (mode) {
    case 'hide':
      return MASK_RUN;

    case 'start': {
      // Obfuscate from the start: the tail stays readable.
      if (value.length <= n) return MASK_RUN;
      return `${star(value.length - n)}${value.slice(-n)}`;
    }

    case 'end': {
      // Obfuscate from the end: the head stays readable, the way prefixes like
      // `sk-` are conventionally kept.
      if (value.length <= n) return MASK_RUN;
      return `${value.slice(0, n)}${star(value.length - n)}`;
    }

    case 'middle': {
      const head = Math.ceil(n / 2);
      const tail = Math.floor(n / 2);
      if (value.length <= n + 1 || tail === 0) return MASK_RUN;
      return `${value.slice(0, head)}${star(value.length - n)}${value.slice(-tail)}`;
    }
  }
}

export function modeFor(settings: MaskSettings, key: string): MaskMode {
  return settings.keyModes?.[key] ?? settings.valueMode;
}

/** Apply the settings to a parsed file. Pure: the source is only read. */
export function maskEnv(source: Pick<EnvSource, 'entries'>, settings: MaskSettings): MaskedEnv {
  const keep = normaliseKeep(settings.keep);
  const firstSeen = new Map<string, number>();

  const entries: MaskedEntry[] = source.entries.map((entry, index) => {
    const mode = modeFor(settings, entry.key);
    const masked = maskValue(entry.value, mode, keep);

    // Duplicates are reported, not encoded into the mask: a hash-suffixed mask
    // would let anyone who can guess the secret confirm the guess.
    let duplicateOf: number | null = null;
    if (mode !== 'none' && entry.value !== '') {
      const previous = firstSeen.get(entry.value);
      if (previous === undefined) firstSeen.set(entry.value, index);
      else duplicateOf = previous;
    }

    return { key: entry.key, original: entry.value, masked, mode, duplicateOf };
  });

  let masked = 0;
  let unmasked = 0;
  let empty = 0;
  for (const entry of entries) {
    if (entry.original === '') empty += 1;
    else if (entry.mode !== 'none') masked += 1;
    else unmasked += 1;
  }

  const visible = entries.filter((entry) => entry.mode === 'none' && entry.original !== '');
  const byValue = visible.filter((entry) => isSecretValue(entry.original)).map((entry) => entry.key);
  const byName = visible
    .filter((entry) => !byValue.includes(entry.key) && isSecretKey(entry.key))
    .map((entry) => entry.key);

  const warnings: MaskWarning[] = [];
  if (byValue.length > 0) warnings.push({ kind: 'unmasked-secret', keys: byValue });
  if (byName.length > 0) warnings.push({ kind: 'unmasked-secret-name', keys: byName });

  return { entries, counts: { masked, unmasked, empty }, warnings };
}
