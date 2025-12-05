import { FileSystemItem, Folder } from '@/types';

const FILE_TYPES = [
  { name: 'Document', ext: 'pdf' },
  { name: 'Photo', ext: 'jpg' },
  { name: 'Image', ext: 'png' },
  { name: 'Spreadsheet', ext: 'xlsx' },
  { name: 'Presentation', ext: 'pptx' },
  { name: 'Report', ext: 'docx' },
  { name: 'Notes', ext: 'txt' },
  { name: 'Data', ext: 'csv' },
];

const FOLDER_NAMES = [
  { name: 'Work', color: '#3b82f6' },
  { name: 'Personal', color: '#10b981' },
  { name: 'Projects', color: '#f59e0b' },
  { name: 'Archive', color: '#6366f1' },
  { name: 'Photos', color: '#ec4899' },
  { name: 'Documents', color: '#8b5cf6' },
  { name: 'Downloads', color: '#14b8a6' },
  { name: 'Music', color: '#f97316' },
];

/**
 * Generate a random file
 */
export function generateRandomFile(
  parentId?: string,
  x?: number,
  y?: number
): FileSystemItem {
  const fileType = FILE_TYPES[Math.floor(Math.random() * FILE_TYPES.length)];
  const randomId = Math.random().toString(36).substring(2, 9);
  const randomSize = Math.floor(Math.random() * 5000000) + 1024;

  return {
    id: `file-${Date.now()}-${randomId}`,
    name: `${fileType.name}_${randomId.substring(0, 4)}.${fileType.ext}`,
    type: 'file',
    extension: fileType.ext,
    x: x ?? Math.floor(Math.random() * 800) + 50,
    y: y ?? Math.floor(Math.random() * 600) + 50,
    parentId,
    size: randomSize,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

/**
 * Generate multiple random files
 */
export function generateRandomFiles(
  count: number,
  parentId?: string,
  gridLayout: boolean = false
): FileSystemItem[] {
  const files: FileSystemItem[] = [];

  if (gridLayout) {
    // Generate files in a grid layout
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 150;
    const startX = 100;
    const startY = 100;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacing;
      const y = startY + row * spacing;

      files.push(generateRandomFile(parentId, x, y));
    }
  } else {
    // Generate files with random positions
    for (let i = 0; i < count; i++) {
      files.push(generateRandomFile(parentId));
    }
  }

  return files;
}

/**
 * Generate a random folder
 */
export function generateRandomFolder(parentId?: string): Folder {
  const folderData =
    FOLDER_NAMES[Math.floor(Math.random() * FOLDER_NAMES.length)];
  const randomId = Math.random().toString(36).substring(2, 9);

  return {
    id: `folder-${Date.now()}-${randomId}`,
    name: `${folderData.name}_${randomId.substring(0, 4)}`,
    color: folderData.color,
    items: [],
    parentId,
  };
}

/**
 * Generate multiple random folders
 */
export function generateRandomFolders(
  count: number,
  parentId?: string
): Folder[] {
  const folders: Folder[] = [];

  for (let i = 0; i < count; i++) {
    folders.push(generateRandomFolder(parentId));
  }

  return folders;
}

/**
 * Generate a file at a specific position
 */
export function generateFileAt(
  x: number,
  y: number,
  name?: string,
  extension?: string,
  parentId?: string
): FileSystemItem {
  const randomId = Math.random().toString(36).substring(2, 9);
  const ext = extension || 'txt';
  const fileName = name || `file_${randomId.substring(0, 4)}`;

  return {
    id: `file-${Date.now()}-${randomId}`,
    name: fileName.includes('.') ? fileName : `${fileName}.${ext}`,
    type: 'file',
    extension: ext,
    x,
    y,
    parentId,
    size: Math.floor(Math.random() * 5000000) + 1024,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

/**
 * Get a predefined file type configuration
 */
export function getFileTypeConfig(extension: string) {
  const configs: Record<string, { name: string; color: string }> = {
    pdf: { name: 'PDF', color: '#ef4444' },
    jpg: { name: 'Image', color: '#10b981' },
    jpeg: { name: 'Image', color: '#10b981' },
    png: { name: 'Image', color: '#10b981' },
    gif: { name: 'Image', color: '#10b981' },
    txt: { name: 'Text', color: '#94a3b8' },
    doc: { name: 'Word', color: '#3b82f6' },
    docx: { name: 'Word', color: '#3b82f6' },
    xlsx: { name: 'Excel', color: '#10b981' },
    xls: { name: 'Excel', color: '#10b981' },
    pptx: { name: 'PowerPoint', color: '#f97316' },
    csv: { name: 'CSV', color: '#8b5cf6' },
  };

  return configs[extension.toLowerCase()] || { name: 'File', color: '#64748b' };
}
