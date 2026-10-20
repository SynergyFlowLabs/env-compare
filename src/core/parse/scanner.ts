import type { Diagnostic, ParsedFile, SourceLine, VarOccurrence } from '../types';
import { countLines, lineNumberAt, splitLines } from './lines';
import {
  DOTENV_LINE,
  DOTENV_LINE_SINGLE,
  detectQuote,
  extractRefs,
  normalizeValue,
} from './dotenvCompat';

const MAX_BYTES = 2 * 1024 * 1024;
const MANY_KEYS = 2000;

export function emptyParsedFile(fileId: string): ParsedFile {
  return {
    fileId,
    occurrences: [],
    effective: new Map(),
    commentedKeys: new Set(),
    order: [],
    diagnostics: [],
    stats: { lines: 0, bytes: 0, keyCount: 0, duplicateCount: 0 },
  };
}

/**
 * Parse env-file text into a lossless structure: every assignment keeps its
 * absolute offsets so the UI can render the original text and apply surgical
 * edits without ever regenerating the file.
 *
 * Grammar and value semantics are dotenv v18's (see dotenvCompat.ts). The
 * additions are diagnostics: dotenv silently skips what it cannot parse, which
 * is exactly the situation where a user needs to be told what happened.
 */
export function parseEnvFile(fileId: string, text: string): ParsedFile {
  const bytes = byteLength(text);
  const lines = splitLines(text);

  if (text.includes('\u0000')) {
    return {
      ...emptyParsedFile(fileId),
      diagnostics: [
        {
          code: 'NOT_TEXT',
          severity: 'error',
          line: 1,
          message: "This doesn't look like a text file.",
        },
      ],
    };
  }

  if (bytes > MAX_BYTES) {
    return {
      ...emptyParsedFile(fileId),
      diagnostics: [
        {
          code: 'TOO_LARGE',
          severity: 'error',
          line: 1,
          message: 'This file is larger than 2 MB. Paste a smaller file.',
        },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  const occurrences: VarOccurrence[] = [];
  const effective = new Map<string, VarOccurrence>();
  const commentedKeys = new Set<string>();
  const order: string[] = [];
  /** Raw (newline-exclusive) ranges consumed by a successful match. */
  const covered: Array<[number, number]> = [];
  let duplicateCount = 0;

  DOTENV_LINE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DOTENV_LINE.exec(text)) !== null) {
    const indices = match.indices;
    const keyRange = indices?.[1];
    const valueRange = indices?.[2];
    const keyRaw = match[1];
    if (!indices || !keyRange || !keyRaw) break; // defensive; the grammar requires a key

    const rawValue = valueRange ? text.slice(valueRange[0], valueRange[1]) : '';
    const value = normalizeValue(rawValue);
    const quote = detectQuote(rawValue);

    // The grammar's leading `\s*` can consume the previous line's terminator,
    // so `match.index` is not reliable for line numbers. Anchor everything to
    // the key offset and the physical line that contains it.
    const startLine = lineNumberAt(lines, keyRange[0]);
    const endLine = lineNumberAt(
      lines,
      valueRange
        ? Math.max(valueRange[0], valueRange[1] - 1)
        : Math.max(keyRange[1], keyRange[0]),
    );
    const firstLine = lines[startLine - 1];
    const lastLine = lines[Math.max(endLine - 1, 0)];
    const spanStart = firstLine ? firstLine.span.start : match.index;
    const spanEnd = extendOverNewline(text, lastLine ? lastLine.span.end : match.index + match[0].length);

    const afterValue = valueRange ? valueRange[1] : keyRange[1];
    const rest = text.slice(afterValue, match.index + match[0].length);
    const hashIndex = rest.indexOf('#');
    const trailingComment = hashIndex >= 0 ? rest.slice(hashIndex).trimEnd() : undefined;

    // `PASSWORD=abc#123` is parsed by dotenv as `abc`: `#` starts a comment even
    // without a space. Users almost never mean that, so we warn instead of
    // silently truncating their secret.
    if (
      quote === 'none' &&
      valueRange &&
      text[valueRange[1]] === '#' &&
      valueRange[1] > valueRange[0] &&
      !/\s/.test(text[valueRange[1] - 1] ?? '')
    ) {
      diagnostics.push({
        code: 'SUSPECT_HASH_TRUNCATION',
        severity: 'warning',
        line: startLine,
        key: keyRaw,
        message: `Line ${startLine}: the value stops at "#". If your value contains "#", wrap it in quotes — otherwise it is cut off here.`,
      });
    }

    const occurrence: VarOccurrence = {
      key: keyRaw,
      keyRaw,
      value,
      valueRaw: rawValue,
      quote,
      isExport: /\bexport\s+$/.test(text.slice(spanStart, keyRange[0])),
      line: startLine,
      endLine,
      span: { start: spanStart, end: spanEnd },
      valueSpan: valueRange
        ? { start: valueRange[0], end: valueRange[1] }
        : { start: keyRange[1], end: keyRange[1] },
      keySpan: { start: keyRange[0], end: keyRange[1] },
      ...(trailingComment ? { trailingComment } : {}),
      refs: extractRefs(value),
    };
    occurrences.push(occurrence);
    covered.push([match.index, match.index + match[0].length]);

    if (endLine > startLine) {
      diagnostics.push({
        code: 'MULTILINE',
        severity: 'info',
        line: startLine,
        key: keyRaw,
        message: `${keyRaw} spans lines ${startLine}–${endLine}.`,
      });
    }

    const previous = effective.get(keyRaw);
    if (previous) {
      duplicateCount += 1;
      diagnostics.push({
        code: 'DUP_KEY',
        severity: 'warning',
        line: startLine,
        key: keyRaw,
        message: `${keyRaw} is defined twice (lines ${previous.line}, ${startLine}). The last one wins.`,
      });
    } else {
      order.push(keyRaw);
    }
    effective.set(keyRaw, occurrence);
  }

  // Lines no match consumed: blanks, comments, commented-out assignments, and
  // the invalid lines dotenv silently drops.
  findUncoveredLines(lines, covered, (line) => {
    const raw = stripBom(line.text);
    const trimmed = raw.trim();
    if (trimmed === '') return;

    if (trimmed.startsWith('#')) {
      const body = trimmed.replace(/^#+\s*/, '');
      if (body === '') return;
      const commented = DOTENV_LINE_SINGLE.exec(body);
      const commentedKey = commented?.[1];
      if (commentedKey) commentedKeys.add(commentedKey);
      return;
    }

    if (/^[\w.-]+\s*:\S/.test(trimmed)) {
      diagnostics.push({
        code: 'COLON_NO_SPACE',
        severity: 'info',
        line: line.number,
        message: `Line ${line.number}: a colon separator needs a space after it — write \`KEY: value\`, not \`KEY:value\`.`,
      });
      return;
    }

    if (trimmed.includes('=')) {
      diagnostics.push({
        code: 'PARSE_BAD_KEY',
        severity: 'error',
        line: line.number,
        message: `Line ${line.number}: "${clip(trimmed)}" isn't a valid assignment — keys can't contain spaces or quotes.`,
      });
      return;
    }

    diagnostics.push({
      code: 'PARSE_NO_VALUE',
      severity: 'info',
      line: line.number,
      message: `Line ${line.number}: no "=" found, so this line was ignored.`,
    });
  });

  diagnostics.sort((a, b) => a.line - b.line);

  const keyCount = effective.size;
  if (keyCount > MANY_KEYS) {
    diagnostics.push({
      code: 'MANY_KEYS',
      severity: 'info',
      line: 1,
      message: `${keyCount} keys — the table will virtualise rows to stay fast.`,
    });
  }

  return {
    fileId,
    occurrences,
    effective,
    commentedKeys,
    order,
    diagnostics,
    stats: {
      lines: countLines(text),
      bytes,
      keyCount,
      duplicateCount,
    },
  };
}

/** Resolve `${REF}` references against the file's own keys. */
export function findUnresolvedRefs(parsed: ParsedFile): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const occ of parsed.occurrences) {
    for (const ref of occ.refs) {
      if (parsed.effective.has(ref)) continue;
      out.push({
        code: 'REF_UNRESOLVED',
        severity: 'info',
        line: occ.line,
        key: occ.key,
        message: `${occ.key} references \${${ref}}, which isn't defined in this file.`,
      });
    }
  }
  return out;
}

function findUncoveredLines(
  lines: SourceLine[],
  covered: Array<[number, number]>,
  visit: (line: SourceLine) => void,
): void {
  const skip = new Set<number>();
  for (const [start, end] of covered) {
    const from = lineNumberAt(lines, start);
    const to = lineNumberAt(lines, Math.max(start, end - 1));
    for (let n = from; n <= to; n += 1) skip.add(n);
  }
  for (const line of lines) {
    if (!skip.has(line.number)) visit(line);
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function extendOverNewline(text: string, end: number): number {
  if (text[end] === '\r' && text[end + 1] === '\n') return end + 2;
  if (text[end] === '\n' || text[end] === '\r') return end + 1;
  return end;
}

function byteLength(text: string): number {
  if (text.length === 0) return 0;
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function clip(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
