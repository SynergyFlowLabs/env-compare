import { useMemo, useState } from 'react';
import { Bot, Copy, Download, Share2 } from 'lucide-react';
import type { Comparison } from '../../core/compare';
import { buildAgentPrompt, buildFixBlock, buildReport, type Redaction } from '../../core/export';
import type { ExportKind } from '../../state/reducer';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';

export interface FixPanelProps {
  comparison: Comparison;
  /** Every target, in the order the boxes are shown. */
  targets: Array<{ id: string; name: string }>;
  activeTargetId: string;
  onTargetChange: (id: string) => void;
  targetText: string;
  onCopy: (text: string, label: string) => void;
  /**
   * Copies an export and opens the dialog that shows it. Kept separate from
   * `onCopy` because these actions have a second half — the reader must be able
   * to read what they are about to hand to an agent, or paste into a PR.
   */
  onExport: (kind: ExportKind, text: string, done: string) => void;
  onDownload: (filename: string, text: string) => void;
}

const REDACTIONS: Array<{ id: Redaction; label: string }> = [
  { id: 'keys', label: 'Key names only' },
  { id: 'masked', label: 'Masked values' },
  { id: 'full', label: 'Full values' },
];

const CODE_BLOCK =
  'max-h-[320px] overflow-auto rounded-md border border-border bg-secondary/60 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre scroll-quiet';

export function FixPanel({
  comparison,
  targets,
  activeTargetId,
  onTargetChange,
  targetText,
  onCopy,
  onExport,
  onDownload,
}: FixPanelProps) {
  const [redaction, setRedaction] = useState<Redaction>('keys');

  const targetId = activeTargetId;
  const targetName = targets.find((t) => t.id === targetId)?.name ?? 'this file';
  const multipleTargets = targets.length > 1;

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
    <div className="grid gap-4">
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle id="fix-heading" className="flex-1">
            Paste this into{' '}
            {multipleTargets ? (
              <label className="sr-only" htmlFor="fix-target">
                Target file
              </label>
            ) : null}
            {multipleTargets ? (
              <select
                id="fix-target"
                value={targetId}
                onChange={(event) => onTargetChange(event.target.value)}
                aria-label="Target file to fix"
                className="mono h-7 rounded-sm border border-input bg-card px-1.5 text-[12.5px] font-medium text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none"
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="mono">{targetName}</span>
            )}
          </CardTitle>
          <span className="text-[12px] text-muted-foreground">{fix.keys.length} to add</span>
        </CardHeader>
        <CardContent className="pt-3">
          {fix.keys.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Nothing to add — every required variable is already in {targetName}.
            </p>
          ) : (
            <>
              <pre className={CODE_BLOCK} aria-label={`Variables to add to ${targetName}`}>
                {fix.text}
              </pre>
              <p className="mt-2.5 text-[12.5px] text-muted-foreground">
                Values are blank on purpose: this tool never copies a value between files.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => onCopy(fix.text, `Copied ${fix.keys.length} variables`)}
                >
                  <Copy aria-hidden="true" />
                  Copy {fix.keys.length} for {targetName}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle id="report-heading" className="flex-1">
            Share the result
          </CardTitle>
          <Label htmlFor="redaction" className="text-[12px] font-normal text-muted-foreground">
            Include
          </Label>
          <select
            id="redaction"
            value={redaction}
            onChange={(event) => setRedaction(event.target.value as Redaction)}
            className="h-7 rounded-sm border border-input bg-card px-1.5 text-[12.5px] text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/25 focus-visible:outline-none"
          >
            {REDACTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="pt-3">
          <pre className={CODE_BLOCK} aria-label="Report preview">
            {report}
          </pre>
          {redaction === 'full' ? (
            <p className="mt-2.5 text-[12.5px] text-missing">
              Full values are included. This report is as sensitive as the file itself.
            </p>
          ) : (
            <p className="mt-2.5 text-[12.5px] text-muted-foreground">
              Safe to paste into a PR, a chat, or an issue.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onExport('report', report, 'Report copied')}
            >
              <Share2 aria-hidden="true" />
              Copy report
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onExport('prompt', prompt, 'Prompt copied for your agent')}
              disabled={prompt === ''}
            >
              <Bot aria-hidden="true" />
              Copy prompt for my agent
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle id="download-heading">Keep the file</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <p className="max-w-[62ch] text-[12.5px] text-muted-foreground">
            The download is generated in this tab from the text you pasted — nothing is sent
            anywhere. Comments, ordering and line endings are preserved.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" onClick={() => onDownload(targetName || 'env', targetText)}>
              <Download aria-hidden="true" />
              Download {targetName || 'env'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
