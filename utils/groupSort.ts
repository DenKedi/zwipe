import { FileSystemItem } from '@/types';
import { FILE_WIDTH, FILE_HEIGHT } from './collisionDetection';

export type GroupByOption =
  | 'none'
  | 'type'
  | 'extension'
  | 'year'
  | 'month'
  | 'day';
export type SortByOption = 'none' | 'name' | 'size' | 'date';

interface FileGroup {
  label: string;
  files: FileSystemItem[];
  position: { x: number; y: number };
}

/**
 * Get file type category from extension
 */
function getFileTypeCategory(extension: string | undefined): string {
  if (!extension) return 'No Extension';

  const ext = extension.toLowerCase();

  // Images
  if (
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)
  ) {
    return 'Images';
  }
  // Videos
  if (['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm'].includes(ext)) {
    return 'Videos';
  }
  // Audio
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return 'Audio';
  }
  // Documents
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return 'Documents';
  }
  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return 'Spreadsheets';
  }
  // Presentations
  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return 'Presentations';
  }
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return 'Archives';
  }
  // Code
  if (
    [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'java',
      'cpp',
      'c',
      'h',
      'cs',
      'go',
      'rs',
      'rb',
      'php',
    ].includes(ext)
  ) {
    return 'Code';
  }

  return 'Other';
}

/**
 * Get extension for grouping
 */
function getExtensionGroup(extension: string | undefined): string {
  if (!extension) return 'No Extension';
  return `.${extension.toLowerCase()}`;
}

/**
 * Get date group label
 */
function getDateGroup(date: Date, groupBy: 'year' | 'month' | 'day'): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  switch (groupBy) {
    case 'year':
      return `${year}`;
    case 'month':
      return `${month} ${year}`;
    case 'day':
      return `${day}, ${year}`;
  }
}

/**
 * Sort files by the specified option
 */
function sortFiles(
  files: FileSystemItem[],
  sortBy: SortByOption
): FileSystemItem[] {
  if (sortBy === 'none') return files;

  return [...files].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'size':
        return (b.size || 0) - (a.size || 0); // Largest first
      case 'date':
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ); // Newest first
      default:
        return 0;
    }
  });
}

/**
 * Arrange files in a grid pattern (left to right, top to bottom)
 * Returns new positions for each file
 */
function arrangeFilesInGrid(
  files: FileSystemItem[],
  startX: number,
  startY: number,
  columnsPerRow: number = 5,
  padding: number = 20
): { id: string; x: number; y: number }[] {
  const positions: { id: string; x: number; y: number }[] = [];

  files.forEach((file, index) => {
    const col = index % columnsPerRow;
    const row = Math.floor(index / columnsPerRow);

    positions.push({
      id: file.id,
      x: startX + col * (FILE_WIDTH + padding),
      y: startY + row * (FILE_HEIGHT + padding),
    });
  });

  return positions;
}

/**
 * Group files by type and arrange them in islands
 * Returns new positions for each file and group labels
 */
export function groupAndSortFiles(
  files: FileSystemItem[],
  groupBy: GroupByOption,
  sortBy: SortByOption,
  canvasStartX: number = 100,
  canvasStartY: number = 100
): {
  positions: { id: string; x: number; y: number }[];
  groups: FileGroup[];
} {
  // If no grouping, sort and arrange all files as one group
  if (groupBy === 'none') {
    const sortedFiles = sortFiles(files, sortBy);
    const positions = arrangeFilesInGrid(
      sortedFiles,
      canvasStartX,
      canvasStartY
    );
    return {
      positions,
      groups: [],
    };
  }

  // Group files by the specified option
  const groups = new Map<string, FileSystemItem[]>();

  for (const file of files) {
    let category: string;

    switch (groupBy) {
      case 'type':
        category = getFileTypeCategory(file.extension);
        break;
      case 'extension':
        category = getExtensionGroup(file.extension);
        break;
      case 'year':
        category = getDateGroup(file.createdAt, 'year');
        break;
      case 'month':
        category = getDateGroup(file.createdAt, 'month');
        break;
      case 'day':
        category = getDateGroup(file.createdAt, 'day');
        break;
      default:
        category = 'Other';
    }

    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(file);
  }

  // Sort group names for consistent ordering
  const sortedGroupNames = Array.from(groups.keys()).sort();

  const allPositions: { id: string; x: number; y: number }[] = [];
  const fileGroups: FileGroup[] = [];

  let currentY = canvasStartY;
  const labelHeight = 40; // Space for group label
  const groupPadding = 60; // Padding between groups
  const columnsPerRow = 5;

  for (const groupName of sortedGroupNames) {
    const groupFiles = groups.get(groupName)!;
    const sortedGroupFiles = sortFiles(groupFiles, sortBy);

    // Calculate group dimensions
    const rows = Math.ceil(sortedGroupFiles.length / columnsPerRow);
    const groupHeight = rows * (FILE_HEIGHT + 20) + labelHeight;

    // Position files in this group
    const groupPositions = arrangeFilesInGrid(
      sortedGroupFiles,
      canvasStartX,
      currentY + labelHeight,
      columnsPerRow
    );

    allPositions.push(...groupPositions);

    // Add group info
    fileGroups.push({
      label: groupName,
      files: sortedGroupFiles,
      position: { x: canvasStartX, y: currentY },
    });

    currentY += groupHeight + groupPadding;
  }

  return {
    positions: allPositions,
    groups: fileGroups,
  };
}

/**
 * Get positions for files based on grouping and sorting options
 * This is the main function to call from the UI
 */
export function getOrganizedFilePositions(
  files: FileSystemItem[],
  groupBy: GroupByOption,
  sortBy: SortByOption
): {
  positions: Map<string, { x: number; y: number }>;
  groups: FileGroup[];
} {
  const result = groupAndSortFiles(files, groupBy, sortBy);

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const pos of result.positions) {
    positionMap.set(pos.id, { x: pos.x, y: pos.y });
  }

  return {
    positions: positionMap,
    groups: result.groups,
  };
}
