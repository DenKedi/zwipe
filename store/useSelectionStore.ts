import { create } from 'zustand';

interface SelectionState {
  // Currently selected file IDs
  selectedIds: string[];

  // Pending selection during drawing (visual only, not committed)
  pendingIds: string[];

  // Set selected IDs directly (used by undo/redo)
  setSelectedIds: (ids: string[]) => void;

  // Add IDs to pending selection (during drawing)
  addToPending: (ids: string[]) => void;

  // Clear pending selection
  clearPending: () => void;

  // Get combined selection for display
  getAllSelected: () => string[];

  // Commit pending to selected and return what was added
  commitPending: () => string[];

  // Clear all selection (no history)
  clearSelection: () => void;

  // Toggle a single file selection
  toggleSelection: (id: string) => { added: boolean; id: string };
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: [],
  pendingIds: [],

  setSelectedIds: ids => set({ selectedIds: ids, pendingIds: [] }),

  addToPending: ids =>
    set(state => {
      // Merge with existing pending, excluding already selected
      const newPending = Array.from(
        new Set([...state.pendingIds, ...ids])
      ).filter(id => !state.selectedIds.includes(id));
      return { pendingIds: newPending };
    }),

  clearPending: () => set({ pendingIds: [] }),

  getAllSelected: () => {
    const state = get();
    return [...state.selectedIds, ...state.pendingIds];
  },

  commitPending: () => {
    const state = get();
    const addedIds = state.pendingIds;
    if (addedIds.length === 0) return [];

    set({
      selectedIds: [...state.selectedIds, ...addedIds],
      pendingIds: [],
    });

    return addedIds;
  },

  clearSelection: () => set({ selectedIds: [], pendingIds: [] }),

  toggleSelection: id => {
    const state = get();
    const isSelected = state.selectedIds.includes(id);

    if (isSelected) {
      set({ selectedIds: state.selectedIds.filter(i => i !== id) });
      return { added: false, id };
    } else {
      set({ selectedIds: [...state.selectedIds, id] });
      return { added: true, id };
    }
  },
}));
