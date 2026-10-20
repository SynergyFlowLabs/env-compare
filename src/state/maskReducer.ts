import { defaultSettings, readEnvSource, type EnvSource, type MaskMode } from '../core/mask';

/**
 * State for the env masking page.
 *
 * The same rule as the comparison tool: one reducer, no persistence, and no
 * place to put the pasted text except this object, which dies with the tab.
 * Originals are kept here so masking is non-destructive — the exported text is
 * always derived, never the source.
 */

export interface MaskState {
  /** What the reader pasted or opened, untouched. */
  text: string;
  fileName: string;
  source: EnvSource | null;
  error: string | null;
  /** Mode for every value without a per-key override. */
  valueMode: MaskMode;
  /** Key name → mode, overriding `valueMode`. */
  keyModes: Record<string, MaskMode>;
  keep: number;
  /** Indices of entries whose original value is visible in this tab. */
  revealed: number[];
  toast: string | null;
}

export type MaskAction =
  | { type: 'load'; text: string; fileName?: string }
  | { type: 'fail'; message: string }
  | { type: 'clear' }
  | { type: 'mode'; mode: MaskMode }
  | { type: 'key'; key: string; mode: MaskMode | 'file' }
  | { type: 'keep'; keep: number }
  | { type: 'reveal'; index: number }
  | { type: 'hide-reveals' }
  | { type: 'reset' }
  | { type: 'toast'; message: string | null };

export const initialMaskState: MaskState = {
  text: '',
  fileName: '',
  source: null,
  error: null,
  valueMode: 'hide',
  keyModes: {},
  keep: 4,
  revealed: [],
  toast: null,
};

/** The message for a paste that has no variables in it, whatever it does have. */
function emptyMessage(source: EnvSource): string {
  if (source.looksLikeTable) {
    return 'That looks like a multi-column CSV. This page masks .env files — one KEY=value per line.';
  }
  return 'No KEY=value lines found. An env file needs at least one variable.';
}

export function maskReducer(state: MaskState, action: MaskAction): MaskState {
  switch (action.type) {
    case 'load': {
      const source = readEnvSource(action.text);
      if (source.entries.length === 0) {
        return {
          ...state,
          text: action.text,
          fileName: action.fileName ?? '',
          source: null,
          error: emptyMessage(source),
        };
      }
      const settings = defaultSettings(source);
      return {
        ...state,
        text: action.text,
        fileName: action.fileName ?? '',
        source,
        error: null,
        valueMode: settings.valueMode,
        keyModes: { ...settings.keyModes },
        revealed: [],
        toast: null,
      };
    }

    case 'fail':
      return { ...state, error: action.message, source: null };

    case 'clear':
      return { ...initialMaskState, keep: state.keep };

    case 'mode':
      // The file-wide mode replaces per-key overrides: "hide everything" must
      // mean everything, or the button would leave quiet exceptions behind.
      return { ...state, valueMode: action.mode, keyModes: {} };

    case 'key': {
      const keyModes = { ...state.keyModes };
      if (action.mode === 'file') delete keyModes[action.key];
      else keyModes[action.key] = action.mode;
      return { ...state, keyModes };
    }

    case 'keep':
      return { ...state, keep: action.keep };

    case 'reveal': {
      const revealed = state.revealed.includes(action.index)
        ? state.revealed.filter((item) => item !== action.index)
        : [...state.revealed, action.index];
      return { ...state, revealed };
    }

    case 'hide-reveals':
      return { ...state, revealed: [] };

    case 'reset':
      if (!state.source) return state;
      return {
        ...state,
        valueMode: defaultSettings(state.source).valueMode,
        keyModes: { ...defaultSettings(state.source).keyModes },
        revealed: [],
      };

    case 'toast':
      return { ...state, toast: action.message };
  }
}
