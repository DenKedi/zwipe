export interface Point {
  x: number;
  y: number;
}

export interface FileSystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  x: number;
  y: number;
  parentId?: string;
  extension?: string;
  size?: number;
  createdAt: Date;
  modifiedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  items: FileSystemItem[];
  parentId?: string; // For nested folder support
}

export interface BreadcrumbSegment {
  id: string;
  name: string;
}

export interface DrawingState {
  isDrawing: boolean;
  points: Point[];
  startPoint?: Point;
  endPoint?: Point;
}

export interface SelectionResult {
  selectedItems: FileSystemItem[];
  action: 'move' | 'copy' | 'delete' | 'share' | null;
}

export type ZoneType = 'trash' | 'temp' | 'copy' | 'share' | 'folder-strip';

export interface Zone {
  id: string;
  type: ZoneType;
  label: string;
  color: string;
  icon: string;
}
