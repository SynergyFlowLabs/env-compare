import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
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
  onName: (name: string) => void;
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
  onName,
  onProblem,
}: FilePaneProps) {
  const [dragging, setDragging] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void readFile(file);
    event.target.value = '';
  };

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-lg border bg-card transition-colors',
        dragging ? 'border-ring bg-brand-soft/40 ring-[3px] ring-ring/20' : 'border-border',
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Label htmlFor={`name-${id}`} className="sr-only">
          File name for the {isReference ? 'reference' : 'target'} file
        </Label>
        <Input
          id={`name-${id}`}
          className="h-7 w-auto max-w-[60%] border-transparent bg-transparent px-1 font-mono text-[13px] font-medium hover:border-input focus-visible:border-ring"
          value={name}
          onChange={(event) => onName(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          size={Math.max(name.length, 10)}
        />
        {isReference ? (
          <span className="rounded-sm border border-differs/25 bg-differs-tint px-1.5 py-0.5 text-[11px] font-medium text-differs">
            reference
          </span>
        ) : null}
        <span className="flex-1" />
      </div>

      <Textarea
        className="min-h-[220px] flex-1 rounded-none border-0 bg-transparent px-3 py-2.5 font-mono text-[12.5px] leading-relaxed focus-visible:ring-0"
        value={text}
        onChange={(event) => onText(event.target.value)}
        placeholder={isReference ? 'Paste your .env.example here' : 'Paste your .env here'}
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
          className="h-6 px-2 text-[12px]"
          onClick={() => pickerRef.current?.click()}
        >
          Choose file
        </Button>
        {text ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[12px]"
            onClick={() => onText('')}
          >
            Clear
          </Button>
        ) : null}
        <input
          ref={pickerRef}
          type="file"
          accept=".env,text/plain"
          onChange={handlePick}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
