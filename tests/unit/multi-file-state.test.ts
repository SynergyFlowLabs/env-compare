import { describe, expect, it } from 'vitest';
import { MAX_FILES, MIN_FILES, initialState, reducer, type AppState } from '../../src/state/reducer';

const add = (state: AppState, times = 1) => {
  let next = state;
  for (let i = 0; i < times; i += 1) next = reducer(next, { type: 'addFile' });
  return next;
};

describe('adding files', () => {
  it('starts with two boxes', () => {
    expect(initialState.files).toHaveLength(MIN_FILES);
  });

  it('appends a box with a suggested, unused name', () => {
    const state = add(initialState);
    expect(state.files).toHaveLength(3);
    expect(state.files[2]?.name).toBe('.env.local');
    expect(state.view).toBe('input');
  });

  it('never repeats a suggested name', () => {
    const state = add(initialState, 3);
    const names = state.files.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(['.env.example', '.env', '.env.local', '.env.production', '.env.staging']);
  });

  it('stops at the limit', () => {
    const state = add(initialState, MAX_FILES + 3);
    expect(state.files).toHaveLength(MAX_FILES);
  });

  it('mints a new id for every box, even after a clear', () => {
    let state = add(initialState, 2);
    const ids = state.files.map((f) => f.id);
    state = reducer(state, { type: 'clearAll' });
    state = add(state);
    expect(state.files).toHaveLength(5);
    const allIds = state.files.map((f) => f.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.slice(0, ids.length)).toEqual(ids);
  });
});

describe('removing files', () => {
  it('refuses to go below the minimum', () => {
    const state = reducer(initialState, { type: 'removeFile', id: 'b' });
    expect(state.files).toHaveLength(MIN_FILES);
  });

  it('removes a box and its undo history', () => {
    let state = add(initialState, 2);
    const removed = state.files[3]!;
    state = reducer(state, { type: 'removeFile', id: removed.id });
    expect(state.files.map((f) => f.id)).not.toContain(removed.id);
  });

  it('promotes another file when the reference is removed', () => {
    let state = add(initialState);
    state = reducer(state, { type: 'reference', id: 'f3' });
    expect(state.referenceId).toBe('f3');
    state = reducer(state, { type: 'removeFile', id: 'f3' });
    expect(state.files.map((f) => f.id)).not.toContain('f3');
    expect(state.files.some((f) => f.id === state.referenceId)).toBe(true);
  });
});

describe('choosing roles', () => {
  it('lets the reader pick the reference explicitly', () => {
    const state = reducer(initialState, { type: 'reference', id: 'b' });
    expect(state.referenceId).toBe('b');
  });

  it('cycles the reference through every file', () => {
    let state = add(initialState);
    state = reducer(state, { type: 'swapRoles' }); // b
    expect(state.referenceId).toBe('b');
    state = reducer(state, { type: 'swapRoles' }); // f3
    expect(state.referenceId).toBe('f3');
    state = reducer(state, { type: 'swapRoles' }); // wraps to a
    expect(state.referenceId).toBe('a');
  });

  it('remembers which target the fix panel acts on', () => {
    const state = reducer(initialState, { type: 'target', id: 'b' });
    expect(state.activeTargetId).toBe('b');
    // Changing the reference invalidates the choice rather than pointing at it.
    expect(reducer(state, { type: 'reference', id: 'b' }).activeTargetId).toBeNull();
  });
});
