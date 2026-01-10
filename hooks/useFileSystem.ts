import { useFileSystemStore } from '@/store/useFileSystemStore';
import { FileSystemItem, Folder } from '@/types';
import { useCallback, useEffect } from 'react';

export function useFileSystem() {
  const {
    files,
    folders,
    initialized,
    addFile,
    removeFile,
    removeFiles,
    moveFile,
    moveFiles,
    moveFilesToFolder,
    addFolder,
    removeFolder,
    initialize,
    getFilesInFolder,
    updateFolder,
    getFolderById,
  } = useFileSystemStore();

  // Initialize the store on first use
  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  const createFile = useCallback(
    (name: string, x: number, y: number, parentId?: string) => {
      const newFile: FileSystemItem = {
        id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name,
        type: 'file',
        extension: name.split('.').pop(),
        x,
        y,
        parentId,
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      addFile(newFile);
      return newFile;
    },
    [addFile]
  );

  const deleteFile = useCallback(
    (fileId: string) => {
      removeFile(fileId);
    },
    [removeFile]
  );

  const deleteFiles = useCallback(
    (fileIds: string[]) => {
      removeFiles(fileIds);
    },
    [removeFiles]
  );

  const createFolder = useCallback(
    (name: string, parentId?: string) => {
      const colors = [
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#6366f1',
        '#ec4899',
        '#8b5cf6',
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newFolder: Folder = {
        id: `folder-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`,
        name,
        items: [],
        color: randomColor,
        parentId,
      };
      addFolder(newFolder);
      return newFolder;
    },
    [addFolder]
  );

  const deleteFolder = useCallback(
    (folderId: string) => {
      removeFolder(folderId);
    },
    [removeFolder]
  );

  const getVisibleFiles = useCallback(() => {
    return files.filter(file => !file.parentId);
  }, [files]);

  const moveFolder = useCallback((folderId: string, parentId?: string | null) => {
    // parentId undefined => root
    updateFolder(folderId, { parentId: parentId || undefined });
  }, [updateFolder]);

  return {
    files,
    folders,
    initialized,
    createFile,
    deleteFile,
    deleteFiles,
    moveFile,
    moveFiles,
    moveFilesToFolder,
    createFolder,
    deleteFolder,
    moveFolder,
    getFilesInFolder,
    getFolderById,
    getVisibleFiles,
  };
}
