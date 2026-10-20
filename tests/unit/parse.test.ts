import { describe, expect, it } from 'vitest';
import { parseEnvFile, findUnresolvedRefs } from '../../src/core/parse';

const parse = (text: string) => parseEnvFile('f', text);
const valueOf = (text: string, key: string) => parse(text).effective.get(key)?.value;

describe('parse — assignments', () => {
  it('reads basic key=value pairs', () => {
    const parsed = parse('A=1\nB=two\n');
    expect([...parsed.effective.keys()]).toEqual(['A', 'B']);
    expect(parsed.order).toEqual(['A', 'B']);
    expect(valueOf('A=1', 'A')).toBe('1');
    expect(parsed.stats.keyCount).toBe(2);
  });

  it('strips one pair of matching quotes', () => {
    expect(valueOf(`A="quoted"`, 'A')).toBe('quoted');
    expect(valueOf(`A='single'`, 'A')).toBe('single');
    expect(valueOf('A=`back`', 'A')).toBe('back');
  });

  it('expands \\n and \\r only inside double quotes', () => {
    expect(valueOf('A="line1\\nline2"', 'A')).toBe('line1\nline2');
    expect(valueOf("A='line1\\nline2'", 'A')).toBe('line1\\nline2');
  });

  it('supports export prefixes', () => {
    const parsed = parse('export A=1\nexport B="2"\n');
    expect([...parsed.effective.keys()]).toEqual(['A', 'B']);
    expect(parsed.occurrences[0]?.isExport).toBe(true);
  });

  it('supports KEY: value with a space but not without', () => {
    expect(valueOf('A: hello', 'A')).toBe('hello');
    expect(parse('A:hello').effective.size).toBe(0);
  });

  it('keeps dots and dashes in keys and is case sensitive', () => {
    const parsed = parse('sentry.trace-sample-rate=1\nAPI_KEY=a\napi_key=b\n');
    expect([...parsed.effective.keys()]).toEqual(['sentry.trace-sample-rate', 'API_KEY', 'api_key']);
  });

  it('treats empty values as empty strings', () => {
    expect(valueOf('A=', 'A')).toBe('');
    expect(valueOf('A=""', 'A')).toBe('');
    expect(valueOf('A=   ', 'A')).toBe('');
  });

  it('does not coerce values', () => {
    expect(valueOf('A=false', 'A')).toBe('false');
    expect(valueOf('A=0', 'A')).toBe('0');
  });
});

describe('parse — comments', () => {
  it('strips inline comments from unquoted values', () => {
    expect(valueOf('A=value # comment', 'A')).toBe('value');
    expect(parse('A=value # comment').occurrences[0]?.trailingComment).toBe('# comment');
  });

  it('keeps # inside quoted values', () => {
    expect(valueOf('A="abc#123"', 'A')).toBe('abc#123');
  });

  it('warns when an unquoted value is cut off at #', () => {
    const parsed = parse('PASSWORD=abc#123');
    expect(parsed.effective.get('PASSWORD')?.value).toBe('abc');
    expect(parsed.diagnostics.map((d) => d.code)).toContain('SUSPECT_HASH_TRUNCATION');
  });

  it('detects commented-out assignments without treating them as variables', () => {
    const parsed = parse('# SENTRY_DSN=\n#GOOGLE_ID=123\n# just a note\n');
    expect(parsed.effective.size).toBe(0);
    expect([...parsed.commentedKeys]).toEqual(['SENTRY_DSN', 'GOOGLE_ID']);
  });
});

describe('parse — structure', () => {
  it('handles multiline quoted values as one occurrence', () => {
    const text = 'PRIVATE_KEY="-----BEGIN-----\nabc\n-----END-----"\nAFTER=1\n';
    const parsed = parse(text);
    expect(parsed.effective.get('PRIVATE_KEY')?.value).toBe('-----BEGIN-----\nabc\n-----END-----');
    expect(parsed.effective.get('PRIVATE_KEY')?.line).toBe(1);
    expect(parsed.effective.get('PRIVATE_KEY')?.endLine).toBe(3);
    expect(parsed.effective.get('AFTER')?.line).toBe(4);
    expect(parsed.diagnostics.some((d) => d.code === 'MULTILINE')).toBe(true);
  });

  it('last duplicate wins and both lines are reported', () => {
    const parsed = parse('A=1\nB=2\nA=3\n');
    expect(parsed.effective.get('A')?.value).toBe('3');
    expect(parsed.order).toEqual(['A', 'B']);
    expect(parsed.occurrences).toHaveLength(3);
    expect(parsed.stats.duplicateCount).toBe(1);
    const dup = parsed.diagnostics.find((d) => d.code === 'DUP_KEY');
    expect(dup?.message).toContain('lines 1, 3');
  });

  it('normalises CRLF and strips a BOM for key detection', () => {
    const parsed = parse('\uFEFFA=1\r\nB=2\r\n');
    expect([...parsed.effective.keys()]).toEqual(['A', 'B']);
  });

  it('is empty for empty input', () => {
    const parsed = parse('');
    expect(parsed.effective.size).toBe(0);
    expect(parsed.diagnostics).toHaveLength(0);
    expect(parsed.stats.lines).toBe(0);
  });

  it('rejects binary-ish input', () => {
    const parsed = parse('A=1\u0000B=2');
    expect(parsed.diagnostics[0]?.code).toBe('NOT_TEXT');
  });
});

describe('parse — diagnostics for unparseable lines', () => {
  it('reports a key containing a space', () => {
    const parsed = parse('A=1\nMY KEY=value\n');
    const diag = parsed.diagnostics.find((d) => d.code === 'PARSE_BAD_KEY');
    expect(diag?.line).toBe(2);
    expect(parsed.effective.has('MY KEY')).toBe(false);
  });

  it('reports a line with no separator', () => {
    const parsed = parse('JUST_A_WORD\n');
    expect(parsed.diagnostics.map((d) => d.code)).toContain('PARSE_NO_VALUE');
  });

  it('hints about a colon without a space', () => {
    const parsed = parse('A:hello\n');
    expect(parsed.diagnostics.map((d) => d.code)).toContain('COLON_NO_SPACE');
  });
});

describe('parse — spans', () => {
  it('points value spans at the raw value including quotes', () => {
    const text = 'A="hi"\n';
    const occ = parse(text).occurrences[0]!;
    expect(text.slice(occ.valueSpan.start, occ.valueSpan.end)).toBe('"hi"');
    expect(text.slice(occ.keySpan.start, occ.keySpan.end)).toBe('A');
  });

  it('covers the whole logical line for edits', () => {
    const text = 'X=1\nA="hi" # note\nY=2\n';
    const occ = parse(text).occurrences[1]!;
    expect(text.slice(occ.span.start, occ.span.end)).toBe('A="hi" # note\n');
  });
});

describe('references', () => {
  it('records ${VAR} and $VAR references', () => {
    const occ = parse('A=1\nURL="postgres://${HOST}:${PORT}"\nB=$A\n').occurrences;
    expect(occ[1]?.refs).toEqual(['HOST', 'PORT']);
    expect(occ[2]?.refs).toEqual(['A']);
  });

  it('reports references that are not defined in the file', () => {
    const parsed = parse('HOST=x\nURL=${HOST}:${MISSING}\n');
    const unresolved = findUnresolvedRefs(parsed);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]?.message).toContain('MISSING');
  });
});
