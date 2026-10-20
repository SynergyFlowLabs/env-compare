import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import {
  ArrowDownAZ,
  ArrowLeftRight,
  Code2,
  Copy,
  Eye,
  EyeOff,
  GitCompare,
  ListFilter,
  Pencil,
  Table2,
  Trash2,
  Wrench,
  FileCode2,
  LayoutList,
} from 'lucide-react';
import { compare, type Bucket, type Comparison, type FileInput } from '../../core/compare';
import { parseEnvFile } from '../../core/parse';
import { buildFixBlock } from '../../core/export';
import { countLines } from '../../core/parse';
import { reducer, initialState, type Tab } from '../../state/reducer';
import { copyText, downloadText, safeFileName } from '../lib/clipboard';
import { cn } from '../lib/utils';
import { FilePane } from '../components/FilePane';
import { SiteHeader } from '../components/SiteHeader';
import { SkipLink } from '../components/SkipLink';
import { SummaryLine } from '../components/SummaryLine';
import { CompareTable, type Filter } from '../components/CompareTable';
import { RawView } from '../components/RawView';
import { FixPanel } from '../components/FixPanel';
import { Diagnostics } from '../components/Diagnostics';
import { Toast } from '../components/Toast';
import { Dialog } from '../components/Dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: typeof Table2 }> = [
  { id: 'summary', label: 'Summary', icon: LayoutList },
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'raw', label: 'Raw', icon: FileCode2 },
  { id: 'fix', label: 'Fix', icon: Wrench },
];

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'missing', label: 'Missing' },
  { id: 'needsValue', label: 'Need a value' },
  { id: 'extra', label: 'Only in one file' },
  { id: 'commented', label: 'Commented out' },
  { id: 'different', label: 'Different values' },
];

export function Tool() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const parsed = useMemo(
    () => new Map(state.files.map((file) => [file.id, parseEnvFile(file.id, file.text)])),
    [state.files],
  );

  const comparison: Comparison = useMemo(() => {
    const inputs: FileInput[] = state.files.map((file) => ({
      id: file.id,
      name: file.name.trim() === '' ? 'untitled' : file.name,
      role: file.id === state.referenceId ? 'reference' : 'target',
      parsed: parsed.get(file.id) ?? parseEnvFile(file.id, ''),
    }));
    return compare(inputs);
  }, [state.files, state.referenceId, parsed]);

  const referenceFile = state.files.find((f) => f.id === state.referenceId) ?? state.files[0]!;
  const targetFile = state.files.find((f) => f.id !== state.referenceId) ?? state.files[1]!;
  const targetSummary = comparison.perFile.find((f) => f.fileId === targetFile.id);
  const referenceSummary = comparison.perFile.find((f) => f.fileId === referenceFile.id);

  const bothHaveKeys =
    (referenceSummary?.counts.present ?? 0) +
      (referenceSummary?.counts.empty ?? 0) +
      (referenceSummary?.counts.placeholder ?? 0) +
      (referenceSummary?.counts.commented ?? 0) >
      0 &&
    (targetSummary?.counts.present ?? 0) +
      (targetSummary?.counts.empty ?? 0) +
      (targetSummary?.counts.placeholder ?? 0) +
      (targetSummary?.counts.commented ?? 0) >
      0;

  /**
   * Paste is a deliberate act: once both sides have variables, show the result.
   *
   * This used to run on every render where both sides had keys, which meant
   * "Edit files" was undone a tick later — the editor appeared and vanished
   * before anyone could type in it. `autoAdvance` is now the gate: a paste or
   * the example sets it, choosing "Edit files" clears it, and only then does
   * this effect fire.
   */
  useEffect(() => {
    if (state.autoAdvance && bothHaveKeys && state.view === 'input') {
      dispatch({ type: 'advance' });
    }
  }, [state.autoAdvance, bothHaveKeys, state.view]);

  // Returning to the editor should put the cursor where the work is, without
  // stealing focus on first load.
  const previousView = useRef(state.view);
  useEffect(() => {
    const returning = previousView.current === 'results' && state.view === 'input';
    previousView.current = state.view;
    if (!returning) return;
    const field = document.getElementById(`text-${referenceFile.id}`);
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  }, [state.view, referenceFile.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const tab = TABS[Number(event.key) - 1];
      if (tab && state.view === 'results') {
        event.preventDefault();
        dispatch({ type: 'tab', tab: tab.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.view]);

  const copy = useCallback(
    async (text: string, label: string) => {
      const ok = await copyText(text);
      if (ok) dispatch({ type: 'toast', message: label });
      else dispatch({ type: 'copyFallback', value: { text, label } });
    },
    [dispatch],
  );

  const texts = useMemo(() => new Map(state.files.map((f) => [f.id, f.text])), [state.files]);

  const fixBlock = useMemo(
    () => buildFixBlock(comparison, targetFile.id),
    [comparison, targetFile.id],
  );

  const problems = comparison.summary.missing + comparison.summary.needsValue;

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <SiteHeader current="tool" />

      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-16 sm:px-6" id="main" tabIndex={-1}>
        {state.view === 'input' || !bothHaveKeys ? (
          <section className="pt-12 sm:pt-16" aria-labelledby="landing-title">
            <h1
              className="max-w-[24ch] text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[40px]"
              id="landing-title"
            >
              See what your <code className="mono">.env</code> is missing.
            </h1>
            <p className="mt-3 max-w-[64ch] text-[16px] text-muted-foreground">
              Paste your <code className="mono">.env.example</code> and your{' '}
              <code className="mono">.env</code>. This shows every variable that is missing, empty,
              or leftover — and gives you the block to paste back.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {state.files.map((file) => (
                <FilePane
                  key={file.id}
                  id={file.id}
                  name={file.name}
                  text={file.text}
                  isReference={file.id === state.referenceId}
                  keyCount={parsed.get(file.id)?.effective.size ?? 0}
                  lineCount={countLines(file.text)}
                  onText={(text) => dispatch({ type: 'text', id: file.id, text })}
                  onPaste={(text) => dispatch({ type: 'paste', id: file.id, text })}
                  onName={(name) => dispatch({ type: 'name', id: file.id, name })}
                  onProblem={(message) => dispatch({ type: 'toast', message })}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
              {bothHaveKeys ? (
                <Button type="button" size="sm" onClick={() => dispatch({ type: 'advance' })}>
                  <GitCompare aria-hidden="true" />
                  Compare files
                </Button>
              ) : null}
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-[13px]"
                onClick={() => dispatch({ type: 'loadSample' })}
              >
                See an example
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-[13px]"
                onClick={() => dispatch({ type: 'swapRoles' })}
                disabled={!referenceFile.text && !targetFile.text}
              >
                <ArrowLeftRight aria-hidden="true" />
                Swap which file is the reference
              </Button>
              <span className="text-muted-foreground">
                Nothing is sent anywhere. Close the tab and it&apos;s gone.
              </span>
            </div>
          </section>
        ) : null}

        {state.view === 'results' && bothHaveKeys ? (
          <section className="pt-5" aria-label="Comparison results">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: 'view', view: 'input' })}
              >
                <Pencil aria-hidden="true" />
                Edit files
              </Button>
              <span className="mono text-[12.5px] text-muted-foreground">
                {referenceFile.name} → {targetFile.name}
              </span>
              <span className="flex-1" />
              {fixBlock.keys.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() =>
                    void copy(fixBlock.text, `Copied ${fixBlock.keys.length} variables`)
                  }
                >
                  <Copy aria-hidden="true" />
                  Copy {fixBlock.keys.length} for {targetFile.name}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => dispatch({ type: 'toggleMask' })}
                aria-pressed={state.maskValues}
              >
                {state.maskValues ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                {state.maskValues ? 'Show values' : 'Hide values'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'swapRoles' })}>
                <ArrowLeftRight aria-hidden="true" />
                Swap
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: 'confirmClear', open: true })}
              >
                <Trash2 aria-hidden="true" />
                Clear all
              </Button>
            </div>

            <div className="mt-4">
              <SummaryLine comparison={comparison} />
            </div>

            <Tabs
              className="mt-4"
              value={state.tab}
              onValueChange={(value) => dispatch({ type: 'tab', tab: value as Tab })}
            >
              <TabsList aria-label="Views">
                {TABS.map((tab, index) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    <tab.icon aria-hidden="true" />
                    {tab.label}
                    {tab.id === 'table' && problems > 0 ? (
                      <span className="rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-muted-foreground group-data-[state=active]:bg-brand-soft group-data-[state=active]:text-primary">
                        {problems}
                      </span>
                    ) : null}
                    <span className="sr-only"> (Alt+{index + 1})</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="summary" className="mt-1">
                <SummaryPanel
                  comparison={comparison}
                  problems={problems}
                  onShowTable={() => dispatch({ type: 'tab', tab: 'table' })}
                />
              </TabsContent>

              <TabsContent value="table" className="mt-1">
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {FILTERS.map((filter) => {
                    const count = countFor(comparison, filter.id);
                    if (filter.id !== 'all' && count === 0) return null;
                    return (
                      <FilterChip
                        key={filter.id}
                        pressed={state.filter === filter.id}
                        onClick={() => dispatch({ type: 'filter', filter: filter.id })}
                      >
                        {filter.label}
                        {filter.id === 'all' ? '' : ` ${count}`}
                      </FilterChip>
                    );
                  })}
                  <span className="flex-1" />
                  <FilterChip
                    pressed={state.sort === 'alpha'}
                    onClick={() =>
                      dispatch({ type: 'sort', sort: state.sort === 'file' ? 'alpha' : 'file' })
                    }
                  >
                    {state.sort === 'file' ? (
                      <>
                        <ArrowDownAZ aria-hidden="true" />
                        Sort A–Z
                      </>
                    ) : (
                      <>
                        <ListFilter aria-hidden="true" />
                        Sort by file order
                      </>
                    )}
                  </FilterChip>
                </div>
                <CompareTable
                  comparison={comparison}
                  maskValues={state.maskValues}
                  revealed={new Set(state.revealed)}
                  filter={state.filter}
                  sort={state.sort}
                  actions={{
                    onReveal: (fileId, key) => dispatch({ type: 'reveal', fileId, key }),
                    onEdit: (fileId, key, value) => {
                      const cell = comparison.rows
                        .find((row) => row.key === key)
                        ?.cells.find((c) => c.fileId === fileId);
                      const occurrence = cell?.occurrence;
                      if (!occurrence) return;
                      dispatch({
                        type: 'patch',
                        fileId,
                        label: `Edit ${key}`,
                        toast: `Updated ${key}`,
                        patch: {
                          kind: 'replaceValue',
                          span: occurrence.valueSpan,
                          nextValue: value,
                          quote: occurrence.quote,
                        },
                      });
                    },
                    onAdd: (fileId, key) => {
                      dispatch({
                        type: 'patch',
                        fileId,
                        label: `Add ${key}`,
                        toast: `Added ${key}`,
                        patch: { kind: 'insertKey', key },
                      });
                    },
                    onUncomment: (fileId, line) => {
                      dispatch({
                        type: 'patch',
                        fileId,
                        label: 'Uncomment',
                        toast: 'Uncommented',
                        patch: { kind: 'uncomment', line },
                      });
                    },
                    onRemove: (fileId, span) => {
                      dispatch({
                        type: 'patch',
                        fileId,
                        label: 'Remove line',
                        toast: 'Removed',
                        patch: { kind: 'removeKey', span },
                      });
                    },
                  }}
                />
              </TabsContent>

              <TabsContent value="raw" className="mt-1">
                <RawView
                  comparison={comparison}
                  texts={texts}
                  parsed={parsed}
                  maskValues={state.maskValues}
                />
              </TabsContent>

              <TabsContent value="fix" className="mt-1">
                <FixPanel
                  comparison={comparison}
                  targetId={targetFile.id}
                  targetName={targetFile.name}
                  targetText={targetFile.text}
                  onCopy={(text, label) => void copy(text, label)}
                  onDownload={(filename, text) => {
                    downloadText(safeFileName(filename), text);
                    dispatch({ type: 'toast', message: `Downloaded ${filename}` });
                  }}
                />
              </TabsContent>
            </Tabs>

            <Diagnostics files={comparison.perFile} />
          </section>
        ) : null}

        <Footer />
      </main>

      <Toast
        toast={state.toast}
        onDismiss={() => dispatch({ type: 'dismissToast' })}
        onUndo={() => dispatch({ type: 'undo' })}
      />

      {state.confirmClear ? (
        <Dialog
          title="Clear both files?"
          confirmLabel="Clear everything"
          destructive
          onCancel={() => dispatch({ type: 'confirmClear', open: false })}
          onConfirm={() => {
            dispatch({ type: 'clearAll' });
            dispatch({ type: 'confirmClear', open: false });
          }}
        >
          <p>
            This wipes both files from this tab. It can&apos;t be undone, and there is no copy
            anywhere else — that is the point.
          </p>
        </Dialog>
      ) : null}

      {state.copyFallback ? (
        <CopyFallback
          text={state.copyFallback.text}
          label={state.copyFallback.label}
          onClose={() => dispatch({ type: 'copyFallback', value: null })}
        />
      ) : null}
    </div>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] leading-none transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
        pressed
          ? 'border-foreground/20 bg-foreground text-background'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function SummaryPanel({
  comparison,
  problems,
  onShowTable,
}: {
  comparison: Comparison;
  problems: number;
  onShowTable: () => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {comparison.perFile.map((file) => (
          <Card key={file.fileId}>
            <CardHeader className="border-b border-border">
              <CardTitle className="mono flex-1 truncate">{file.name}</CardTitle>
              <span className="text-[11.5px] tracking-wide text-muted-foreground uppercase">
                {file.role === 'reference' ? 'reference' : 'target'}
              </span>
            </CardHeader>
            <CardContent className="pt-2.5">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
                <dt className="text-muted-foreground">Set</dt>
                <dd className="text-right tabular-nums">{file.counts.present}</dd>
                <dt className="text-muted-foreground">Set, but empty</dt>
                <dd className="text-right tabular-nums">{file.counts.empty}</dd>
                <dt className="text-muted-foreground">Still the example value</dt>
                <dd className="text-right tabular-nums">{file.counts.placeholder}</dd>
                <dt className="text-muted-foreground">Commented out</dt>
                <dd className="text-right tabular-nums">{file.counts.commented}</dd>
                <dt className="text-muted-foreground">Not in this file</dt>
                <dd className="text-right tabular-nums">{file.counts.absent}</dd>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-l-4 border-l-primary">
        <CardContent className="flex flex-wrap items-start gap-4 pt-3.5">
          <div className="min-w-[240px] flex-1">
            <p className="text-[13px] font-semibold">
              {problems > 0 ? 'What to do now' : 'Nothing to fix'}
            </p>
            {problems > 0 ? (
              <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[13px] text-muted-foreground">
                {comparison.summary.missing > 0 ? (
                  <li>
                    Add the {comparison.summary.missing} missing{' '}
                    {comparison.summary.missing === 1 ? 'variable' : 'variables'} to your file.
                  </li>
                ) : null}
                {comparison.summary.needsValue > 0 ? (
                  <li>
                    Fill in the {comparison.summary.needsValue} that{' '}
                    {comparison.summary.needsValue === 1 ? 'is' : 'are'} empty or still the example.
                  </li>
                ) : null}
                {comparison.summary.extra > 0 ? (
                  <li>
                    Optionally remove the {comparison.summary.extra} that{' '}
                    {comparison.summary.extra === 1 ? 'is' : 'are'} no longer in the example.
                  </li>
                ) : null}
              </ol>
            ) : (
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Your file has every variable the example asks for. The table still shows values
                that differ between the two files.
              </p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onShowTable}>
            Open the table
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function countFor(comparison: Comparison, filter: Filter): number {
  if (filter === 'all') return comparison.rows.length;
  return comparison.summary[filter as Bucket] ?? 0;
}

function CopyFallback({
  text,
  label,
  onClose,
}: {
  text: string;
  label: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="Your browser blocked the clipboard"
      confirmLabel="Done"
      onCancel={onClose}
      onConfirm={onClose}
    >
      <p>{label}. Select the text below and copy it with your keyboard.</p>
      <textarea
        readOnly
        value={text}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        className="mt-1 h-40 w-full resize-none rounded-md border border-input bg-card px-2.5 py-2 font-mono text-[12px] text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none"
      />
    </Dialog>
  );
}

function Footer() {
  return (
    <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border py-4 text-[12px] text-faint">
      <span>EnvCompare never stores anything. No accounts, no cookies, no analytics.</span>
      <a className="text-muted-foreground underline underline-offset-2 hover:text-foreground" href="/privacy">
        How this works
      </a>
      <a
        className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
        href="https://github.com/SynergyFlowLabs/env-compare"
      >
        <Code2 className="size-3.5" aria-hidden="true" />
        Source
      </a>
    </footer>
  );
}
