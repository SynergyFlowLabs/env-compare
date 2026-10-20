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
  /** Show the manual-copy dialog when the Clipboard API is unavailable. */
  copyFallback: { text: string; label: string } | null;
}

export type Action =
  | { type: 'text'; id: string; text: string }
  | { type: 'name'; id: string; name: string }
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
  | { type: 'copyFallback'; value: AppState['copyFallback'] };

let nextToastId = 1;

export const initialState: AppState = {
  files: [
    { id: 'a', name: '.env.example', text: '' },
    { id: 'b', name: '.env', text: '' },
  ],
  referenceId: 'a',
  view: 'input',
  tab: 'summary',
  maskValues: false,
  revealed: [],
  sort: 'file',
  filter: 'all',
  undo: [],
  toast: null,
  confirmClear: false,
  copyFallback: null,
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'text': {
      const files = state.files.map((f) => (f.id === action.id ? { ...f, text: action.text } : f));
      return { ...state, files };
    }

    case 'name': {
      const files = state.files.map((f) => (f.id === action.id ? { ...f, name: action.name } : f));
      const referenceId = pickReference(files, state.referenceId);
      return { ...state, files, referenceId };
    }

    case 'swapRoles': {
      const referenceId = state.files.find((f) => f.id !== state.referenceId)?.id ?? state.referenceId;
      return { ...state, referenceId, revealed: [] };
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
        tab: 'summary',
        filter: 'all',
        revealed: [],
        undo: [],
      };

    case 'clearAll':
      return {
        ...initialState,
        files: state.files.map((f) => ({ ...f, text: '' })),
      };

    case 'view':
      return { ...state, view: action.view };

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
