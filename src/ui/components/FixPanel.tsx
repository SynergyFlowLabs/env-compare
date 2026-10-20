import { useMemo, useState } from 'react';
import type { Comparison } from '../../core/compare';
import { buildAgentPrompt, buildFixBlock, buildReport, type Redaction } from '../../core/export';

export interface FixPanelProps {
  comparison: Comparison;
  targetId: string;
  targetName: string;
  targetText: string;
  onCopy: (text: string, label: string) => void;
  onDownload: (filename: string, text: string) => void;
}

const REDACTIONS: Array<{ id: Redaction; label: string }> = [
  { id: 'keys', label: 'Key names only' },
  { id: 'masked', label: 'Masked values' },
  { id: 'full', label: 'Full values' },
];

export function FixPanel({ comparison, targetId, targetName, targetText, onCopy, onDownload }: FixPanelProps) {
  const [redaction, setRedaction] = useState<Redaction>('keys');

  const fix = useMemo(() => buildFixBlock(comparison, targetId), [comparison, targetId]);
  const prompt = useMemo(() => buildAgentPrompt(comparison, targetId), [comparison, targetId]);
  // Freeze "now" for the lifetime of the panel so the preview does not change
  // under the user's cursor while they read it.
  const stamp = useMemo(() => new Date(), []);
  const report = useMemo(
    () => buildReport(comparison, { redaction, now: stamp }),
    [comparison, redaction, stamp],
  );

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="panel" aria-labelledby="fix-heading">
        <div className="panel__head">
          <strong id="fix-heading">Paste this into {targetName}</strong>
          <span className="panel__head-spacer" />
          <span>{fix.keys.length} to add</span>
        </div>
        <div className="panel__body">
          {fix.keys.length === 0 ? (
            <p className="muted">
              Nothing to add — every required variable is already in {targetName}.
            </p>
          ) : (
            <>
              <pre className="code-block">{fix.text}</pre>
              <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                Values are blank on purpose: this tool never copies a value between files.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => onCopy(fix.text, `Copied ${fix.keys.length} variables`)}
                >
                  Copy {fix.keys.length} for {targetName}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="report-heading">
        <div className="panel__head">
          <strong id="report-heading">Share the result</strong>
          <span className="panel__head-spacer" />
          <label htmlFor="redaction" className="muted">
            Include
          </label>
          <select
            id="redaction"
            value={redaction}
            onChange={(event) => setRedaction(event.target.value as Redaction)}
            className="btn btn--sm"
          >
            {REDACTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="panel__body">
          <pre className="code-block" aria-label="Report preview">
            {report}
          </pre>
          {redaction === 'full' ? (
            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--st-missing)' }}>
              Full values are included. This report is as sensitive as the file itself.
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
              Safe to paste into a PR, a chat, or an issue.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              onClick={() => onCopy(report, 'Report copied')}
            >
              Copy report
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onCopy(prompt, 'Prompt copied')}
              disabled={prompt === ''}
            >
              Copy prompt for my agent
            </button>
          </div>
        </div>
      </section>

      <section className="panel" aria-labelledby="download-heading">
        <div className="panel__head">
          <strong id="download-heading">Keep the file</strong>
        </div>
        <div className="panel__body">
          <p className="muted" style={{ fontSize: 13 }}>
            The download is generated in this tab from the text you pasted — nothing is sent
            anywhere. Comments, ordering and line endings are preserved.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => onDownload(targetName || 'env', targetText)}
            >
              Download {targetName || 'env'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
