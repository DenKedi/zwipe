import { Action, ActionType, FileMoveInfo } from './types';
import { useFileSystemStore } from '../useFileSystemStore';

// Action for moving files to a folder
export function createMoveFilesAction(
  moveInfos: FileMoveInfo[],
  targetFolderId: string | null
): Action {
  return {
    type: ActionType.MOVE_FILES,
    description: `Moved ${moveInfos.length} file(s) to ${targetFolderId ? 'folder' : 'root'}`,
    
    undo: () => {
      // Restore each file to its previous parent
      const fileSystemStore = useFileSystemStore.getState();
      moveInfos.forEach(info => {
        fileSystemStore.moveFilesToFolder([info.fileId], info.previousParentId);
      });
    },
    
    redo: () => {
      // Re-apply the move to target folder
      const fileSystemStore = useFileSystemStore.getState();
      const fileIds = moveInfos.map(info => info.fileId);
      fileSystemStore.moveFilesToFolder(fileIds, targetFolderId);
    },
  };
}

// Action for deleting files (moving to trash)
export function createDeleteFilesAction(
  moveInfos: FileMoveInfo[]
): Action {
  return {
    type: ActionType.DELETE_FILES,
    description: `Deleted ${moveInfos.length} file(s)`,
    
    undo: () => {
      // Restore files from trash to their previous locations
      const fileSystemStore = useFileSystemStore.getState();
      moveInfos.forEach(info => {
        fileSystemStore.moveFilesToFolder([info.fileId], info.previousParentId);
      });
    },
    
    redo: () => {
      // Move files back to trash
      const fileSystemStore = useFileSystemStore.getState();
      const fileIds = moveInfos.map(info => info.fileId);
      fileSystemStore.moveFilesToFolder(fileIds, 'trash');
    },
  };
}
