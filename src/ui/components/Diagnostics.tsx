import type { FileSummary } from '../../core/compare';

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
    <section className="diagnostics" aria-labelledby="diagnostics-heading">
      <div className="diagnostics__head" id="diagnostics-heading">
        {problems > 0
          ? `${problems} ${problems === 1 ? 'line needs' : 'lines need'} a look`
          : 'A few notes about these files'}
      </div>
      <ul>
        {items.map((item, index) => (
          <li key={`${item.file}-${item.line}-${index}`} className={`diag--${item.severity}`}>
            {item.message} <span className="muted">({item.file})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
