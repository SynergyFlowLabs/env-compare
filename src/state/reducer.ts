import { applyPatch, type TextPatch } from '../core/patch';
import { assignRoles, isReferenceName, type Bucket } from '../core/compare';
import { SAMPLE_EXAMPLE, SAMPLE_TARGET } from './sample';

/**
 * One reducer, no persistence layer, no middleware (docs/PRD.md §14.5).
 *
 * There is deliberately nowhere to add storage: refreshing the page must lose
 * everything, and the privacy guard fails the build if a storage API appears.
 */

export type Tab = 'summary' | 'table' | 'raw' | 'fix';

/**
 * Two files is the floor, not the ceiling: `.env` next to `.env.example` is the
 * common case, and `.env.local`, `.env.staging`, `.env.production` are the same
 * question asked more than once. Eight is a UI limit, not an engine one — the
 * table stops being readable before the comparison stops being useful.
 */
export const MIN_FILES = 2;
export const MAX_FILES = 8;

/** Offered in order when a box is added; the first unused one wins. */
const SUGGESTED_NAMES = [
  '.env.local',
  '.env.production',
  '.env.staging',
  '.env.development',
  '.env.test',
  '.env.preview',
  '.env.ci',
  '.env.backup',
];

/** Exports that are copied and simultaneously shown in a dialog. */
export type ExportKind = 'prompt' | 'report';

export interface EnvFileState {
  id: string;
  name: string;
  text: string;
}

export interface Toast {
  id: number;
  message: string;
  undoable?: boolean;
}

export interface UndoEntry {
  fileId: string;
  before: string;
  label: string;
}

export interface AppState {
  files: EnvFileState[];
  referenceId: string;
  /**
   * Which target the Fix tab and the primary copy button act on. Null means
   * "the first target", which is what a two-file comparison always wants.
   */
  activeTargetId: string | null;
  /** Monotonic counter for new file ids; ids are never reused. */
  nextFileId: number;
  /** `input` on first load; `results` once both sides have something to compare. */
  view: 'input' | 'results';
  tab: Tab;
  maskValues: boolean;
  /** `${fileId}:${key}` pairs the user explicitly revealed. */
  revealed: string[];
  sort: 'file' | 'alpha';
  filter: Bucket | 'all';
  undo: UndoEntry[];
  toast: Toast | null;
  confirmClear: boolean;
  /**
   * Whether the next moment both files have keys should flip to the results.
   *
   * Set by a paste or by loading the example, cleared the moment the reader
   * chooses "Edit files". Without this flag the auto-advance effect fires on
   * every render after an edit is requested and slams the reader back into the
   * results — which is exactly the bug this field exists to prevent.
   */
  autoAdvance: boolean;
  /** Show the manual-copy dialog when the Clipboard API is unavailable. */
  copyFallback: { text: string; label: string } | null;
  /**
   * An export (the agent prompt, or the report) that was copied and is now on
   * screen, so the reader can see what they are about to paste somewhere else.
   *
   * `copied` is part of the state rather than local to the dialog so it can
   * tell the truth after an automatic copy the browser refused: the text is
   * still on screen, but the status line must not claim success.
   */
  preview: { kind: ExportKind; text: string; copied: boolean } | null;
}

export type Action =
  | { type: 'text'; id: string; text: string }
  | { type: 'paste'; id: string; text: string }
  | { type: 'advance' }
  | { type: 'name'; id: string; name: string }
  | { type: 'addFile' }
  | { type: 'removeFile'; id: string }
  | { type: 'reference'; id: string }
  | { type: 'target'; id: string }
  | { type: 'swapRoles' }
  | { type: 'loadSample' }
  | { type: 'clearAll' }
  | { type: 'view'; view: AppState['view'] }
  | { type: 'tab'; tab: Tab }
  | { type: 'toggleMask' }
  | { type: 'reveal'; fileId: string; key: string }
  | { type: 'sort'; sort: AppState['sort'] }
  | { type: 'filter'; filter: AppState['filter'] }
  | { type: 'patch'; fileId: string; patch: TextPatch; label: string; toast?: string }
  | { type: 'undo' }
  | { type: 'toast'; message: string; undoable?: boolean }
  | { type: 'dismissToast' }
  | { type: 'confirmClear'; open: boolean }
  | { type: 'copyFallback'; value: AppState['copyFallback'] }
  | { type: 'previewOpen'; kind: ExportKind; text: string; copied: boolean }
  | { type: 'previewCopied'; copied: boolean }
  | { type: 'previewClose' };

let nextToastId = 1;

export const initialState: AppState = {
  files: [
    { id: 'a', name: '.env.example', text: '' },
    { id: 'b', name: '.env', text: '' },
  ],
  referenceId: 'a',
  activeTargetId: null,
  nextFileId: 3,
  view: 'input',
  // The table is the working surface: it is where the answer is actionable.
  tab: 'table',
  maskValues: false,
  revealed: [],
  sort: 'file',
  filter: 'all',
  undo: [],
  toast: null,
  confirmClear: false,
  copyFallback: null,
  preview: null,
  autoAdvance: true,
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'text': {
      const files = state.files.map((f) => (f.id === action.id ? { ...f, text: action.text } : f));
      return { ...state, files };
    }

    /**
     * A paste is a deliberate act and may advance to the results. Typing is not:
     * it would interrupt someone mid-edit.
     */
    case 'paste': {
      const files = state.files.map((f) => (f.id === action.id ? { ...f, text: action.text } : f));
      return { ...state, files, autoAdvance: true };
    }

    case 'advance':
      return { ...state, view: 'results', autoAdvance: false };

    case 'name': {
      const files = state.files.map((f) => (f.id === action.id ? { ...f, name: action.name } : f));
      const referenceId = pickReference(files, state.referenceId);
      return { ...state, files, referenceId };
    }

    case 'addFile': {
      if (state.files.length >= MAX_FILES) return state;
      const used = new Set(state.files.map((f) => f.name.trim()));
      const name = SUGGESTED_NAMES.find((candidate) => !used.has(candidate)) ?? 'untitled.env';
      const file: EnvFileState = { id: `f${state.nextFileId}`, name, text: '' };
      return {
        ...state,
        files: [...state.files, file],
        nextFileId: state.nextFileId + 1,
        view: 'input',
        // Adding a box is a request to edit, not to compare: advancing here
        // would flip straight back to the results before the new box is filled.
        // The paste that follows re-arms the comparison (see the 'paste' case).
        autoAdvance: false,
      };
    }

    case 'removeFile': {
      if (state.files.length <= MIN_FILES) return state;
      const index = state.files.findIndex((f) => f.id === action.id);
      if (index === -1) return state;
      const files = state.files.filter((f) => f.id !== action.id);
      // Removing the reference promotes the next file rather than leaving the
      // comparison without one.
      const referenceId =
        state.referenceId === action.id ? (files[Math.min(index, files.length - 1)]?.id ?? files[0]!.id) : state.referenceId;
      return {
        ...state,
        files,
        referenceId,
        activeTargetId: state.activeTargetId === action.id ? null : state.activeTargetId,
        revealed: [],
        undo: state.undo.filter((entry) => entry.fileId !== action.id),
      };
    }

    case 'reference':
      if (action.id === state.referenceId) return state;
      if (!state.files.some((f) => f.id === action.id)) return state;
      // Choosing the reference is explicit, so the name heuristic must not
      // second-guess it on the next rename.
      return { ...state, referenceId: action.id, activeTargetId: null, revealed: [] };

    case 'target':
      return { ...state, activeTargetId: action.id };

    case 'swapRoles': {
      // With more than two files "swap" means "the next one becomes the
      // reference", which cycles through them in the order they are shown.
      const index = state.files.findIndex((f) => f.id === state.referenceId);
      const next = state.files[(index + 1) % state.files.length] ?? state.files[0];
      return {
        ...state,
        referenceId: next?.id ?? state.referenceId,
        activeTargetId: null,
        revealed: [],
      };
    }

    case 'loadSample':
      return {
        ...state,
        files: [
          { id: 'a', name: '.env.example', text: SAMPLE_EXAMPLE },
          { id: 'b', name: '.env', text: SAMPLE_TARGET },
        ],
        referenceId: 'a',
        view: 'results',
        tab: 'table',
        filter: 'all',
        revealed: [],
        undo: [],
        autoAdvance: true,
      };

    case 'clearAll':
      return {
        ...initialState,
        // Keep the boxes (and the id counter) the reader has arranged; clear
        // only what was pasted into them. Resetting the counter would mint
        // duplicate ids on the next "Add another file".
        files: state.files.map((f) => ({ ...f, text: '' })),
        nextFileId: state.nextFileId,
        activeTargetId: state.activeTargetId,
      };

    case 'view':
      // Going back to the editor is a decision; it must not be undone by the
      // auto-advance effect a tick later.
      return { ...state, view: action.view, autoAdvance: action.view !== 'input' };

    case 'tab':
      return { ...state, tab: action.tab };

    case 'toggleMask':
      return { ...state, maskValues: !state.maskValues, revealed: [] };

    case 'reveal': {
      const id = `${action.fileId}:${action.key}`;
      const revealed = state.revealed.includes(id)
        ? state.revealed
        : [...state.revealed, id];
      return { ...state, revealed };
    }

    case 'sort':
      return { ...state, sort: action.sort };

    case 'filter':
      return { ...state, filter: action.filter };

    case 'patch': {
      const file = state.files.find((f) => f.id === action.fileId);
      if (!file) return state;
      const result = applyPatch(file.text, action.patch);
      if (result.text === file.text) return state;
      const files = state.files.map((f) =>
        f.id === action.fileId ? { ...f, text: result.text } : f,
      );
      const note = result.notes[0];
      return {
        ...state,
        files,
        undo: [...state.undo, { fileId: file.id, before: file.text, label: action.label }].slice(-50),
        toast: {
          id: nextToastId++,
          message: note ?? action.toast ?? 'Updated',
          undoable: true,
        },
      };
    }

    case 'undo': {
      const entry = state.undo[state.undo.length - 1];
      if (!entry) return state;
      const files = state.files.map((f) =>
        f.id === entry.fileId ? { ...f, text: entry.before } : f,
      );
      return {
        ...state,
        files,
        undo: state.undo.slice(0, -1),
        toast: { id: nextToastId++, message: 'Undone' },
      };
    }

    case 'toast':
      return { ...state, toast: { id: nextToastId++, message: action.message, ...(action.undoable ? { undoable: true } : {}) } };

    case 'dismissToast':
      return { ...state, toast: null };

    case 'confirmClear':
      return { ...state, confirmClear: action.open };

    case 'copyFallback':
      return { ...state, copyFallback: action.value };

    case 'previewOpen':
      return {
        ...state,
        preview: { kind: action.kind, text: action.text, copied: action.copied },
      };

    case 'previewCopied':
      return state.preview
        ? { ...state, preview: { ...state.preview, copied: action.copied } }
        : state;

    case 'previewClose':
      return { ...state, preview: null };
  }
}

/**
 * Keep the reference sensible as filenames change: if exactly one file looks
 * like an example file, that one is the reference (PRD US-02).
 */
function pickReference(files: EnvFileState[], current: string): string {
  const roles = assignRoles(files.map((f) => f.name));
  const detected = files[roles.findIndex((r) => r === 'reference')]?.id;
  const currentName = files.find((f) => f.id === current)?.name ?? '';
  // Only override when the current reference is not itself an example file and
  // another file clearly is.
  if (detected && detected !== current && isReferenceName(files.find((f) => f.id === detected)?.name ?? '')) {
    return detected;
  }
  if (isReferenceName(currentName)) return current;
  return current;
}
