import { useMemo } from 'react';
import type { Comparison, Presence } from '../../core/compare';
import type { ParsedFile, SourceLine } from '../../core/types';
import { splitLines } from '../../core/parse';

interface RawViewProps {
  comparison: Comparison;
  texts: Map<string, string>;
  parsed: Map<string, ParsedFile>;
  maskValues: boolean;
}

type Rendered =
  | { kind: 'line'; number: number; text: string; presence?: Presence }
  | { kind: 'marker'; key: string };

/**
 * The raw view is the trust anchor: it shows the file exactly as pasted, with
 * annotations layered on top and never rewriting the text (PRD US-14).
 *
 * A missing key gets a marker line placed after the nearest preceding key that
 * the file *does* have — where a reader would look for it. The marker is
 * synthetic UI, never content: it cannot be copied into the file.
 */
export function RawView({ comparison, texts, parsed, maskValues }: RawViewProps) {
  return (
    <div className="raw-grid">
      {comparison.perFile.map((file) => (
        <RawPane
          key={file.fileId}
          comparison={comparison}
          fileId={file.fileId}
          name={file.name}
          text={texts.get(file.fileId) ?? ''}
          parsed={parsed.get(file.fileId)}
          maskValues={maskValues}
        />
      ))}
    </div>
  );
}

function RawPane({
  comparison,
  fileId,
  name,
  text,
  parsed,
  maskValues,
}: {
  comparison: Comparison;
  fileId: string;
  name: string;
  text: string;
  parsed?: ParsedFile;
  maskValues: boolean;
}) {
  const rendered = useMemo(
    () => buildRendered(splitLines(text), comparison, fileId, parsed),
    [text, comparison, fileId, parsed],
  );

  return (
    <div className="raw-pane">
      <div className="raw-pane__head">
        <span>{name}</span>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 11.5 }}>
          read-only
        </span>
      </div>
      <div className="raw-pane__body">
        {rendered.map((item, index) =>
          item.kind === 'marker' ? (
            <div key={`m-${item.key}-${index}`} className="raw-line raw-line--missing">
              <span className="raw-line__no" aria-hidden="true">
                +
              </span>
              <span className="raw-line__body mono" style={{ color: 'var(--st-missing)' }}>
                {item.key}
              </span>
              <span className="raw-line__tag">missing here</span>
            </div>
          ) : (
            <div
              key={`l-${item.number}`}
              className={`raw-line${item.presence ? ` raw-line--${item.presence}` : ''}`}
            >
              <span className="raw-line__no" aria-hidden="true">
                {item.number}
              </span>
              <span className="raw-line__body">
                {maskValues && item.presence && item.presence !== 'commented'
                  ? maskLine(item.text)
                  : item.text || ' '}
              </span>
              {item.presence && item.presence !== 'present' ? (
                <span className="raw-line__tag">{tagFor(item.presence)}</span>
              ) : null}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function buildRendered(
  lines: SourceLine[],
  comparison: Comparison,
  fileId: string,
  parsed: ParsedFile | undefined,
): Rendered[] {
  const presenceByLine = new Map<number, Presence>();
  const present: Array<{ line: number; refIndex: number }> = [];
  const refOrder = new Map(comparison.rows.map((row, index) => [row.key, index]));

  for (const row of comparison.rows) {
    const cell = row.cells.find((c) => c.fileId === fileId);
    if (!cell) continue;
    if (cell.presence === 'commented') {
      const line = parsed?.commentedKeys.get(row.key);
      if (line) presenceByLine.set(line, 'commented');
      continue;
    }
    if (cell.presence !== 'absent' && cell.occurrence) {
      presenceByLine.set(cell.occurrence.line, cell.presence);
      present.push({ line: cell.occurrence.endLine, refIndex: refOrder.get(row.key) ?? 0 });
    }
  }

  const markers = new Map<number, string[]>();
  for (const row of comparison.rows) {
    const cell = row.cells.find((c) => c.fileId === fileId);
    if (cell?.action !== 'add') continue;
    const index = refOrder.get(row.key) ?? 0;
    const previous = present
      .filter((item) => item.refIndex < index)
      .sort((a, b) => b.refIndex - a.refIndex)[0];
    const after = previous?.line ?? 0;
    markers.set(after, [...(markers.get(after) ?? []), row.key]);
  }

  const rendered: Rendered[] = [];
  const pushMarkers = (after: number) => {
    for (const key of markers.get(after) ?? []) rendered.push({ kind: 'marker', key });
  };

  pushMarkers(0);
  const last = lines.length > 1 && lines[lines.length - 1]?.text === '' ? lines.length - 1 : lines.length;
  for (const line of lines.slice(0, last)) {
    const presence = presenceByLine.get(line.number);
    rendered.push({
      kind: 'line',
      number: line.number,
      text: line.text,
      ...(presence ? { presence } : {}),
    });
    pushMarkers(line.number);
  }
  return rendered;
}

function tagFor(presence: Presence): string {
  switch (presence) {
    case 'empty':
      return 'empty';
    case 'placeholder':
      return 'example value';
    case 'commented':
      return 'commented';
    case 'absent':
      return 'missing';
    case 'present':
      return '';
  }
}

/** Mask the value part of a line while keeping the key readable. */
function maskLine(text: string): string {
  const match = /^(\s*(?:export\s+)?[\w.-]+\s*[=:]\s*)(.+)$/.exec(text);
  if (!match) return text;
  const [, prefix, rest] = match;
  return rest === undefined ? text : `${prefix}••••••••`;
}
