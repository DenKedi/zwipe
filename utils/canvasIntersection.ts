import { zones } from '@/components/ZoneBar';
import { FileSystemItem, Folder, ZoneType } from '@/types';

// File dimensions
export const FILE_WIDTH = 100;
export const FILE_HEIGHT = 100;

/**
 * Calculate which files intersect with the current drawing point.
 * Converts screen coordinates to canvas coordinates accounting for scale/translate.
 */
export function calculateIntersectedIds(
  x: number,
  y: number,
  visibleFiles: FileSystemItem[],
  currentScale: number,
  transX: number,
  transY: number,
  offX: number,
  offY: number,
  canvasW: number,
  canvasH: number
): string[] {
  'worklet';
  // Gesture event x/y are relative to the GestureDetector root.
  // Canvas is offset within that root by (offX, offY). Convert to CANVAS-local coords first.
  const localX = x - offX;
  const localY = y - offY;

  // React Native scales around the view center by default.
  // With scale around center c and translation t:
  // screenLocal = canvasLocal * s + c * (1 - s) + t
  // => canvasLocal = (screenLocal - t - c * (1 - s)) / s
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  const canvasX = (localX - transX - (1 - currentScale) * cx) / currentScale;
  const canvasY = (localY - transY - (1 - currentScale) * cy) / currentScale;

  const selectionArea = {
    minX: canvasX - 5,
    minY: canvasY - 5,
    maxX: canvasX + 5,
    maxY: canvasY + 5,
  };

  const intersectedIds: string[] = [];

  // Make hitboxes 5% larger than the visual file size (symmetric padding)
  const hitboxPadX = (FILE_WIDTH * 0.05) / 2;
  const hitboxPadY = (FILE_HEIGHT * 0.05) / 2;

  for (const file of visibleFiles) {
    if (
      selectionArea.maxX > file.x - hitboxPadX &&
      selectionArea.minX < file.x + FILE_WIDTH + hitboxPadX &&
      selectionArea.maxY > file.y - hitboxPadY &&
      selectionArea.minY < file.y + FILE_HEIGHT + hitboxPadY
    ) {
      intersectedIds.push(file.id);
    }
  }
  return intersectedIds;
}

/**
 * Check if a point intersects with a folder in the FolderStrip.
 */
export function checkFolderIntersection(
  x: number,
  y: number,
  foldersList: Folder[],
  folderStripX: number,
  folderStripY: number,
  folderStripScrollX: number
): string | null {
  'worklet';
  const CARD_WIDTH = 120;
  const GAP = 12;
  const PADDING_LEFT = 16;
  const HEADER_HEIGHT = 47;
  const CARD_HEIGHT = 76;

  const stripY = folderStripY;
  const minY = stripY + HEADER_HEIGHT;
  const maxY = minY + CARD_HEIGHT;

  if (y < minY || y > maxY) {
    return null;
  }

  const xInStrip = x - (PADDING_LEFT + folderStripX) + folderStripScrollX;
  const itemStride = CARD_WIDTH + GAP;

  const index = Math.floor(xInStrip / itemStride);

  if (index >= 0 && index < foldersList.length) {
    const itemStart = index * itemStride;
    if (xInStrip >= itemStart && xInStrip <= itemStart + CARD_WIDTH) {
      return foldersList[index].id;
    }
  }

  return null;
}

/**
 * Check if a point intersects with a zone in the ZoneBar.
 */
export function checkZoneIntersection(
  x: number,
  y: number,
  zoneBarY: number,
  zoneBarHeight: number,
  zoneBarWidth: number
): ZoneType | null {
  'worklet';
  if (y < zoneBarY || y > zoneBarY + zoneBarHeight) {
    return null;
  }

  const PADDING_HORIZONTAL = 32;
  const effectiveWidth = zoneBarWidth - PADDING_HORIZONTAL * 2;
  const zoneWidth = effectiveWidth / zones.length;

  const xInZoneBar = x - PADDING_HORIZONTAL;
  const zoneIndex = Math.floor(xInZoneBar / zoneWidth);

  if (zoneIndex >= 0 && zoneIndex < zones.length) {
    return zones[zoneIndex].type;
  }

  return null;
}

/**
 * Build a smooth SVG path from point arrays using quadratic bezier curves.
 */
export function buildSmoothPath(pointsX: number[], pointsY: number[]): string {
  'worklet';
  if (pointsX.length === 0) return '';
  if (pointsX.length === 1) {
    return `M ${pointsX[0]} ${pointsY[0]}`;
  }

  let pathStr = `M ${pointsX[0]} ${pointsY[0]}`;
  for (let i = 1; i < pointsX.length - 1; i++) {
    const xc = (pointsX[i] + pointsX[i + 1]) / 2;
    const yc = (pointsY[i] + pointsY[i + 1]) / 2;
    pathStr += ` Q ${pointsX[i]} ${pointsY[i]} ${xc} ${yc}`;
  }

  if (pointsX.length > 1) {
    const lastIdx = pointsX.length - 1;
    const prevIdx = pointsX.length - 2;
    pathStr += ` Q ${pointsX[prevIdx]} ${pointsY[prevIdx]} ${pointsX[lastIdx]} ${pointsY[lastIdx]}`;
  }

  return pathStr;
}
