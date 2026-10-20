import { useMemo, useState } from 'react';
import { Eraser, EqualNot, Eye, Plus, Trash2 } from 'lucide-react';
import {
  PRESENCE_LABEL,
  sortRows,
  type Bucket,
  type Cell,
  type Comparison,
  type KeyRow,
} from '../../core/compare';
import type { Span } from '../../core/types';
import { StateChip } from './StateChip';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '../lib/utils';

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

/**
 * State is carried by tint *and* by the chip's glyph, never by colour alone.
 * A missing variable is drawn as a dashed socket rather than an empty cell, so
 * "there is nothing here" reads as a hole in the table instead of a rendering
 * failure.
 */
const CELL_TONE: Record<string, string> = {
  absent: 'border border-dashed border-missing/40 bg-missing-tint/50',
  empty: 'bg-empty-tint/60',
  placeholder: 'bg-placeholder-tint/60',
  commented: 'bg-commented-tint/60',
  present: '',
};

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
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
        No variables found in these files yet.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <span className="sr-only">Line in {reference?.name ?? 'reference file'}</span>
              </TableHead>
              <TableHead>Key</TableHead>
              {files.map((file) => (
                <TableHead
                  key={file.fileId}
                  className={file.role === 'reference' ? 'text-foreground' : undefined}
                >
                  <span className="mono">{file.name}</span>
                  {file.role === 'reference' ? <span className="sr-only"> (reference)</span> : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => {
              const lineNumber = row.cells.find((c) => c.fileId === comparison.referenceId)
                ?.occurrence?.line;
              return (
                <TableRow key={row.key}>
                  <TableCell className="font-mono text-[11.5px] text-faint" aria-hidden="true">
                    {lineNumber ?? '—'}
                  </TableCell>
                  <th scope="row" className="px-2.5 py-1.5 text-left align-middle">
                    <span className="mono text-[12.5px] font-medium tracking-tight">{row.key}</span>
                    {row.valueDiffers ? (
                      <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11.5px] font-medium text-differs">
                        <EqualNot className="size-3.5" aria-hidden="true" focusable="false" />
                        <span className="sr-only">Set differently in each file</span>
                      </span>
                    ) : null}
                  </th>
                  {files.map((file) => {
                    const cell = row.cells.find((c) => c.fileId === file.fileId);
                    if (!cell) {
                      return (
                        <TableCell key={file.fileId} className="text-faint">
                          —
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell
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
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {rows.length > limit ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Showing the first {limit} of {rows.length} variables.{' '}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more
          </Button>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          Nothing matches this filter.
        </div>
      ) : null}
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
      <Input
        className="h-7 font-mono text-[12.5px]"
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

  const canEdit =
    cell.presence === 'present' || cell.presence === 'empty' || cell.presence === 'placeholder';

  return (
    <div
      className={cn(
        'flex min-h-7 flex-wrap items-center gap-1.5 rounded-sm px-1.5 py-0.5',
        CELL_TONE[cell.presence],
      )}
    >
      <StateChip presence={cell.presence} quiet={cell.presence === 'present'} />

      {cell.presence === 'absent' || cell.presence === 'commented' ? null : (
        <span
          className={cn(
            'mono min-w-0 max-w-[38ch] truncate text-[12.5px] text-foreground',
            hidden && 'tracking-widest text-faint',
            canEdit && 'cursor-text rounded-sm hover:bg-secondary/70',
          )}
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[11px]"
          onClick={() => actions.onReveal(fileId, row.key)}
          aria-label={`Show the value of ${row.key} in ${fileLabel}`}
        >
          <Eye className="size-3" aria-hidden="true" focusable="false" />
          Show
        </Button>
      ) : null}

      {cell.action === 'add' ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 border-missing/30 px-1.5 text-[11.5px] text-missing hover:bg-missing-tint"
          onClick={() => actions.onAdd(fileId, row.key)}
          aria-label={`Add ${row.key} to ${fileLabel}`}
        >
          <Plus className="size-3" aria-hidden="true" focusable="false" />
          Add
        </Button>
      ) : null}

      {cell.action === 'uncomment' ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11.5px]"
          onClick={() => cell.occurrence && actions.onUncomment(fileId, cell.occurrence.line)}
          aria-label={`Uncomment ${row.key} in ${fileLabel}`}
        >
          <Eraser className="size-3" aria-hidden="true" focusable="false" />
          Uncomment
        </Button>
      ) : null}

      {cell.action === 'remove' ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11.5px]"
          onClick={() => cell.occurrence && actions.onRemove(fileId, cell.occurrence.span)}
          aria-label={`Remove ${row.key} from ${fileLabel}`}
        >
          <Trash2 className="size-3" aria-hidden="true" focusable="false" />
          Remove
        </Button>
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
