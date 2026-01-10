import { FileSystemItem } from '@/types';
import { SpatialGrid } from './spatialIndex';

// File dimensions (from FileItem.tsx)
export const FILE_WIDTH = 100;
export const FILE_HEIGHT = 100;

// Maximum overlap percentage allowed (20%)
const MAX_OVERLAP_PERCENTAGE = 0.2;

/**
 * Check if a file position would cause too much overlap with existing files
 * Uses spatial grid for fast nearby file lookup and early exit optimization
 * @param x - X position to check
 * @param y - Y position to check
 * @param spatialGrid - Spatial grid containing files for fast proximity queries
 * @param excludeFileIds - File IDs to exclude from collision check (e.g., files being moved)
 * @returns true if position is valid, false if it causes too much overlap
 */
export function isValidPosition(
  x: number,
  y: number,
  spatialGrid: SpatialGrid,
  excludeFileIds: string[] = []
): boolean {
  // Pre-compute bounds for early exit check
  const testRight = x + FILE_WIDTH;
  const testBottom = y + FILE_HEIGHT;

  // Only check files in nearby grid cells (huge performance improvement)
  const nearbyFiles = spatialGrid.getNearbyFiles(
    x + FILE_WIDTH / 2,
    y + FILE_HEIGHT / 2,
    150
  );

  for (const file of nearbyFiles) {
    // Skip excluded files
    if (excludeFileIds.includes(file.id)) {
      continue;
    }

    // Early exit: if bounding boxes don't overlap at all, skip expensive calculation
    const fileRight = file.x + FILE_WIDTH;
    const fileBottom = file.y + FILE_HEIGHT;

    if (
      x >= fileRight ||
      testRight <= file.x ||
      y >= fileBottom ||
      testBottom <= file.y
    ) {
      continue; // No overlap possible
    }

    // Calculate actual overlap percentage only for potentially overlapping files
    const left = Math.max(x, file.x);
    const right = Math.min(testRight, fileRight);
    const top = Math.max(y, file.y);
    const bottom = Math.min(testBottom, fileBottom);

    const overlapArea = (right - left) * (bottom - top);
    const overlapPercentage = overlapArea / (FILE_WIDTH * FILE_HEIGHT);

    if (overlapPercentage > MAX_OVERLAP_PERCENTAGE) {
      return false;
    }
  }

  return true;
}

/**
 * Find the nearest valid position for a file
 * Spirals outward from the desired position to find a valid spot
 * Optimized with spatial grid and 8-direction search per radius
 * @param desiredX - Desired X position
 * @param desiredY - Desired Y position
 * @param spatialGrid - Spatial grid for fast proximity queries
 * @param excludeFileIds - File IDs to exclude from collision check
 * @returns {x, y} coordinates of nearest valid position
 */
export function findNearestValidPosition(
  desiredX: number,
  desiredY: number,
  spatialGrid: SpatialGrid,
  excludeFileIds: string[] = []
): { x: number; y: number } {
  // First check if desired position is already valid
  if (isValidPosition(desiredX, desiredY, spatialGrid, excludeFileIds)) {
    return { x: desiredX, y: desiredY };
  }

  // Optimized spiral search - use 8 directions per radius (N, NE, E, SE, S, SW, W, NW)
  const step = 40; // Larger step for faster search
  const maxRadius = 400; // Reasonable max radius
  const directions = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];

  for (let radius = step; radius <= maxRadius; radius += step) {
    for (const [dx, dy] of directions) {
      const testX = Math.round(desiredX + radius * dx);
      const testY = Math.round(desiredY + radius * dy);

      if (isValidPosition(testX, testY, spatialGrid, excludeFileIds)) {
        return { x: testX, y: testY };
      }
    }
  }

  // Fallback: return desired position
  return { x: desiredX, y: desiredY };
}

/**
 * Adjust positions for multiple files being dropped
 * Ensures no collisions between the dropped files themselves or with existing files
 * Uses spatial grid for performance
 */
export function adjustMultipleFilePositions(
  filesToPosition: { id: string; x: number; y: number }[],
  spatialGrid: SpatialGrid,
  excludeFileIds: string[] = []
): { id: string; x: number; y: number }[] {
  const adjustedFiles: { id: string; x: number; y: number }[] = [];

  for (const file of filesToPosition) {
    // Find valid position using spatial grid
    const validPosition = findNearestValidPosition(
      file.x,
      file.y,
      spatialGrid,
      excludeFileIds
    );

    adjustedFiles.push({
      id: file.id,
      x: validPosition.x,
      y: validPosition.y,
    });
  }

  return adjustedFiles;
}
