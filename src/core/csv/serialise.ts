/**
 * CSV writing.
 *
 * The masked file is meant to be handed to an AI tool or pasted into a ticket,
 * so it has to be *ordinary* CSV: RFC 4180 quoting, the delimiter and line
 * ending the source used, and no cleverness. A field is quoted only when it has
 * to be — over-quoting is valid but makes diffs and eyeballing worse.
 */

export interface SerialiseOptions {
  delimiter?: string;
  lineEnding?: '\n' | '\r\n';
  trailingNewline?: boolean;
}

function needsQuoting(field: string, delimiter: string): boolean {
  if (field === '') return false;
  return (
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r') ||
    // Leading/trailing whitespace survives only inside quotes; unquoted, most
    // parsers trim it and the value silently changes.
    /^\s|\s$/.test(field)
  );
}

export function quoteField(field: string, delimiter = ','): string {
  if (!needsQuoting(field, delimiter)) return field;
  return `"${field.replaceAll('"', '""')}"`;
}

export function serialiseCsv(rows: readonly (readonly string[])[], options: SerialiseOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const lineEnding = options.lineEnding ?? '\n';
  const trailingNewline = options.trailingNewline ?? true;

  const body = rows
    .map((row) => row.map((field) => quoteField(field, delimiter)).join(delimiter))
    .join(lineEnding);

  if (body === '') return '';
  return trailingNewline ? `${body}${lineEnding}` : body;
}
