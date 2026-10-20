import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { FileText, FileUp, Pencil, Pin, Trash2, Upload, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { cn } from '../lib/utils';

const MAX_BYTES = 2 * 1024 * 1024;

interface FilePaneProps {
  id: string;
  name: string;
  text: string;
  isReference: boolean;
  keyCount: number;
  lineCount: number;
  onText: (text: string) => void;
  /** Called for a paste, which is allowed to advance to the results view. */
  onPaste: (text: string) => void;
  onName: (name: string) => void;
  /** Promote this file to the reference. Hidden on the reference itself. */
  onMakeReference?: () => void;
  /** Remove this box entirely. Hidden when only the minimum are left. */
  canRemove?: boolean;
  onRemove?: () => void;
  /** A freshly added box should be ready to type into. */
  autoFocusName?: boolean;
  onProblem: (message: string) => void;
}

export function FilePane({
  id,
  name,
  text,
  isReference,
  keyCount,
  lineCount,
  onText,
  onPaste,
  onName,
  onMakeReference,
  canRemove = false,
  onRemove,
  autoFocusName = false,
  onProblem,
}: FilePaneProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const pasting = useRef(false);
  const pickerRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // A box added a moment ago: put the cursor in its name so the reader can
  // label it before pasting, and select the suggested name so typing replaces it.
  useEffect(() => {
    if (!autoFocusName) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [autoFocusName]);

  const readFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      onProblem(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`);
      return;
    }
    let content: string;
    try {
      content = await file.text();
    } catch {
      onProblem('That file could not be read. Try pasting its contents instead.');
      return;
    }
    if (content.includes('\u0000')) {
      onProblem("That doesn't look like a text file.");
      return;
    }
    onText(content);
    onName(file.name);
  };

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    // Without this the browser navigates to the dropped file.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = event.dataTransfer.files;
    if (!files?.length) return;
    if (files.length > 1) {
      onProblem('One file per box — drop the second file in the other one.');
    }
    const file = files[0];
    if (file) void readFile(file);
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = '';
  };

  const role = isReference ? 'reference' : 'target';

  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col rounded-lg border bg-card transition-colors',
        dragging ? 'border-ring ring-[3px] ring-ring/20' : 'border-border',
      )}
      data-dragging={dragging ? 'true' : undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileText className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
        <Label htmlFor={`name-${id}`} className="sr-only">
          File name for the {role} file
        </Label>
        <Input
          id={`name-${id}`}
          ref={nameRef}
          className="h-7 w-auto min-w-0 flex-shrink border-transparent bg-transparent px-1 font-mono text-[13px] font-medium shadow-none hover:border-input focus-visible:border-ring"
          value={name}
          onChange={(event) => onName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
          }}
          placeholder={isReference ? '.env.example' : '.env'}
          aria-describedby={`name-hint-${id}`}
          spellCheck={false}
          autoComplete="off"
          style={{ width: `${Math.max(name.length, 8) + 1}ch` }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-faint hover:text-foreground"
          aria-label={`Rename the ${role} file`}
          title="Rename this file"
          onClick={() => {
            nameRef.current?.focus();
            nameRef.current?.select();
          }}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <span className="sr-only" id={`name-hint-${id}`}>
          You can type a different file name, such as .env.production.
        </span>
        {isReference ? (
          <span className="ml-auto shrink-0 rounded-sm border border-differs/25 bg-differs-tint px-1.5 py-0.5 text-[11px] font-medium text-differs">
            reference
          </span>
        ) : (
          <>
            <span className="ml-auto shrink-0 text-[11px] text-faint">target</span>
            {onMakeReference ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-faint hover:text-foreground"
                aria-label={`Use ${name || 'this file'} as the reference`}
                title="Use this file as the reference"
                onClick={onMakeReference}
              >
                <Pin aria-hidden="true" />
              </Button>
            ) : null}
          </>
        )}
        {canRemove && onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-faint hover:text-missing"
            aria-label={`Remove ${name || 'this file'}`}
            title="Remove this file"
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <Textarea
        id={`text-${id}`}
        className="min-h-[220px] flex-1 rounded-none border-0 bg-transparent px-3 py-2.5 font-mono text-[12.5px] leading-relaxed shadow-none focus-visible:ring-0"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          if (pasting.current) {
            pasting.current = false;
            onPaste(next);
          } else {
            onText(next);
          }
        }}
        onPaste={() => {
          pasting.current = true;
        }}
        placeholder={
          isReference
            ? 'Paste your .env.example here, or drop the file'
            : 'Paste your .env here, or drop the file'
        }
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={`Contents of ${name}`}
        wrap="off"
      />

      <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-[12px] text-muted-foreground">
        <span>
          {keyCount} {keyCount === 1 ? 'variable' : 'variables'} · {lineCount}{' '}
          {lineCount === 1 ? 'line' : 'lines'}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[12px]"
          onClick={() => pickerRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          Choose file
        </Button>
        {text ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[12px]"
            onClick={() => onText('')}
          >
            <X aria-hidden="true" />
            Clear
          </Button>
        ) : null}
        <input
          ref={pickerRef}
          type="file"
          accept=".env,.env.*,text/plain"
          onChange={handlePick}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-brand-soft/85 text-primary backdrop-blur-[1px]">
          <FileUp className="size-6" aria-hidden="true" />
          <p className="text-[13px] font-semibold">Drop to replace {name || 'this file'}</p>
          <p className="text-[11.5px] text-primary/80">Nothing is uploaded — the file is read here.</p>
        </div>
      ) : null}
    </div>
  );
}
