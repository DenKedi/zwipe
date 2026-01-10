import { useFileSystemStore } from '../useFileSystemStore';
import { Action, ActionType } from './types';

export function createMoveFolderAction(
  folderId: string,
  previousParentId: string | null | undefined,
  newParentId: string | null | undefined
): Action {
  return {
    type: ActionType.MOVE_FOLDER,
    description: `Moved folder ${folderId} to ${newParentId || 'root'}`,

    undo: () => {
      const fileSystemStore = useFileSystemStore.getState();
      fileSystemStore.updateFolder(folderId, { parentId: previousParentId });
    },

    redo: () => {
      const fileSystemStore = useFileSystemStore.getState();
      fileSystemStore.updateFolder(folderId, { parentId: newParentId });
    },
  };
}
