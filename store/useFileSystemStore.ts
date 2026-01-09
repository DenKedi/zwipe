import { FileSystemItem, Folder } from '@/types';
import { create } from 'zustand';

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
        f.id === fileId ? { ...f, ...updates, modifiedAt: new Date() } : f
      ),
    })),

  moveFile: (fileId, x, y) =>
    set(state => ({
      files: state.files.map(f =>
        f.id === fileId ? { ...f, x, y, modifiedAt: new Date() } : f
      ),
    })),

  moveFiles: (fileIds, deltaX, deltaY) =>
    set(state => ({
      files: state.files.map(f =>
        fileIds.includes(f.id)
          ? { ...f, x: f.x + deltaX, y: f.y + deltaY, modifiedAt: new Date() }
          : f
      ),
    })),

  moveFilesToFolder: (fileIds, folderId) =>
    set(state => ({
      files: state.files.map(f =>
        fileIds.includes(f.id)
          ? { ...f, parentId: folderId || undefined, modifiedAt: new Date() }
          : f
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
        f.id === folderId ? { ...f, ...updates } : f
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

    // Helper to generate random position around center with overlap check
    const generateFuzzyPosition = (
      existingFiles: FileSystemItem[],
      centerX: number,
      centerY: number,
      spread: number,
      minDistance: number
    ): { x: number; y: number } => {
      let x, y;
      let attempts = 0;
      const maxAttempts = 50;

      do {
        // Random position around center
        x = centerX + (Math.random() - 0.5) * spread;
        y = centerY + (Math.random() - 0.5) * spread;

        // Check distance to all existing files
        let tooClose = false;
        for (const file of existingFiles) {
          const dx = file.x - x;
          const dy = file.y - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < minDistance) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) return { x, y };
        attempts++;
      } while (attempts < maxAttempts);

      // If we couldn't find a spot, just return the last generated one
      return { x, y };
    };

    const dummyFiles: FileSystemItem[] = [];
    const centerX = 400;
    const centerY = 300;
    const spread = 500; // Spread area width/height
    const minDistance = 80; // Allow some overlap (files are ~100px)

    // Generate 6 random files
    const fileTypes = [
      { name: 'Document.pdf', ext: 'pdf', size: 2048000 },
      { name: 'Photo.jpg', ext: 'jpg', size: 5120000 },
      { name: 'Notes.txt', ext: 'txt', size: 8192 },
      { name: 'Spreadsheet.xlsx', ext: 'xlsx', size: 102400 },
      { name: 'Presentation.pptx', ext: 'pptx', size: 3145728 },
      { name: 'Report.docx', ext: 'docx', size: 512000 },
    ];

    fileTypes.forEach((type, index) => {
      const pos = generateFuzzyPosition(
        dummyFiles,
        centerX,
        centerY,
        spread,
        minDistance
      );

      dummyFiles.push({
        id: `file-${index + 1}`,
        name: type.name,
        type: 'file',
        extension: type.ext,
        x: pos.x,
        y: pos.y,
        parentId: undefined,
        size: type.size,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });
    });

    // Create two files with exactly minDistance to demonstrate overlap limit
    // File A
    const fileA: FileSystemItem = {
      id: 'file-overlap-1',
      name: 'Overlap_A.png',
      type: 'file',
      extension: 'png',
      x: centerX,
      y: centerY + 200,
      parentId: undefined,
      size: 4096000,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    dummyFiles.push(fileA);

    // File B - placed exactly minDistance away on X axis
    const fileB: FileSystemItem = {
      id: 'file-overlap-2',
      name: 'Overlap_B.csv',
      type: 'file',
      extension: 'csv',
      x: centerX + minDistance, // Exactly minDistance away
      y: centerY + 200,
      parentId: undefined,
      size: 256000,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    dummyFiles.push(fileB);

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
