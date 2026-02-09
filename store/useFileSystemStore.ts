import { FileSystemItem, Folder } from '@/types';
import { create } from 'zustand';
import { Dimensions } from 'react-native';
import { testImages } from '@/assets/testImages';
import {
  assignTestImagesToFiles,
  generateRandomFiles,
  resolveNonOverlappingPosition,
} from '@/utils/fileSystemHelpers';

interface FileSystemState {
  files: FileSystemItem[];
  folders: Folder[];
  initialized: boolean;

  // File actions
  addFile: (file: FileSystemItem) => void;
  addFiles: (files: FileSystemItem[]) => void;
  removeFile: (fileId: string) => void;
  removeFiles: (fileIds: string[]) => void;
  updateFile: (fileId: string, updates: Partial<FileSystemItem>) => void;
  moveFile: (fileId: string, x: number, y: number) => void;
  moveFiles: (fileIds: string[], deltaX: number, deltaY: number) => void;
  moveFilesToFolder: (fileIds: string[], folderId: string | null) => void;

  // Folder actions
  addFolder: (folder: Folder) => void;
  removeFolder: (folderId: string) => void;
  updateFolder: (folderId: string, updates: Partial<Folder>) => void;

  // Utility actions
  clearAll: () => void;
  initialize: () => void;
  getFilesInFolder: (folderId: string | null) => FileSystemItem[];
  getFolderById: (folderId: string) => Folder | undefined;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  files: [],
  folders: [],
  initialized: false,

  // File actions
  addFile: file =>
    set(state => ({
      files: [...state.files, file],
    })),

  addFiles: files =>
    set(state => ({
      files: [...state.files, ...files],
    })),

  removeFile: fileId =>
    set(state => ({
      files: state.files.filter(f => f.id !== fileId),
    })),

  removeFiles: fileIds =>
    set(state => ({
      files: state.files.filter(f => !fileIds.includes(f.id)),
    })),

  updateFile: (fileId, updates) =>
    set(state => ({
      files: state.files.map(f =>
        f.id === fileId ? { ...f, ...updates, modifiedAt: new Date() } : f,
      ),
    })),

  moveFile: (fileId, x, y) =>
    set(state => ({
      files: state.files.map(f =>
        f.id === fileId ? { ...f, x, y, modifiedAt: new Date() } : f,
      ),
    })),

  moveFiles: (fileIds, deltaX, deltaY) =>
    set(state => ({
      files: state.files.map(f =>
        fileIds.includes(f.id)
          ? { ...f, x: f.x + deltaX, y: f.y + deltaY, modifiedAt: new Date() }
          : f,
      ),
    })),

  moveFilesToFolder: (fileIds, folderId) =>
    set(state => ({
      files: state.files.map(f =>
        fileIds.includes(f.id)
          ? { ...f, parentId: folderId || undefined, modifiedAt: new Date() }
          : f,
      ),
    })),

  // Folder actions
  addFolder: folder =>
    set(state => ({
      folders: [...state.folders, folder],
    })),

  removeFolder: folderId =>
    // Reomve folder and its files
    set(state => ({
      folders: state.folders.filter(f => f.id !== folderId),
      files: state.files.filter(f => f.parentId !== folderId),
    })),

  updateFolder: (folderId, updates) =>
    set(state => ({
      folders: state.folders.map(f =>
        f.id === folderId ? { ...f, ...updates } : f,
      ),
    })),

  // Utility actions
  clearAll: () => set({ files: [], folders: [], initialized: false }),

  initialize: () => {
    const state = get();
    if (state.initialized) return;

    // Generate initial dummy data for Root/Home
    const dummyFolders: Folder[] = [
      {
        id: 'folder-pictures',
        name: 'Pictures',
        color: '#fbbf24',
        items: [],
        parentId: undefined,
      },
    ];

    // Generate test files using the same logic as the "+Add Test Files" button
    const newFiles = generateRandomFiles(6, undefined, false, 0.8);
    const augmented = assignTestImagesToFiles(newFiles, testImages, []);

    const siblings: { x: number; y: number }[] = [];
    const dummyFiles: FileSystemItem[] = [];

    // Cluster around screen center
    const { width, height } = Dimensions.get('window');
    // Adjust center slightly up (-50) because of tab bar / headers usually taking bottom/top space
    const centerX = width / 2;
    const centerY = height / 2 - 50;

    // Use a tighter spread so they look like a single starting group
    const spread = Math.min(width, height) * 0.4;

    augmented.forEach(file => {
      // Override random positions from generateRandomFiles to cluster them
      const targetX = centerX + (Math.random() - 0.5) * spread;
      const targetY = centerY + (Math.random() - 0.5) * spread;

      const pos = resolveNonOverlappingPosition(targetX, targetY, siblings);
      siblings.push(pos);

      dummyFiles.push({
        ...file,
        x: pos.x,
        y: pos.y,
      });
    });

    set({
      folders: dummyFolders,
      files: dummyFiles,
      initialized: true,
    });
  },

  getFilesInFolder: folderId => {
    const state = get();
    return state.files.filter(f => f.parentId === (folderId || undefined));
  },

  getFolderById: folderId => {
    const state = get();
    return state.folders.find(f => f.id === folderId);
  },
}));
