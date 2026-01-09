// Base Action interface - all actions must implement this
export interface Action {
  // Unique type identifier for the action
  type: string;
  
  // Human-readable description for debugging/UI
  description: string;
  
  // Undo the action (restore previous state)
  undo: () => void;
  
  // Redo the action (re-apply the action)
  redo: () => void;
}

// Action types enum for type safety
export enum ActionType {
  SELECT_FILES = 'SELECT_FILES',
  DESELECT_FILES = 'DESELECT_FILES',
  MOVE_FILES = 'MOVE_FILES',
  DELETE_FILES = 'DELETE_FILES',
  DUPLICATE_FILES = 'DUPLICATE_FILES',
  CREATE_FOLDER = 'CREATE_FOLDER',
  DELETE_FOLDER = 'DELETE_FOLDER',
}

// Helper type for file move tracking
export interface FileMoveInfo {
  fileId: string;
  previousParentId: string | null;
  newParentId: string | null;
}
