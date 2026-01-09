import { Action, ActionType } from './types';
import { useSelectionStore } from '../useSelectionStore';

// Action for selecting files (adding to selection)
export function createSelectFilesAction(
  addedIds: string[],
  previousSelection: string[]
): Action {
  return {
    type: ActionType.SELECT_FILES,
    description: `Selected ${addedIds.length} file(s)`,
    
    undo: () => {
      // Restore previous selection
      useSelectionStore.getState().setSelectedIds(previousSelection);
    },
    
    redo: () => {
      // Re-apply the selection (previous + added)
      useSelectionStore.getState().setSelectedIds([...previousSelection, ...addedIds]);
    },
  };
}

// Action for deselecting files
export function createDeselectFilesAction(
  removedIds: string[],
  previousSelection: string[]
): Action {
  return {
    type: ActionType.DESELECT_FILES,
    description: `Deselected ${removedIds.length} file(s)`,
    
    undo: () => {
      // Restore previous selection
      useSelectionStore.getState().setSelectedIds(previousSelection);
    },
    
    redo: () => {
      // Remove the IDs again
      const newSelection = previousSelection.filter(id => !removedIds.includes(id));
      useSelectionStore.getState().setSelectedIds(newSelection);
    },
  };
}

// Action for toggling a single file
export function createToggleSelectionAction(
  fileId: string,
  wasSelected: boolean,
  previousSelection: string[]
): Action {
  return {
    type: wasSelected ? ActionType.DESELECT_FILES : ActionType.SELECT_FILES,
    description: wasSelected ? `Deselected file` : `Selected file`,
    
    undo: () => {
      useSelectionStore.getState().setSelectedIds(previousSelection);
    },
    
    redo: () => {
      if (wasSelected) {
        // Was selected, so redo means deselect
        useSelectionStore.getState().setSelectedIds(
          previousSelection.filter(id => id !== fileId)
        );
      } else {
        // Was not selected, so redo means select
        useSelectionStore.getState().setSelectedIds([...previousSelection, fileId]);
      }
    },
  };
}
