import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { compare, type Bucket, type Comparison, type FileInput } from '../../core/compare';
import { parseEnvFile } from '../../core/parse';
import { buildFixBlock } from '../../core/export';
import { countLines } from '../../core/parse';
import { reducer, initialState } from '../../state/reducer';
import { copyText, downloadText, safeFileName } from '../lib/clipboard';
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

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'table', label: 'Table' },
  { id: 'raw', label: 'Raw' },
  { id: 'fix', label: 'Fix' },
] as const;

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

  // Paste is a deliberate act: once both sides have variables, show the result.
  useEffect(() => {
    if (bothHaveKeys && state.view === 'input') {
      dispatch({ type: 'view', view: 'results' });
    }
  }, [bothHaveKeys, state.view]);

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
    <div className="shell">
      <SkipLink />
      <SiteHeader current="tool" />

      <main className="shell__main" id="main" tabIndex={-1}>
        {state.view === 'input' || !bothHaveKeys ? (
          <section className="landing" aria-labelledby="landing-title">
            <h1 className="landing__title" id="landing-title">
              See what your <code className="mono">.env</code> is missing.
            </h1>
            <p className="landing__lede">
              Paste your <code>.env.example</code> and your <code>.env</code>. This shows every
              variable that is missing, empty, or leftover — and gives you the block to paste back.
            </p>

            <div className="landing__panes">
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
                  onName={(name) => dispatch({ type: 'name', id: file.id, name })}
                  onProblem={(message) => dispatch({ type: 'toast', message })}
                />
              ))}
            </div>

            <div className="landing__footer">
              <button type="button" className="linkish" onClick={() => dispatch({ type: 'loadSample' })}>
                See an example
              </button>
              <button
                type="button"
                className="linkish"
                onClick={() => dispatch({ type: 'swapRoles' })}
                disabled={!referenceFile.text && !targetFile.text}
              >
                Swap which file is the reference
              </button>
              <span className="muted">
                Nothing is sent anywhere. Close the tab and it&apos;s gone.
              </span>
            </div>
          </section>
        ) : null}

        {bothHaveKeys ? (
          <section className="results" aria-label="Comparison results">
            <div className="results__bar">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => dispatch({ type: 'view', view: 'input' })}
              >
                Edit files
              </button>
              <span className="results__names">
                {referenceFile.name} → {targetFile.name}
              </span>
              <span className="results__bar-spacer" />
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => dispatch({ type: 'toggleMask' })}
                aria-pressed={state.maskValues}
              >
                {state.maskValues ? 'Show values' : 'Hide values'}
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => dispatch({ type: 'swapRoles' })}
              >
                Swap
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => dispatch({ type: 'confirmClear', open: true })}
              >
                Clear all
              </button>
            </div>

            <SummaryLine comparison={comparison} />

            <div className="tabs" role="tablist" aria-label="Views">
              {TABS.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={state.tab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  className="tab"
                  onClick={() => dispatch({ type: 'tab', tab: tab.id })}
                >
                  {tab.label}
                  {tab.id === 'table' && problems > 0 ? (
                    <span className="tab__count">{problems}</span>
                  ) : null}
                  <span className="sr-only"> (Alt+{index + 1})</span>
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`panel-${state.tab}`}
              aria-labelledby={`tab-${state.tab}`}
              style={{ animation: 'none' }}
            >
              {state.tab === 'summary' ? (
                <SummaryPanel
                  comparison={comparison}
                  fixBlock={fixBlock}
                  problems={problems}
                  onCopy={() => void copy(fixBlock.text, `Copied ${fixBlock.keys.length} variables`)}
                  onShowTable={() => dispatch({ type: 'tab', tab: 'table' })}
                />
              ) : null}

              {state.tab === 'table' ? (
                <>
                  <div className="filters">
                    {FILTERS.map((filter) => {
                      const count = countFor(comparison, filter.id);
                      if (filter.id !== 'all' && count === 0) return null;
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          className="chip-toggle"
                          aria-pressed={state.filter === filter.id}
                          onClick={() => dispatch({ type: 'filter', filter: filter.id })}
                        >
                          {filter.label}
                          {filter.id === 'all' ? '' : ` ${count}`}
                        </button>
                      );
                    })}
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="chip-toggle"
                      aria-pressed={state.sort === 'alpha'}
                      onClick={() =>
                        dispatch({ type: 'sort', sort: state.sort === 'file' ? 'alpha' : 'file' })
                      }
                    >
                      {state.sort === 'file' ? 'Sort A–Z' : 'Sort by file order'}
                    </button>
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
                </>
              ) : null}

              {state.tab === 'raw' ? (
                <div style={{ marginTop: 16 }}>
                  <RawView
                    comparison={comparison}
                    texts={texts}
                    parsed={parsed}
                    maskValues={state.maskValues}
                  />
                </div>
              ) : null}

              {state.tab === 'fix' ? (
                <div style={{ marginTop: 16 }}>
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
                </div>
              ) : null}
            </div>

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

function SummaryPanel({
  comparison,
  fixBlock,
  problems,
  onCopy,
  onShowTable,
}: {
  comparison: Comparison;
  fixBlock: { text: string; keys: string[] };
  problems: number;
  onCopy: () => void;
  onShowTable: () => void;
}) {
  return (
    <div style={{ marginTop: 16, display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {comparison.perFile.map((file) => (
          <div className="panel" key={file.fileId}>
            <div className="panel__head">
              <strong className="mono">{file.name}</strong>
              <span className="panel__head-spacer" />
              <span>{file.role === 'reference' ? 'reference' : 'target'}</span>
            </div>
            <div className="panel__body">
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, fontSize: 13.5 }}>
                <dt className="muted">Set</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>{file.counts.present}</dd>
                <dt className="muted">Set, but empty</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>{file.counts.empty}</dd>
                <dt className="muted">Still the example value</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>{file.counts.placeholder}</dd>
                <dt className="muted">Commented out</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>{file.counts.commented}</dd>
                <dt className="muted">Not in this file</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>{file.counts.absent}</dd>
              </dl>
            </div>
          </div>
        ))}
      </div>

      {problems > 0 ? (
        <div className="action-card">
          <div className="action-card__steps">
            <p className="action-card__title">What to do now</p>
            <ol>
              {comparison.summary.missing > 0 ? (
                <li>
                  Add the {comparison.summary.missing} missing{' '}
                  {comparison.summary.missing === 1 ? 'variable' : 'variables'} to your file.
                </li>
              ) : null}
              {comparison.summary.needsValue > 0 ? (
                <li>
                  Fill in the {comparison.summary.needsValue} that {comparison.summary.needsValue === 1 ? 'is' : 'are'} empty or still the example.
                </li>
              ) : null}
              {comparison.summary.extra > 0 ? (
                <li className="muted">
                  Optionally remove the {comparison.summary.extra} that{' '}
                  {comparison.summary.extra === 1 ? 'is' : 'are'} no longer in the example.
                </li>
              ) : null}
            </ol>
          </div>
          {fixBlock.keys.length > 0 ? (
            <button type="button" className="btn btn--primary" onClick={onCopy}>
              Copy {fixBlock.keys.length} for {comparison.perFile.find((f) => f.role === 'target')?.name}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onShowTable}>
            Open the table
          </button>
        </div>
      ) : (
        <div className="action-card">
          <div className="action-card__steps">
            <p className="action-card__title">Nothing to fix</p>
            <p style={{ fontSize: 13.5 }} className="muted">
              Your file has every variable the example asks for. The table still shows values that
              differ between the two files.
            </p>
          </div>
          <button type="button" className="btn" onClick={onShowTable}>
            Open the table
          </button>
        </div>
      )}
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
      <textarea readOnly value={text} autoFocus onFocus={(event) => event.currentTarget.select()} />
    </Dialog>
  );
}

function Footer() {
  return (
    <footer className="footnote">
      <span>EnvCompare never stores anything. No accounts, no cookies, no analytics.</span>
      <a href="/privacy">How this works</a>
      <a href="https://github.com/SynergyFlowLabs/env-compare">Source</a>
    </footer>
  );
}

