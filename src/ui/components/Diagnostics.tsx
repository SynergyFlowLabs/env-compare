import { AlertCircle, Info } from 'lucide-react';
import type { FileSummary } from '../../core/compare';
import { Alert, AlertTitle } from './ui/alert';

const HIDDEN = new Set(['MULTILINE']);

/**
 * Parser notes, grouped by file. Nothing is shown when there is nothing to say —
 * empty chrome trains people to ignore the panel.
 */
export function Diagnostics({ files }: { files: FileSummary[] }) {
  const items = files.flatMap((file) =>
    file.diagnostics
      .filter((diagnostic) => !HIDDEN.has(diagnostic.code))
      .map((diagnostic) => ({ file: file.name, ...diagnostic })),
  );

  if (items.length === 0) return null;

  const problems = items.filter((item) => item.severity !== 'info').length;

  return (
    <section className="mt-4" aria-labelledby="diagnostics-heading">
      <Alert variant={problems > 0 ? 'note' : 'default'}>
        {problems > 0 ? (
          <AlertCircle className="row-span-2" aria-hidden="true" />
        ) : (
          <Info className="row-span-2" aria-hidden="true" />
        )}
        <AlertTitle id="diagnostics-heading" className="text-[12.5px]">
          {problems > 0
            ? `${problems} ${problems === 1 ? 'line needs' : 'lines need'} a look`
            : 'A few notes about these files'}
        </AlertTitle>
        <ul className="col-start-2 mt-1 list-disc space-y-0.5 pl-4 text-[12px]">
          {items.map((item, index) => (
            <li key={`${item.file}-${item.line}-${index}`}>
              {item.message} <span className="opacity-70">({item.file})</span>
            </li>
          ))}
        </ul>
      </Alert>
    </section>
  );
}
