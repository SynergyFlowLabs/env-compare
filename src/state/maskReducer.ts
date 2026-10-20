import { parseCsv, type CsvTable } from '../core/csv';
import { defaultSettings, type MaskMode } from '../core/mask';

/**
 * State for the CSV masking page.
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
  table: CsvTable | null;
  error: string | null;
  columnModes: Record<number, MaskMode>;
  /** Key name → mode, overriding its column. Empty means "follow the column". */
  keyModes: Record<string, MaskMode>;
  keyColumn: number | null;
  keep: number;
  /** `${row}:${column}` cells the reader has chosen to look at, in this tab only. */
  revealed: string[];
  toast: string | null;
}

export type MaskAction =
  | { type: 'load'; text: string; fileName?: string }
  | { type: 'fail'; message: string }
  | { type: 'clear' }
  | { type: 'column'; column: number; mode: MaskMode }
  | { type: 'key'; key: string; mode: MaskMode | 'column' }
  | { type: 'keep'; keep: number }
  | { type: 'reveal'; row: number; column: number }
  | { type: 'hide-reveals' }
  | { type: 'reset' }
  | { type: 'toast'; message: string | null };

export const initialMaskState: MaskState = {
  text: '',
  fileName: '',
  table: null,
  error: null,
  columnModes: {},
  keyModes: {},
  keyColumn: null,
  keep: 4,
  revealed: [],
  toast: null,
};

export function maskReducer(state: MaskState, action: MaskAction): MaskState {
  switch (action.type) {
    case 'load': {
      const table = parseCsv(action.text);
      if (table.rows.length === 0) {
        return {
          ...state,
          text: action.text,
          fileName: action.fileName ?? '',
          table: null,
          error: 'No rows found. A CSV needs a header row and at least one row of values.',
        };
      }
      const settings = defaultSettings(table);
      return {
        ...state,
        text: action.text,
        fileName: action.fileName ?? '',
        table,
        error: null,
        columnModes: { ...settings.columnModes },
        keyModes: {},
        keyColumn: settings.keyColumn ?? null,
        revealed: [],
        toast: null,
      };
    }

    case 'fail':
      return { ...state, error: action.message, table: null };

    case 'clear':
      return { ...initialMaskState, keep: state.keep };

    case 'column':
      // Per-key overrides deliberately survive a column change: masking one key
      // in an otherwise-open column is a supported (and useful) combination.
      return {
        ...state,
        columnModes: { ...state.columnModes, [action.column]: action.mode },
      };

    case 'key': {
      const keyModes = { ...state.keyModes };
      if (action.mode === 'column') delete keyModes[action.key];
      else keyModes[action.key] = action.mode;
      return { ...state, keyModes };
    }

    case 'keep':
      return { ...state, keep: action.keep };

    case 'reveal': {
      const id = `${action.row}:${action.column}`;
      const revealed = state.revealed.includes(id)
        ? state.revealed.filter((item) => item !== id)
        : [...state.revealed, id];
      return { ...state, revealed };
    }

    case 'hide-reveals':
      return { ...state, revealed: [] };

    case 'reset':
      if (!state.table) return state;
      return {
        ...state,
        columnModes: { ...defaultSettings(state.table).columnModes },
        keyModes: {},
        keyColumn: state.keyColumn,
        revealed: [],
      };

    case 'toast':
      return { ...state, toast: action.message };
  }
}
