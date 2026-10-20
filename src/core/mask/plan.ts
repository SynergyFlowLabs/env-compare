import { isSecretKey } from '../compare';
import type { EnvSource } from './env';

/**
 * The first guess, so the page opens already safe.
 *
 * The rule is the one the rest of the product follows: detection may only ever
 * *add* masking. It never unmasks, never rewrites a value, and the reader can
 * override every part of it. Being wrong in the cautious direction costs one
 * click; being wrong in the other direction leaks a token.
 *
 * With a fixed key/value shape there is no column to choose, so the only
 * question is which values hide on arrival.
 */

/**
 * Values that are configuration, not credentials. Leaving these visible is what
 * makes the output worth handing to a model at all: `LOG_LEVEL=info` and
 * `PORT=3000` reveal nothing, and hiding them means the reader has to un-hide
 * half the file before anything is understandable.
 */
const SAFE_VALUE =
  /^(true|false|yes|no|on|off|null|none|undefined|info|warn|error|debug|trace|log|production|development|staging|testing|test|local|preview)$/i;
const SAFE_SHAPE = /^(https?:\/\/[^\s@]+|\d+|[\w-]{1,6})$/i;

/** Should this variable's value be hidden the moment the file is read? */
export function shouldMaskOnArrival(key: string, value: string): boolean {
  if (value === '') return false;
  // A name that says `SECRET`/`TOKEN`/`URL`/… outranks a harmless-looking value:
  // `SECRET_KEY=abc123` is still a secret.
  if (isSecretKey(key)) return true;
  const trimmed = value.trim();
  return !(SAFE_VALUE.test(trimmed) || SAFE_SHAPE.test(trimmed));
}

export function keysToMask(source: Pick<EnvSource, 'entries'>): string[] {
  return source.entries
    .filter((entry) => shouldMaskOnArrival(entry.key, entry.value))
    .map((entry) => entry.key);
}

/** Safe defaults for a freshly read file: hide everything but the obvious configuration. */
export function defaultSettings(source: Pick<EnvSource, 'entries'>): {
  valueMode: 'hide';
  keyModes: Record<string, 'none'>;
} {
  const keyModes: Record<string, 'none'> = {};
  for (const entry of source.entries) {
    if (entry.value !== '' && !shouldMaskOnArrival(entry.key, entry.value)) {
      keyModes[entry.key] = 'none';
    }
  }
  return { valueMode: 'hide', keyModes };
}
