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
  y?: number,
  name?: string,
  extension?: string
): FileSystemItem {
  const fileType = FILE_TYPES[Math.floor(Math.random() * FILE_TYPES.length)];
  const randomId = Math.random().toString(36).substring(2, 9);
  const randomSize = Math.floor(Math.random() * 5000000) + 1024;

  const ext = extension || fileType.ext;
  const fileName = name || `${fileType.name}_${randomId.substring(0, 4)}.${ext}`;

  // Spawn randomly around a loose origin area to avoid perfect overlap
  const randomX = x ?? Math.floor(Math.random() * 800) + 50;
  const randomY = y ?? Math.floor(Math.random() * 600) + 50;

  return {
    id: `file-${Date.now()}-${randomId}`,
    name: fileName.includes('.') ? fileName : `${fileName}.${ext}`,
    type: 'file',
    extension: ext,
    x: randomX,
    y: randomY,
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
  gridLayout: boolean = false,
  imageProbability: number = 0.2 // chance a generated file will be an image
): FileSystemItem[] {
  const files: FileSystemItem[] = [];
  const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  const makeFileWithExt = (ext: string, x?: number, y?: number) => {
    const randomId = Math.random().toString(36).substring(2, 9);
    const name = `TestImage_${randomId}.${ext}`;
    return generateRandomFile(parentId, x, y, name, ext);
  };

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

      // Respect imageProbability
      if (Math.random() < imageProbability) {
        const ext = IMAGE_EXTS[Math.floor(Math.random() * IMAGE_EXTS.length)];
        files.push(makeFileWithExt(ext, x, y));
      } else {
        files.push(generateRandomFile(parentId, x, y));
      }
    }
  } else {
    // Generate files with random positions around the origin (not fixed grid)
    // This reduces exact overlap when spawning multiple times
    for (let i = 0; i < count; i++) {
      if (Math.random() < imageProbability) {
        const ext = IMAGE_EXTS[Math.floor(Math.random() * IMAGE_EXTS.length)];
        files.push(makeFileWithExt(ext));
      } else {
        files.push(generateRandomFile(parentId));
      }
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

/**
 * Assign random image assets to image files from a provided asset pool.
 * Ensures no duplicate assets are assigned if existingFiles already use some assets.
 */
export function assignTestImagesToFiles(
  files: FileSystemItem[],
  imageAssets: any[],
  existingFiles: FileSystemItem[] = []
): FileSystemItem[] {
  // Build set of already used asset URIs to avoid duplicates
  const usedAssets = new Set<number | string>();
  existingFiles.forEach((f) => {
    if ((f as any).asset) usedAssets.add((f as any).asset);
  });

  // Pool of available assets not yet used
  const available = imageAssets.filter((a) => !usedAssets.has(a));

  // Shuffle available assets
  const shuffled = available.slice().sort(() => Math.random() - 0.5);

  let idx = 0;

  return files.map((f) => {
    const ext = f.extension?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') {
      // If we have shuffled assets left, assign one uniquely
      if (idx < shuffled.length) {
        const asset = shuffled[idx++];
        return { ...f, asset };
      }
      // Otherwise, fallback to random (may duplicate)
      const randomAsset = imageAssets[Math.floor(Math.random() * imageAssets.length)];
      return { ...f, asset: randomAsset };
    }
    return f;
  });
}
