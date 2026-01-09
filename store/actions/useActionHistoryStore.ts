import { create } from 'zustand';
import { Action } from './types';

interface ActionHistoryState {
  // Stack of actions that can be undone
  undoStack: Action[];

  // Stack of actions that can be redone
  redoStack: Action[];

  // Execute a new action and add to undo stack
  execute: (action: Action) => void;

  // Undo the last action
  undo: () => void;

  // Redo the last undone action
  redo: () => void;

  // Clear all history (without affecting current state)
  clearHistory: () => void;

  // Check if we can undo
  canUndo: boolean;

  // Check if we can redo
  canRedo: boolean;
}

export const useActionHistoryStore = create<ActionHistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  execute: action => {
    // The action is already executed when passed here
    // Just add it to the undo stack and clear redo stack
    set(state => ({
      undoStack: [...state.undoStack, action],
      redoStack: [], // Clear redo stack on new action
      canUndo: true,
      canRedo: false,
    }));
  },

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    action.undo();

    set(state => {
      const newUndoStack = state.undoStack.slice(0, -1);
      return {
        undoStack: newUndoStack,
        redoStack: [...state.redoStack, action],
        canUndo: newUndoStack.length > 0,
        canRedo: true,
      };
    });
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    action.redo();

    set(state => {
      const newRedoStack = state.redoStack.slice(0, -1);
      return {
        undoStack: [...state.undoStack, action],
        redoStack: newRedoStack,
        canUndo: true,
        canRedo: newRedoStack.length > 0,
      };
    });
  },

  clearHistory: () => {
    set({
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    });
  },
}));
