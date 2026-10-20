import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

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
      className={`pane${dragging ? ' pane--drop' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="pane__bar">
        <label className="sr-only" htmlFor={`name-${id}`}>
          File name for the {isReference ? 'reference' : 'target'} file
        </label>
        <input
          id={`name-${id}`}
          className="pane__name"
          value={name}
          onChange={(event) => onName(event.target.value)}
          spellCheck={false}
          autoComplete="off"
          size={Math.max(name.length, 10)}
        />
        {isReference ? <span className="pane__role">reference</span> : null}
        <span className="pane__bar-spacer" />
      </div>

      <textarea
        className="pane__text"
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

      <div className="pane__foot">
        <span>
          {keyCount} {keyCount === 1 ? 'variable' : 'variables'} · {lineCount}{' '}
          {lineCount === 1 ? 'line' : 'lines'}
        </span>
        <span className="pane__foot-spacer" />
        <button
          type="button"
          className="pane__action"
          onClick={() => pickerRef.current?.click()}
        >
          Choose file
        </button>
        {text ? (
          <button type="button" className="pane__action" onClick={() => onText('')}>
            Clear
          </button>
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
