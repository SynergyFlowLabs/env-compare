import { useMemo, useRef, useState } from 'react';
import { CircleMinus, Link2, Unlink2 } from 'lucide-react';
import type { Comparison, Presence } from '../../core/compare';
import type { ParsedFile, SourceLine } from '../../core/types';
import { splitLines } from '../../core/parse';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface RawViewProps {
  comparison: Comparison;
  texts: Map<string, string>;
  parsed: Map<string, ParsedFile>;
  maskValues: boolean;
}

type Rendered =
  | { kind: 'line'; number: number; text: string; presence?: Presence }
  | { kind: 'marker'; key: string };

const LINE_TONE: Record<Presence, string> = {
  present: 'text-foreground',
  empty: 'bg-empty-tint/60 text-empty',
  placeholder: 'bg-placeholder-tint/60 text-placeholder',
  commented: 'bg-commented-tint/60 text-commented',
  absent: 'text-missing',
};

/**
 * The raw view is the trust anchor: it shows the file exactly as pasted, with
 * annotations layered on top and never rewriting the text (PRD US-14).
 *
 * The panes scroll together (#9). Comparing two files side by side is only
 * useful if a glance across the gutter lands on the same region, and with
 * independent scrollers the reader has to steer both to do it. Sync is
 * proportional — `scrollTop / (scrollHeight - clientHeight)` — because the
 * files rarely have the same number of lines: equal fractions keep the eye at
 * the same *relative* place, which is what a side-by-side read compares.
 *
 * A missing key gets a marker line placed after the nearest preceding key that
 * the file *does* have — where a reader would look for it. The marker is
 * synthetic UI, never content: it cannot be copied into the file.
 */
export function RawView({ comparison, texts, parsed, maskValues }: RawViewProps) {
  const [synced, setSynced] = useState(true);
  const panes = useRef(new Map<string, HTMLElement>());
  /** Where this component last put each pane, so our own writes are not mistaken for the reader. */
  const applied = useRef(new Map<string, number>());

  const registerPane = (fileId: string) => (node: HTMLElement | null) => {
    if (node) panes.current.set(fileId, node);
    else panes.current.delete(fileId);
    applied.current.delete(fileId);
  };

  const mirror = (sourceId: string) => {
    if (!synced) return;
    const source = panes.current.get(sourceId);
    if (!source) return;

    // A scroll event that matches what we just wrote is the echo of our own
    // sync, not the reader scrolling. Dropping it is what stops the panes from
    // chasing each other frame after frame.
    const echo = applied.current.get(sourceId);
    if (echo !== undefined && Math.abs(source.scrollTop - echo) <= 1) return;

    const span = source.scrollHeight - source.clientHeight;
    const ratio = span > 0 ? source.scrollTop / span : 0;

    for (const [id, pane] of panes.current) {
      if (id === sourceId) continue;
      const ownSpan = pane.scrollHeight - pane.clientHeight;
      if (ownSpan <= 0) continue;
      const next = Math.round(ratio * ownSpan);
      applied.current.set(id, next);
      if (Math.abs(pane.scrollTop - next) > 0) pane.scrollTop = next;
    }
  };

  const multiple = comparison.perFile.length > 1;

  return (
    <div className="grid gap-2">
      {multiple ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-faint">Raw text as pasted — annotations only.</span>
          <span className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={synced}
            onClick={() => setSynced((value) => !value)}
            title={
              synced
                ? 'Scroll the files independently'
                : 'Scroll all files together again'
            }
          >
            {synced ? <Link2 aria-hidden="true" /> : <Unlink2 aria-hidden="true" />}
            Scroll together
          </Button>
        </div>
      ) : null}
      <div
        className={cn(
          'grid gap-4',
          comparison.perFile.length > 2 ? 'lg:grid-cols-2 2xl:grid-cols-3' : 'lg:grid-cols-2',
        )}
      >
        {comparison.perFile.map((file) => (
          <RawPane
            key={file.fileId}
            comparison={comparison}
            fileId={file.fileId}
            name={file.name}
            text={texts.get(file.fileId) ?? ''}
            parsed={parsed.get(file.fileId)}
            maskValues={maskValues}
            registerPane={registerPane(file.fileId)}
            onScroll={() => mirror(file.fileId)}
          />
        ))}
      </div>
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
  registerPane,
  onScroll,
}: {
  comparison: Comparison;
  fileId: string;
  name: string;
  text: string;
  parsed?: ParsedFile;
  maskValues: boolean;
  registerPane: (node: HTMLElement | null) => void;
  onScroll: () => void;
}) {
  const rendered = useMemo(
    () => buildRendered(splitLines(text), comparison, fileId, parsed),
    [text, comparison, fileId, parsed],
  );

  return (
    <section aria-label={name} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="mono truncate text-[13px] font-medium">{name}</span>
        <span className="ml-auto text-[11px] text-faint">read-only</span>
      </div>
      {/* Focusable so the region can be scrolled from the keyboard, not only the wheel. */}
      <div
        ref={registerPane}
        onScroll={onScroll}
        tabIndex={0}
        data-file-id={fileId}
        className="max-h-[560px] overflow-auto py-1.5 scroll-quiet focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:outline-none"
      >
        {rendered.map((item, index) =>
          item.kind === 'marker' ? (
            <div
              key={`m-${item.key}-${index}`}
              className="flex items-center gap-2 border-y border-dashed border-missing/35 bg-missing-tint/50 px-3 py-0.5"
            >
              <span className="flex w-7 shrink-0 justify-end text-missing" aria-hidden="true">
                <CircleMinus className="size-3" />
              </span>
              <span className="mono text-[12.5px] text-missing">{item.key}</span>
              <span className="ml-auto rounded-sm bg-missing/10 px-1.5 text-[10.5px] font-medium tracking-wide text-missing uppercase">
                missing here
              </span>
            </div>
          ) : (
            <div
              key={`l-${item.number}`}
              className={cn(
                'flex items-baseline gap-2 px-3 py-px',
                item.presence ? LINE_TONE[item.presence] : 'text-foreground',
              )}
            >
              <span className="w-7 shrink-0 text-right font-mono text-[11px] text-faint select-none" aria-hidden="true">
                {item.number}
              </span>
              <span className="mono min-w-0 flex-1 whitespace-pre text-[12.5px]">
                {maskValues && item.presence && item.presence !== 'commented'
                  ? maskLine(item.text)
                  : item.text || ' '}
              </span>
              {item.presence && item.presence !== 'present' ? (
                <span className="shrink-0 text-[10.5px] font-medium tracking-wide uppercase opacity-80">
                  {tagFor(item.presence)}
                </span>
              ) : null}
            </div>
          ),
        )}
      </div>
    </section>
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
