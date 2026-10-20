import { useMemo, useState } from 'react';
import { PRESENCE_LABEL, sortRows, type Bucket, type Cell, type Comparison, type KeyRow } from '../../core/compare';
import type { Span } from '../../core/types';
import { StateChip } from './StateChip';

export type Filter = Bucket | 'all';

export interface TableActions {
  onReveal: (fileId: string, key: string) => void;
  onEdit: (fileId: string, key: string, value: string) => void;
  onAdd: (fileId: string, key: string) => void;
  onUncomment: (fileId: string, line: number) => void;
  onRemove: (fileId: string, span: Span) => void;
}

interface CompareTableProps {
  comparison: Comparison;
  maskValues: boolean;
  revealed: Set<string>;
  filter: Filter;
  sort: 'file' | 'alpha';
  actions: TableActions;
}

/** Rows rendered at once before the table asks whether to keep going. */
const PAGE = 300;

export function CompareTable({
  comparison,
  maskValues,
  revealed,
  filter,
  sort,
  actions,
}: CompareTableProps) {
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<{ fileId: string; key: string } | null>(null);
  const [draft, setDraft] = useState('');

  const files = comparison.perFile;
  const reference = files.find((f) => f.role === 'reference');

  const rows = useMemo(() => {
    const ordered = sortRows(comparison.rows, sort);
    return filter === 'all' ? ordered : ordered.filter((row) => row.bucket === filter);
  }, [comparison.rows, filter, sort]);

  const visible = rows.slice(0, limit);

  const beginEdit = (fileId: string, row: KeyRow, cell: Cell) => {
    setEditing({ fileId, key: row.key });
    setDraft(cell.occurrence?.value ?? '');
  };

  const commit = (fileId: string, key: string) => {
    if (!editing) return;
    actions.onEdit(fileId, key, draft);
    setEditing(null);
  };

  if (comparison.rows.length === 0) {
    return <div className="empty">No variables found in these files yet.</div>;
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th scope="col" className="gutter">
                <span className="sr-only">Line in {reference?.name ?? 'reference file'}</span>
              </th>
              <th scope="col">Key</th>
              {files.map((file) => (
                <th
                  key={file.fileId}
                  scope="col"
                  className={file.role === 'reference' ? 'is-reference' : undefined}
                >
                  {file.name}
                  {file.role === 'reference' ? <span className="sr-only"> (reference)</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const lineNumber = row.cells.find((c) => c.fileId === comparison.referenceId)?.occurrence?.line;
              return (
                <tr key={row.key} className={`row--${row.bucket}`}>
                  <td className="gutter" aria-hidden="true">
                    {lineNumber ?? '—'}
                  </td>
                  <th scope="row" className="keycell">
                    {row.key}
                    {row.valueDiffers ? (
                      <span className="state" style={{ marginLeft: 8 }}>
                        <span className="state__icon" aria-hidden="true">
                          ≠
                        </span>
                        <span className="sr-only">Set differently in each file</span>
                      </span>
                    ) : null}
                  </th>
                  {files.map((file) => {
                    const cell = row.cells.find((c) => c.fileId === file.fileId);
                    if (!cell) {
                      return <td key={file.fileId}>—</td>;
                    }
                    return (
                      <td
                        key={file.fileId}
                        aria-label={`${row.key} in ${file.name}: ${PRESENCE_LABEL[cell.presence]}`}
                      >
                        <CellView
                          cell={cell}
                          fileId={file.fileId}
                          fileLabel={file.name}
                          row={row}
                          editing={editing}
                          draft={draft}
                          maskValues={maskValues}
                          revealed={revealed.has(`${file.fileId}:${row.key}`)}
                          actions={actions}
                          onBeginEdit={beginEdit}
                          onDraft={setDraft}
                          onCommit={commit}
                          onCancel={() => setEditing(null)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > limit ? (
        <p style={{ marginTop: 12, fontSize: 13 }} className="muted">
          Showing the first {limit} of {rows.length} variables.{' '}
          <button type="button" className="linkish" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more
          </button>
        </p>
      ) : null}
      {rows.length === 0 ? <div className="empty">Nothing matches this filter.</div> : null}
    </div>
  );
}

interface CellViewProps {
  cell: Cell;
  fileId: string;
  fileLabel: string;
  row: KeyRow;
  editing: { fileId: string; key: string } | null;
  draft: string;
  maskValues: boolean;
  revealed: boolean;
  actions: TableActions;
  onBeginEdit: (fileId: string, row: KeyRow, cell: Cell) => void;
  onDraft: (value: string) => void;
  onCommit: (fileId: string, key: string) => void;
  onCancel: () => void;
}

function CellView({
  cell,
  fileId,
  fileLabel,
  row,
  editing,
  draft,
  maskValues,
  revealed,
  actions,
  onBeginEdit,
  onDraft,
  onCommit,
  onCancel,
}: CellViewProps) {
  const isEditing = editing?.fileId === fileId && editing.key === row.key;
  const value = cell.occurrence?.value ?? '';
  const hidden = maskValues && !revealed && value !== '';

  if (isEditing) {
    return (
      <input
        className="value-input"
        value={draft}
        autoFocus
        aria-label={`Value for ${row.key} in ${fileLabel}`}
        onChange={(event) => onDraft(event.target.value)}
        onBlur={() => onCommit(fileId, row.key)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onCommit(fileId, row.key);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        spellCheck={false}
        autoComplete="off"
      />
    );
  }

  const canEdit = cell.presence === 'present' || cell.presence === 'empty' || cell.presence === 'placeholder';

  return (
    <div className={`cell cell--${cell.presence}`}>
      <StateChip presence={cell.presence} quiet={cell.presence === 'present'} />

      {cell.presence === 'absent' ? null : cell.presence === 'commented' ? null : (
        <span
          className={`value${hidden ? ' value--masked' : ''}`}
          role={canEdit ? 'button' : undefined}
          tabIndex={canEdit ? 0 : undefined}
          title={canEdit ? 'Click to edit' : undefined}
          onClick={() => canEdit && onBeginEdit(fileId, row, cell)}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && canEdit) {
              event.preventDefault();
              onBeginEdit(fileId, row, cell);
            }
          }}
        >
          {hidden ? (cell.isSecret ? '••••••••' : '••••') : displayValue(value, cell)}
        </span>
      )}

      {maskValues && !revealed && value !== '' ? (
        <button
          type="button"
          className="row-action"
          onClick={() => actions.onReveal(fileId, row.key)}
          aria-label={`Show the value of ${row.key} in ${fileLabel}`}
        >
          Show
        </button>
      ) : null}

      {cell.action === 'add' ? (
        <button
          type="button"
          className="socket-action"
          onClick={() => actions.onAdd(fileId, row.key)}
          aria-label={`Add ${row.key} to ${fileLabel}`}
        >
          + Add
        </button>
      ) : null}

      {cell.action === 'uncomment' ? (
        <button
          type="button"
          className="row-action"
          onClick={() => cell.occurrence && actions.onUncomment(fileId, cell.occurrence.line)}
          aria-label={`Uncomment ${row.key} in ${fileLabel}`}
        >
          Uncomment
        </button>
      ) : null}

      {cell.action === 'remove' ? (
        <button
          type="button"
          className="row-action"
          onClick={() => cell.occurrence && actions.onRemove(fileId, cell.occurrence.span)}
          aria-label={`Remove ${row.key} from ${fileLabel}`}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

function displayValue(value: string, cell: Cell): string {
  if (value === '') return '—';
  if (value.includes('\n')) {
    return `multiline (${value.split('\n').length} lines)`;
  }
  void cell;
  return value;
}
