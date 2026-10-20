import { describe, expect, it } from 'vitest';
import { parseEnvFile } from '../../src/core/parse';
import { applyPatch, applyPatches, detectEol, renderValue } from '../../src/core/patch';
import type { TextPatch } from '../../src/core/patch';

const valueOf = (text: string, key: string) => parseEnvFile('f', text).effective.get(key)?.value;

function replace(text: string, key: string, nextValue: string): string {
  const occ = parseEnvFile('f', text).effective.get(key)!;
  const result = applyPatch(text, {
    kind: 'replaceValue',
    span: occ.valueSpan,
    nextValue,
    quote: occ.quote,
  });
  return result.text;
}

describe('replaceValue', () => {
  it('keeps the rest of the file untouched', () => {
    const before = '# header\nA=1\n# note\nB=two  # trailing\n';
    const after = replace(before, 'A', '2');
    expect(after).toBe('# header\nA=2\n# note\nB=two  # trailing\n');
  });

  it('preserves the original quote style', () => {
    expect(replace(`A="old"`, 'A', 'new')).toBe('A="new"');
    expect(replace(`A='old'`, 'A', 'new')).toBe("A='new'");
    expect(replace('A=old', 'A', 'new')).toBe('A=new');
  });

  it('keeps a trailing comment in place', () => {
    expect(replace('A=old # keep me', 'A', 'new')).toBe('A=new # keep me');
    expect(replace('A="" # keep me', 'A', 'new')).toBe('A="new" # keep me');
  });

  it('fills an empty value', () => {
    expect(replace('A=', 'A', 'filled')).toBe('A=filled');
    expect(valueOf(replace('A=', 'A', 'filled'), 'A')).toBe('filled');
  });

  it.each([
    ['plain', 'value'],
    ['with # hash', 'abc#123'],
    ['with spaces at the edges', '  padded  '],
    ['with double quotes', 'say "hi"'],
    ['with single quotes', "it's fine"],
    ['with both quote types', `it's "quoted"`],
    ['with a newline', 'line1\nline2'],
    ['windows path', 'C:\\Users\\me\\app'],
    ['unicode', 'héllo 👋'],
    ['url with credentials', 'postgres://user:pass@host:5432/db'],
    ['equals signs', 'a=b=c'],
    ['leading hash', '#notacomment'],
  ])('round-trips a value %s', (_label, value) => {
    const after = replace('A=old\nB=keep\n', 'A', value as string);
    expect(valueOf(after, 'A')).toBe(value);
    expect(valueOf(after, 'B')).toBe('keep');
  });

  it('quotes when the value would otherwise be truncated by #', () => {
    const after = replace('PASSWORD=short', 'PASSWORD', 'abc#123');
    expect(after).toMatch(/^PASSWORD=(?:"abc#123"|'abc#123')$/);
    expect(valueOf(after, 'PASSWORD')).toBe('abc#123');
  });

  it('explains when it had to quote', () => {
    const occ = parseEnvFile('f', 'A=old').effective.get('A')!;
    const result = applyPatch('A=old', {
      kind: 'replaceValue',
      span: occ.valueSpan,
      nextValue: 'a#b',
      quote: 'none',
    });
    expect(result.notes).toHaveLength(1);
  });

  it('replaces an empty span when the key had no value yet', () => {
    const occ = parseEnvFile('f', 'A=').effective.get('A')!;
    const result = applyPatch('A=', {
      kind: 'replaceValue',
      span: occ.valueSpan,
      nextValue: 'x',
      quote: 'none',
    });
    expect(result.text).toBe('A=x');
  });
});

describe('insertKey', () => {
  it('appends a block with a comment and a blank line', () => {
    const after = applyPatch('A=1\n', { kind: 'insertKey', key: 'NEW_KEY' }).text;
    expect(after).toBe('A=1\n\n# Added by EnvCompare\nNEW_KEY=\n');
    expect(parseEnvFile('f', after).effective.get('NEW_KEY')?.value).toBe('');
  });

  it('works on an empty file', () => {
    const after = applyPatch('', { kind: 'insertKey', key: 'A', value: '1' }).text;
    expect(after).toBe('# Added by EnvCompare\nA=1\n');
  });

  it('respects CRLF files', () => {
    const after = applyPatch('A=1\r\n', { kind: 'insertKey', key: 'B' }).text;
    expect(after).toBe('A=1\r\n\r\n# Added by EnvCompare\r\nB=\r\n');
    expect(detectEol(after)).toBe('\r\n');
  });

  it('accepts a custom comment', () => {
    const after = applyPatch('A=1\n', {
      kind: 'insertKey',
      key: 'B',
      comment: '# from .env.example',
    }).text;
    expect(after).toContain('# from .env.example\nB=\n');
  });

  it('does not add two blank lines when the file already ends with one', () => {
    const after = applyPatch('A=1\n\n', { kind: 'insertKey', key: 'B' }).text;
    expect(after).toBe('A=1\n\n# Added by EnvCompare\nB=\n');
  });
});

describe('removeKey', () => {
  it('removes the line and its newline', () => {
    const parsed = parseEnvFile('f', 'A=1\nB=2\nC=3\n');
    const after = applyPatch('A=1\nB=2\nC=3\n', {
      kind: 'removeKey',
      span: parsed.effective.get('B')!.span,
    }).text;
    expect(after).toBe('A=1\nC=3\n');
  });

  it('does not leave a trailing blank line when removing the last line', () => {
    const text = 'A=1\nB=2';
    const parsed = parseEnvFile('f', text);
    const after = applyPatch(text, {
      kind: 'removeKey',
      span: parsed.effective.get('B')!.span,
    }).text;
    expect(after).toBe('A=1');
  });
});

describe('uncomment', () => {
  it('removes only the leading comment markers on the given line', () => {
    const text = '# SENTRY_DSN=\n# keep this\nA=1\n';
    const after = applyPatch(text, { kind: 'uncomment', line: 1 }).text;
    expect(after).toBe('SENTRY_DSN=\n# keep this\nA=1\n');
  });

  it('handles indented and multi-hash comments', () => {
    const after = applyPatch('   ## FOO=1\n', { kind: 'uncomment', line: 1 }).text;
    expect(after).toBe('   FOO=1\n');
  });

  it('is a no-op on a line that is not a comment', () => {
    const text = 'A=1\n';
    expect(applyPatch(text, { kind: 'uncomment', line: 1 }).text).toBe(text);
  });
});

describe('renderValue', () => {
  it('leaves clean values unquoted', () => {
    expect(renderValue('abc123').text).toBe('abc123');
  });

  it('quotes defensively', () => {
    expect(renderValue('a b').text).toBe('a b');
    expect(renderValue(' padded ').text).toBe("' padded '");
    expect(renderValue('a#b').text).toBe("'a#b'");
  });
});

describe('applyPatches', () => {
  it('applies several edits in sequence', () => {
    const patches: TextPatch[] = [
      { kind: 'insertKey', key: 'C', value: '3' },
      { kind: 'uncomment', line: 1 },
    ];
    const result = applyPatches('# A=\nB=2\n', patches);
    expect(result.text).toBe('A=\nB=2\n\n# Added by EnvCompare\nC=3\n');
    expect(result.notes).toEqual([]);
  });
});
