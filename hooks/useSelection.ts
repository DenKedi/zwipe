import { useState, useCallback } from 'react';
import { Point, FileSystemItem, DrawingState } from '@/types';

export function useSelection() {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    points: [],
  });

  const startDrawing = useCallback((point: Point) => {
    setDrawingState({
      isDrawing: true,
      points: [point],
      startPoint: point,
    });
  }, []);

  const updateDrawing = useCallback((point: Point) => {
    setDrawingState(prev => {
      if (!prev.isDrawing) return prev;
      return {
        ...prev,
        points: [...prev.points, point],
      };
    });
  }, []);

  const endDrawing = useCallback((point: Point) => {
    setDrawingState(prev => ({
      ...prev,
      isDrawing: false,
      endPoint: point,
      points: [...prev.points, point],
    }));
  }, []);

  const clearDrawing = useCallback(() => {
    setDrawingState({
      isDrawing: false,
      points: [],
    });
  }, []);

  // Check if a point is inside a bounding box
  const isPointInBox = useCallback(
    (
      point: Point,
      boxX: number,
      boxY: number,
      boxWidth: number,
      boxHeight: number
    ): boolean => {
      return (
        point.x >= boxX &&
        point.x <= boxX + boxWidth &&
        point.y >= boxY &&
        point.y <= boxY + boxHeight
      );
    },
    []
  );

  // Check if a line intersects with a file item
  const isFileIntersected = useCallback(
    (file: FileSystemItem, points: Point[]): boolean => {
      const fileWidth = 100;
      const fileHeight = 100;

      // Check if any point of the line is inside the file bounds
      return points.some(point =>
        isPointInBox(point, file.x, file.y, fileWidth, fileHeight)
      );
    },
    [isPointInBox]
  );

  // Get all files that intersect with the drawn line
  const getIntersectedFiles = useCallback(
    (files: FileSystemItem[]): FileSystemItem[] => {
      if (drawingState.points.length === 0) return [];

      return files.filter(file => isFileIntersected(file, drawingState.points));
    },
    [drawingState.points, isFileIntersected]
  );

  // Check if the line ends in a specific zone
  const getEndZone = useCallback(
    (
      zones: {
        x: number;
        y: number;
        width: number;
        height: number;
        type: string;
      }[]
    ): string | null => {
      if (!drawingState.endPoint) return null;

      const zone = zones.find(z =>
        isPointInBox(drawingState.endPoint!, z.x, z.y, z.width, z.height)
      );

      return zone?.type || null;
    },
    [drawingState.endPoint, isPointInBox]
  );

  return {
    drawingState,
    startDrawing,
    updateDrawing,
    endDrawing,
    clearDrawing,
    getIntersectedFiles,
    getEndZone,
  };
}
