/**
 * Secret detection (docs/PRD.md §12.10).
 *
 * Detection is local, deterministic and one-directional: it can only *add*
 * masking or a warning, never remove or rewrite data. It is used for three
 * things and nothing else:
 *   1. deciding what to mask when "Hide values" is on,
 *   2. the "this looks like a live credential" hint,
 *   3. redaction in the shared report.
 */

const SECRET_KEY_SIGNALS = [
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'PASSWD',
  'PWD',
  'API_KEY',
  'APIKEY',
  'PRIVATE_KEY',
  'ACCESS_KEY',
  'CLIENT_SECRET',
  'CREDENTIAL',
  'DSN',
  'DATABASE_URL',
  'CONNECTION_STRING',
  'WEBHOOK',
  'SIGNING',
  'SALT',
  'SERVICE_ROLE',
  'AUTH',
];

const VALUE_SIGNALS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWT
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/, // Stripe
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/, // Slack
  /\bAIza[0-9A-Za-z_-]{35}\b/, // Google API key
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}/, // OpenAI / Anthropic
  /\bnpm_[A-Za-z0-9]{20,}/,
  /\bshpat_[A-Za-z0-9]{10,}/, // Shopify
  /\bSG\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // SendGrid
  /\bdckr_pat_[A-Za-z0-9_-]{10,}/, // Docker
  /^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i, // scheme://user:password@host
];

/** Values that are obviously not secrets, even when the key name looks juicy. */
const NOT_SECRET_VALUES = new Set([
  'true',
  'false',
  '0',
  '1',
  'production',
  'development',
  'test',
  'staging',
  'none',
  'null',
  'undefined',
  '',
]);

export function isSecretKey(key: string): boolean {
  const upper = key.toUpperCase();
  return SECRET_KEY_SIGNALS.some((signal) => upper.includes(signal));
}

export function isSecretValue(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) return false;
  if (NOT_SECRET_VALUES.has(v.toLowerCase())) return false;
  return VALUE_SIGNALS.some((rx) => rx.test(v));
}

/** Should this whole value be masked by default? */
export function looksLikeSecret(key: string, value: string): boolean {
  const v = value.trim();
  if (NOT_SECRET_VALUES.has(v.toLowerCase())) return false;
  if (isSecretValue(v)) return true;
  if (isSecretKey(key) && v.length > 0) return true;
  return false;
}

/**
 * Key-name-only heuristic for the "make sure .env is in .gitignore" hint.
 * Deliberately narrower than `looksLikeSecret`: we only nag when the *value*
 * looks like a real credential, not merely when the key sounds sensitive.
 */
export function looksLikeLiveCredential(value: string): boolean {
  return isSecretValue(value) && !/x{4,}|changeme|your[-_]/i.test(value);
}
