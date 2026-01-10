import { DrawingLayer } from '@/components/DrawingLayer';
import { FileCanvas } from '@/components/FileCanvas';
import { FolderStrip } from '@/components/FolderStrip';
import { ThemedView } from '@/components/themed-view';
import { ZoneBar, zones } from '@/components/ZoneBar';
import { useFileSystem } from '@/hooks/useFileSystem';
import { createDeleteFilesAction, createMoveFilesAction, createMoveFolderAction, createSelectFilesAction, createToggleSelectionAction, FileMoveInfo, useActionHistoryStore } from '@/store/actions';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { BreadcrumbSegment, FileSystemItem, ZoneType } from '@/types';
import { generateRandomFiles } from '@/utils/fileSystemHelpers';
import { Eraser, Redo2, Undo2 } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export default function HomeScreen() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { files, folders, createFolder, createFile, moveFilesToFolder, deleteFolder, moveFolder, getFolderById } = useFileSystem();
  
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([
    { id: 'home', name: 'Home' }
  ]);

  // Action History for undo/redo
  const { execute, undo, redo, canUndo, canRedo } = useActionHistoryStore();
  
  // Selection State (simple store, no history logic here)
  const { 
    selectedIds,
    pendingIds,
    addToPending,
    commitPending,
    clearSelection,
    setSelectedIds,
  } = useSelectionStore();
  
  // Combined selection for display (committed + pending during draw)
  const selectedFileIds = useMemo(() => 
    [...selectedIds, ...pendingIds],
    [selectedIds, pendingIds]
  );
  
  // Folder creation modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Share Modal state
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sentStatus, setSentStatus] = useState(false);

  // Toast state for user notifications
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  }, []);

  const showShareModal = useCallback((isFolderShare = false) => {
    // If this is a drawing-based share and there are no selected files, warn the user
    if (!isFolderShare && selectedFileIds.length === 0) {
      showToast('Please select at least one file to share');
      return;
    }
    setShareModalVisible(true);
  }, [selectedFileIds, showToast]);

  const closeShareModal = useCallback(() => setShareModalVisible(false), []);

  const handleSend = useCallback((method: string) => {
    // method param reserved for analytics/future branching
    setSentStatus(true);
    setTimeout(() => {
      setSentStatus(false);
      setShareModalVisible(false);
      clearSelection();
    }, 1500);
  }, [clearSelection]);
  
  // Canvas State
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Drawing State
  const path = useSharedValue('');
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const currentX = useSharedValue(0);
  const currentY = useSharedValue(0);
  const isDrawing = useSharedValue(false);
  const pointsX = useSharedValue<number[]>([]);
  const pointsY = useSharedValue<number[]>([]);

  // Shared Value to hold live selection from UI thread
  const activeSelection = useSharedValue<string[]>([]);
  const canvasLayout = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const folderStripX = useSharedValue(0);
  const folderStripY = useSharedValue(0);
  const folderStripHeight = useSharedValue(0);
  const dropTargetFolderId = useSharedValue<string | null>(null);
  // FolderStrip scrollX shared value for accurate hit-testing (pixels)
  const folderStripScrollX = useSharedValue(0);
  // Screen width tracked as shared value so worklets can detect edge proximity
  const screenWidth = useSharedValue(0);
  // Autoscroll direction shared value: -1 left, 0 stop, 1 right
  const autoScrollDir = useSharedValue(0);

  // Folder State
  const draggingFolderId = useSharedValue<string | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const ghostStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      width: 40,
      height: 40,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 15,
      borderWidth: 2,
      borderColor: 'white',
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'none',
      zIndex: 1000,
      transform: [
        { translateX: dragX.value - 40 },
        { translateY: dragY.value - 40 },
        { scale: draggingFolderId.value ? 1.1 : 0 }
      ],
      opacity: draggingFolderId.value ? 1 : 0,
    };
  });

  // Zone Colors - matching ZoneBar component
  const zoneColors: Record<ZoneType, string> = {
    trash: '#ef4444',    // Red
    temp: '#8b5cf6',      // Purple
    copy: '#10b981', // Green
    share: '#3b82f6',     // Blue
    'folder-strip': '#f59e0b', // Amber
  };

  // Default gradient colors
  const defaultGradient = {
    start: '#576ffb',
    end: '#f865c4',
  };

  // Gradient colors as React State (for DrawingLayer re-render)
  const [gradientStartColor, setGradientStartColor] = useState(defaultGradient.start);
  const [gradientEndColor, setGradientEndColor] = useState(defaultGradient.end);
  
  // Hovered zone tracking
  const hoveredZoneType = useSharedValue<ZoneType | null>(null);
  const zoneBarLayout = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  
  // Ref kept for potential future measurements/debug
  const canvasSectionRef = useRef<View>(null);

  // --- JS thread helpers
  const handleSelectionUpdate = (newIds: string[]) => {
    // Update pending selection during drawing (no history yet)
    addToPending(newIds);
  };
  
  const handleCommitSelection = () => {
    // Get current state before committing
    const previousSelection = [...selectedIds];
    const addedIds = commitPending();
    
    // Only create action if something was actually added
    if (addedIds.length > 0) {
      const action = createSelectFilesAction(addedIds, previousSelection);
      execute(action);
    }
  };

  const handleGradientUpdate = (startColor: string, endColor: string) => {
    setGradientStartColor(startColor);
    setGradientEndColor(endColor);
  };

  const handleResetGradient = () => {
    setGradientStartColor(defaultGradient.start);
    setGradientEndColor(defaultGradient.end);
  };

  // FolderStrip imperative ref and helpers for autoscroll (used via runOnJS from worklets)
  const folderStripRef = useRef<any>(null);
  const startFolderStripAutoScroll = useCallback((dir: number) => {
    folderStripRef.current?.startAutoScroll?.(dir);
  }, []);
  const stopFolderStripAutoScroll = useCallback(() => {
    folderStripRef.current?.stopAutoScroll?.();
  }, []);

  // -----------------------------------------------------

  // Syncs UI-Thread selection with React State only when changed
  useAnimatedReaction(
    () => activeSelection.value,
    (current, previous) => {
      // Basic check to avoid redundant JS calls
      if (JSON.stringify(current) !== JSON.stringify(previous)) {
        // FIX: Pass raw data to named JS function instead of inline function
        runOnJS(handleSelectionUpdate)(current);
      }
    }
  );
  
  // File Size
  const FILE_WIDTH = 100;
  const FILE_HEIGHT = 100;

  // Memoize visible files and folders to prevent unnecessary re-renders
  const visibleFiles = useMemo(() => 
    files.filter(file => 
      currentFolderId ? file.parentId === currentFolderId : !file.parentId
    ), [files, currentFolderId]);
  
  const currentFolders = useMemo(() => 
    folders.filter(folder => 
      currentFolderId ? folder.parentId === currentFolderId : !folder.parentId
    ), [folders, currentFolderId]);

  // Navigation Handlers - memoized to prevent child re-renders
  const handleFolderPress = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setCurrentFolderId(folderId);
      setBreadcrumbs(prev => [...prev, { id: folderId, name: folder.name }]);

      // Reset FolderStrip scroll to the left when navigating into a folder
      if (folderStripRef.current?.scrollToStart) {
        folderStripRef.current.scrollToStart();
      }
    }
  }, [folders]);

  const handleBreadcrumbPress = useCallback((folderId: string) => {
    const index = breadcrumbs.findIndex(b => b.id === folderId);
    if (index !== -1) {
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      setCurrentFolderId(folderId === 'home' ? null : folderId);
    }
  }, [breadcrumbs]);

  const handleNewFolder = useCallback(() => {
    setShowNewFolderModal(true);
  }, []);

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      const newFolder = createFolder(newFolderName.trim(), currentFolderId || undefined);
      console.log('Folder created:', newFolder);
      setNewFolderName('');
      setShowNewFolderModal(false);
    } else {
      console.log('No folder name provided');
    }
  }, [newFolderName, currentFolderId, createFolder]);

  const handleCancelNewFolder = useCallback(() => {
    setNewFolderName('');
    setShowNewFolderModal(false);
  }, []);

  // Add test files handler
  const handleAddTestFiles = useCallback(() => {
    const newFiles = generateRandomFiles(5, currentFolderId || undefined, true);
    newFiles.forEach(file => {
      createFile(file.name, file.x, file.y, file.parentId);
    });
  }, [currentFolderId, createFile]);

  // Toggle file selection
  const handleFileSelect = useCallback((fileId: string) => {
    const previousSelection = [...selectedIds];
    const isCurrentlySelected = selectedIds.includes(fileId);
    
    if (isCurrentlySelected) {
      // Deselect
      setSelectedIds(selectedIds.filter(id => id !== fileId));
    } else {
      // Select
      setSelectedIds([...selectedIds, fileId]);
    }
    
    // Create action for undo/redo
    const action = createToggleSelectionAction(fileId, isCurrentlySelected, previousSelection);
    execute(action);
  }, [selectedIds, setSelectedIds, execute]);
  
  const handleDropAction = useCallback((targetId: string) => {
    const filesToMove = files.filter(f => selectedFileIds.includes(f.id));
    console.log(`Moving ${filesToMove.length} files to folder ${targetId}`, filesToMove);
    
    // Track previous parent IDs for undo
    const moveInfos: FileMoveInfo[] = filesToMove.map(file => ({
      fileId: file.id,
      previousParentId: file.parentId || null,
      newParentId: targetId,
    }));
    
    // Execute the move
    moveFilesToFolder(selectedFileIds, targetId);
    
    // Create action for undo/redo
    const action = createMoveFilesAction(moveInfos, targetId);
    execute(action);
    
    // Clear selection after move
    clearSelection();
  }, [files, selectedFileIds, moveFilesToFolder, clearSelection, execute]);

  // handle deleting selected files
  const handleDeleteAction = useCallback(() => {
    let filencount = selectedFileIds.length;

    if (filencount > 0) {
      // Track files and their previous locations for undo
      const filesToDelete = files.filter(f => selectedFileIds.includes(f.id));
      const moveInfos: FileMoveInfo[] = filesToDelete.map(file => ({
        fileId: file.id,
        previousParentId: file.parentId || null,
        newParentId: 'trash',
      }));
      
      // Execute the delete (move to trash)
      moveFilesToFolder(selectedFileIds, 'trash');
      console.log("deleted " + filencount + " files")
      
      // Create action for undo/redo
      const action = createDeleteFilesAction(moveInfos);
      execute(action);
      
      // Clear selection after delete
      clearSelection();
    }
  }, [selectedFileIds, files, moveFilesToFolder, clearSelection, execute]);

  // handle delete folder
  const handleDeleteFolder = useCallback((folderId: string) => {
    Alert.alert(
      "Delete Folder",
      "Do you really want to delete this folder and everything inside?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => {
            console.log("Deleted folder: " + folderId);
              deleteFolder(folderId);
          } 
        }
      ]
    );
  }, [deleteFolder]);

  // Move folder (drag into another folder) with protections against cycles
  const handleMoveFolder = useCallback((folderId: string, targetId: string) => {
    if (folderId === targetId) {
      showToast('Cannot move a folder into itself');
      return;
    }

    // Check if target is a descendant of folderId (prevent circular move)
    let p = getFolderById(targetId);
    while (p) {
      if (p.id === folderId) {
        showToast('Cannot move a folder into one of its sub-folders');
        return;
      }
      if (!p.parentId) break;
      p = getFolderById(p.parentId);
    }

    // Valid move - capture previous parent for undo
    const previousParent = getFolderById(folderId)?.parentId || null;
    moveFolder(folderId, targetId);

    // Create action for undo/redo
    const action = createMoveFolderAction(folderId, previousParent, targetId);
    execute(action);

    showToast('Folder moved');
  }, [getFolderById, moveFolder, showToast]);

  // Move Folder via longpress
  const handleFolderLongPress = useCallback((id: string) => {
    draggingFolderId.value = id;
    isDrawing.value = false;

    // Try to initialize ghost position from registered layout (center of folder card)
    try {
      const items = useLayoutStore.getState().getItems();
      const folderLayout = items.find(it => it.id === id && it.type === 'folder');
      if (folderLayout) {
        dragX.value = folderLayout.layout.x + folderLayout.layout.width / 2;
        dragY.value = folderLayout.layout.y + folderLayout.layout.height / 2;
      }
      dropTargetFolderId.value = null;
    } catch (e) {
      // ignore
    }
  }, []);

  // Gestures
  const pinchStartValues = useRef({
    scale: 1,
    translateX: 0,
    translateY: 0,
    focalX: 0,
    focalY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onStart((e) => {
      // Work in CANVAS-local coordinates (gesture events are local to the GestureDetector view)
      const cx = canvasLayout.value.width / 2;
      const cy = canvasLayout.value.height / 2;

      const focalX = e.focalX - canvasLayout.value.x;
      const focalY = e.focalY - canvasLayout.value.y;

      const startOffsetX = cx * (1 - savedScale.value) + savedTranslateX.value;
      const startOffsetY = cy * (1 - savedScale.value) + savedTranslateY.value;

      pinchStartValues.current = {
        scale: savedScale.value,
        translateX: savedTranslateX.value,
        translateY: savedTranslateY.value,
        focalX,
        focalY,
        offsetX: startOffsetX,
        offsetY: startOffsetY,
      };
    })
    .onUpdate((e) => {
      const cx = canvasLayout.value.width / 2;
      const cy = canvasLayout.value.height / 2;

      const focalX = e.focalX - canvasLayout.value.x;
      const focalY = e.focalY - canvasLayout.value.y;
      let newScale = pinchStartValues.current.scale * e.scale;
      
      // Limit zoom: min 0.3x, max 3x
      newScale = Math.max(0.3, Math.min(3, newScale));
      
      scale.value = newScale;

      const newOffsetX = focalX - (pinchStartValues.current.focalX - pinchStartValues.current.offsetX) * e.scale;
      const newOffsetY = focalY - (pinchStartValues.current.focalY - pinchStartValues.current.offsetY) * e.scale;

      translateX.value = newOffsetX - cx * (1 - newScale);
      translateY.value = newOffsetY - cy * (1 - newScale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

// Intersection Helper for files
  const calculateIntersectedIds = (
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
  ): string[] => {
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
  };

// Intersection Helper for folder
  const checkFolderIntersection = (x: number, y: number, foldersList: typeof currentFolders): string | null => {
    'worklet';
    const CARD_WIDTH = 120;  // Actual card width from FolderStrip styles
    const GAP = 12;          // marginRight from folderCard style
    const PADDING_LEFT = 16; // folderScroll paddingHorizontal
    const HEADER_HEIGHT = 47; // folderHeader2 height (approx)
    const CARD_HEIGHT = 76;   // Actual card height from FolderStrip styles

    // folderStripY gives us the Y position of the FolderStrip container
    const stripY = folderStripY.value;
    
    // Cards start after the header (with New button)
    const minY = stripY + HEADER_HEIGHT;
    const maxY = minY + CARD_HEIGHT;

    // Check if Y is within folder strip bounds
    if (y < minY || y > maxY) {
      return null;
    }

    // Calculate X position relative to scroll content
    // Account for current scroll offset reported by FolderStrip and the strip's X on screen
    const xInStrip = x - (PADDING_LEFT + folderStripX.value) + folderStripScrollX.value;
    const itemStride = CARD_WIDTH + GAP;
    
    const index = Math.floor(xInStrip / itemStride);

    if (index >= 0 && index < foldersList.length) {
      const itemStart = index * itemStride;
      if (xInStrip >= itemStart && xInStrip <= itemStart + CARD_WIDTH) {
        return foldersList[index].id;
      }
    }

    return null;
  };

  // Intersection Helper for zones
  const checkZoneIntersection = (x: number, y: number): ZoneType | null => {
    'worklet';
    const zoneBarY = zoneBarLayout.value.y;
    const zoneBarHeight = zoneBarLayout.value.height;
    const zoneBarWidth = zoneBarLayout.value.width;
    
    // Check if Y is within zone bar bounds
    if (y < zoneBarY || y > zoneBarY + zoneBarHeight) {
      return null;
    }
    
    // Calculate which zone we're over based on X position
    // Zones are evenly distributed with padding
    const PADDING_HORIZONTAL = 32;
    const effectiveWidth = zoneBarWidth - (PADDING_HORIZONTAL * 2);
    const zoneWidth = effectiveWidth / zones.length;
    
    const xInZoneBar = x - PADDING_HORIZONTAL;
    const zoneIndex = Math.floor(xInZoneBar / zoneWidth);
    
    if (zoneIndex >= 0 && zoneIndex < zones.length) {
      return zones[zoneIndex].type;
    }
    
    return null;
  };

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart((e) => {
      'worklet';
      // If touch starts inside the FolderStrip, let the ScrollView / touchables handle it
      if (e.y >= folderStripY.value && e.y <= (folderStripY.value + folderStripHeight.value)) {
        isDrawing.value = false;
        // do not initialize drawing state so ScrollView can handle horizontal scrolls and taps
        return;
      }

      dragX.value = e.x;
      dragY.value = e.y;
      // long press check
      if (draggingFolderId.value) {
        isDrawing.value = false;
        dragX.value = e.x;
        dragY.value = e.y;
      } else {
        isDrawing.value = true;
        // Don't reset selection - multiple draws will add to selection
        runOnJS(handleResetGradient)();
        activeSelection.value = []; 
        pointsX.value = [e.x];
        pointsY.value = [e.y];
        startX.value = e.x;
        startY.value = e.y;
        currentX.value = e.x;
        currentY.value = e.y;
        path.value = `M ${e.x} ${e.y}`;
      }
      hoveredZoneType.value = null;
    })
    .onUpdate((e) => {
      'worklet';

      if (isDrawing.value) {
        currentX.value = e.x;
        currentY.value = e.y;

        //Debug log
        //console.log("X: ", Math.floor(currentX.value), " Y: ", Math.floor(currentY.value));

        // Calculate intersections and udate SharedValue 
        const ids = calculateIntersectedIds(
          e.x,
          e.y,
          visibleFiles,
          scale.value,
          translateX.value,
          translateY.value,
          canvasLayout.value.x,
          canvasLayout.value.y,
          canvasLayout.value.width,
          canvasLayout.value.height
        );
        activeSelection.value = ids;

        // Add new point        
        const newPointsX = [...pointsX.value, e.x];
        const newPointsY = [...pointsY.value, e.y];
        pointsX.value = newPointsX;
        pointsY.value = newPointsY;
        
        // Generate smooth path        
        if (newPointsX.length === 1) {
          path.value = `M ${newPointsX[0]} ${newPointsY[0]}`;
        } else {
          let pathStr = `M ${newPointsX[0]} ${newPointsY[0]}`;
          for (let i = 1; i < newPointsX.length - 1; i++) {
            const xc = (newPointsX[i] + newPointsX[i + 1]) / 2;
            const yc = (newPointsY[i] + newPointsY[i + 1]) / 2;
            pathStr += ` Q ${newPointsX[i]} ${newPointsY[i]} ${xc} ${yc}`;
          }

          // Last point
          if (newPointsX.length > 1) {
            const lastIdx = newPointsX.length - 1;
            const prevIdx = newPointsX.length - 2;
            pathStr += ` Q ${newPointsX[prevIdx]} ${newPointsY[prevIdx]} ${newPointsX[lastIdx]} ${newPointsY[lastIdx]}`;
          }
          path.value = pathStr;
        }

        // Check folder intersection
        const folderId = checkFolderIntersection(e.x, e.y, currentFolders);
        if (folderId) {
          dropTargetFolderId.value = folderId;
          hoveredZoneType.value = null;
          runOnJS(handleResetGradient)();
        } else {
          dropTargetFolderId.value = null;

          // Check zone intersection
          const zoneType = checkZoneIntersection(e.x, e.y);
          if (zoneType && zoneType !== hoveredZoneType.value) {
            hoveredZoneType.value = zoneType;
            // Update gradient colors based on zone
            runOnJS(handleGradientUpdate)(zoneColors[zoneType], '#ffffff');
          } else if (!zoneType && hoveredZoneType.value !== null) {
            const previousZone = hoveredZoneType.value;
            hoveredZoneType.value = null;
            // Don't reset gradient if leaving duplicate/copy zone
            if (previousZone !== 'copy') {
              runOnJS(handleResetGradient)();
            }
          }
        }
      } 
      // folder drag
      else if (draggingFolderId.value) {
        dragX.value = e.x;
        dragY.value = e.y;

        // Check if hovering over a folder in the strip
        const folderId = checkFolderIntersection(e.x, e.y, currentFolders);
        if (folderId) {
          dropTargetFolderId.value = folderId;
          hoveredZoneType.value = null;
        } else {
          dropTargetFolderId.value = null;
          hoveredZoneType.value = checkZoneIntersection(e.x, e.y);
        }

        // Autoscroll detection for FolderStrip (worklet-safe)
        const EDGE_ZONE = 60; // px from screen edges
        // Only consider autoscroll when finger is within the FolderStrip vertical bounds
        if (e.y >= folderStripY.value && e.y <= (folderStripY.value + folderStripHeight.value)) {
          // Left edge
          if (e.x <= EDGE_ZONE) {
            if (autoScrollDir.value !== -1) {
              autoScrollDir.value = -1;
              runOnJS(startFolderStripAutoScroll)(-1);
            }
          }
          // Right edge
          else if (e.x >= (screenWidth.value - EDGE_ZONE)) {
            if (autoScrollDir.value !== 1) {
              autoScrollDir.value = 1;
              runOnJS(startFolderStripAutoScroll)(1);
            }
          } else {
            if (autoScrollDir.value !== 0) {
              autoScrollDir.value = 0;
              runOnJS(stopFolderStripAutoScroll)();
            }
          }
        } else {
          // Not hovering folder strip - ensure autoscroll stopped
          if (autoScrollDir.value !== 0) {
            autoScrollDir.value = 0;
            runOnJS(stopFolderStripAutoScroll)();
          }
        }
      }
    })
    .onEnd(() => {
      'worklet';
      
      const currentZone = hoveredZoneType.value;
      const folderIdToTrash = draggingFolderId.value;
      const targetFolderId = dropTargetFolderId.value;

      // delete / drop folder
      if (folderIdToTrash) {
        if (currentZone === 'trash') {
          runOnJS(handleDeleteFolder)(folderIdToTrash);
        } else if (targetFolderId) {
          // Attempt to drop folder into another folder
          runOnJS(handleMoveFolder)(folderIdToTrash, targetFolderId);
        } else if (currentZone === 'share') {
          // Dragging a folder into Share zone
          runOnJS(showShareModal)(true);
        }
      } 
      else if (isDrawing.value) {
        // Check if we're performing an action that will clear selection
        const willPerformAction = currentZone === 'trash' || targetFolderId !== null;
        
        // Only commit selection if NOT performing an action
        // (actions clear selection themselves)
        if (!willPerformAction) {
          runOnJS(handleCommitSelection)();
        }
        
        if (currentZone === 'trash') {
          runOnJS(handleDeleteAction)();
        } else if (targetFolderId) {
          runOnJS(handleDropAction)(targetFolderId);
        } else if (currentZone === 'share') {
          // Drawing selection dropped onto Share zone
          runOnJS(showShareModal)(false);
        }
      }

      // reset everything
      draggingFolderId.value = null;
      dropTargetFolderId.value = null;
      hoveredZoneType.value = null;
      dragX.value = 0;
      dragY.value = 0;

      // Ensure autoscroll is stopped
      if (autoScrollDir.value !== 0) {
        autoScrollDir.value = 0;
        runOnJS(stopFolderStripAutoScroll)();
      }

      // Reset gradient colors
      runOnJS(handleResetGradient)();
      
      // Clear drawing
      path.value = '';
      pointsX.value = [];
      pointsY.value = [];
      startX.value = 0;
      startY.value = 0;
      currentX.value = 0;
      currentY.value = 0;
    });

  // Combine gestures: Pinch (2 fingers) and Pan (1 finger) can run simultaneously
  // But actually, we want them to be exclusive based on pointers.
  // Simultaneous allows both. If I use 2 fingers, Pan might also trigger if I don't limit it.
  // I limited Pan to maxPointers(1).

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <ThemedView 
        style={styles.container} 
        onLayout={(e) => {
          const layout = e.nativeEvent.layout;
          setDimensions(layout);
          // Keep shared screen width in sync for worklets
          screenWidth.value = layout.width;
        }}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.breadcrumbContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.breadcrumbContent}
            >
              {breadcrumbs.map((segment, index) => (
                <View key={segment.id} style={styles.breadcrumbSegment}>
                  <TouchableOpacity onPress={() => handleBreadcrumbPress(segment.id)}>
                    <Text style={styles.breadcrumbText}>{segment.name}</Text>
                  </TouchableOpacity>
                  {index < breadcrumbs.length - 1 && (
                    <Text style={styles.chevron}> › </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* 20% - Folder Strip */}
        <View 
          style={styles.folderSection}
          onLayout={(e) => {
            const { x, y, width, height } = e.nativeEvent.layout;
            folderStripX.value = x;
            folderStripY.value = y;
            folderStripHeight.value = height;
          }}
        >
          <FolderStrip 
            ref={folderStripRef}
            folders={currentFolders}
            onFolderPress={handleFolderPress}
            onNewFolder={handleNewFolder}
            onFolderLongPress={handleFolderLongPress}
            dropTargetFolderId={dropTargetFolderId}
            hoverColor={gradientEndColor}
            onScrollXChange={(x: number) => {
              // Update shared value used by worklets
              folderStripScrollX.value = x;
            }}
          />
        </View>

        {/* 5% - Zone Bar */}
        <View 
          style={styles.zoneSection}
          onLayout={(e) => {
            const { x, y, width, height } = e.nativeEvent.layout;
            zoneBarLayout.value = { x, y, width, height };
          }}
        >
          <ZoneBar hoveredZoneType={hoveredZoneType} />
        </View>

        {/* 75% - Canvas */}
        <View 
          ref={canvasSectionRef}
          style={styles.canvasSection}
          onLayout={(e) => {
            // Layout coords are relative to the GestureDetector root => same space as gesture event e.x/e.y
            const { x, y, width, height } = e.nativeEvent.layout;
            canvasLayout.value = { x, y, width, height };
          }}
        >
          <View style={styles.canvasHeader}>
            <TouchableOpacity style={styles.addTestButton} onPress={handleAddTestFiles}>
              <Text style={styles.addTestButtonText}>+ Add Test Files</Text>
            </TouchableOpacity>
          </View>
          <FileCanvas 
            scale={scale}
            translateX={translateX}
            translateY={translateY}
            files={visibleFiles}
            selectedFileIds={selectedFileIds}
            onFileSelect={handleFileSelect}
          />
        </View>

        {/* Folder Ghost view) */}
        <Animated.View style={ghostStyle}>
          <Text style={{ fontSize: 20 }}>📁</Text>
        </Animated.View>

        {/* Drawing Layer (Overlay) */}
        <DrawingLayer 
          path={path} 
          startX={startX}
          startY={startY}
          currentX={currentX}
          currentY={currentY}
          gradientStart={gradientStartColor}
          gradientEnd={gradientEndColor}
        />

        {/* Selection Counter */}
        {selectedFileIds.length > 0 && (
          <View style={styles.selectionCounterContainer}>
            <View style={styles.selectionCounter}>
              <Text style={styles.selectionCounterText}>
                {selectedFileIds.length} {selectedFileIds.length === 1 ? 'file' : 'files'} selected
              </Text>
            </View>
          </View>
        )}

        {/* Toast (temporary) */}
        {toastVisible && (
          <View style={styles.toastContainer} pointerEvents="none">
            <View style={styles.toastBubble}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons (Bottom) */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[
              styles.actionButton,
              !canUndo && styles.actionButtonDisabled
            ]} 
            onPress={undo}
            disabled={!canUndo}
          >
            <Undo2 
              size={20} 
              color={canUndo ? '#f1f5f9' : '#475569'} 
              strokeWidth={2.5}
            />
            <Text style={[
              styles.actionButtonText,
              !canUndo && styles.actionButtonTextDisabled
            ]}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.actionButton,
              !canRedo && styles.actionButtonDisabled
            ]} 
            onPress={redo}
            disabled={!canRedo}
          >
            <Redo2 
              size={20} 
              color={canRedo ? '#f1f5f9' : '#475569'} 
              strokeWidth={2.5}
            />
            <Text style={[
              styles.actionButtonText,
              !canRedo && styles.actionButtonTextDisabled
            ]}>Redo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.actionButton,
              styles.clearButton,
              selectedFileIds.length === 0 && styles.actionButtonDisabled
            ]} 
            onPress={clearSelection}
            disabled={selectedFileIds.length === 0}
          >
            <Eraser 
              size={20} 
              color={selectedFileIds.length > 0 ? '#fef2f2' : '#475569'} 
              strokeWidth={2.5}
            />
            <Text style={[
              styles.actionButtonText,
              styles.clearButtonText,
              selectedFileIds.length === 0 && styles.actionButtonTextDisabled
            ]}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Share Modal */}
        <Modal
          visible={shareModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeShareModal}
        >
          <View style={styles.shareOverlay}>
            <View style={styles.shareContent}>
              <View style={styles.shareHeader}>
                <Text style={styles.modalTitle}>Share via...</Text>
                <TouchableOpacity onPress={closeShareModal}>
                  <Text style={{ color: '#94a3b8', fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {!sentStatus ? (
                <View style={styles.shareGrid}>
                  <TouchableOpacity style={styles.shareButton} onPress={() => handleSend('Messenger')}>
                    <Image source={require('../../assets/icons/dark/Messenger.png')} style={styles.shareIcon} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.shareButton} onPress={() => handleSend('Twitter')}>
                    <Image source={require('../../assets/icons/dark/Twitter.png')} style={styles.shareIcon} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.shareButton} onPress={() => handleSend('Email')}>
                    <Image source={require('../../assets/icons/dark/Email.png')} style={styles.shareIcon} />
                  </TouchableOpacity>

                  <View style={[styles.shareButton, styles.shareButtonDisabled]}>
                    <Image source={require('../../assets/icons/dark/share.png')} style={[styles.shareIcon, { opacity: 0.4 }]} />
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={styles.sentText}>Sent</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* New Folder Modal */}
        <Modal
          visible={showNewFolderModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelNewFolder}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Folder</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Folder name"
                placeholderTextColor="#64748b"
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
                onSubmitEditing={handleCreateFolder}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={handleCancelNewFolder}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.createButton]} 
                  onPress={handleCreateFolder}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  headerSection: {
    height: 50,
    backgroundColor: '#1B2535',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  addTestButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addTestButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  chevron: {
    color: '#64748b',
    fontSize: 14,
    marginHorizontal: 4,
  },
  folderSection: {
    flexGrow: 0,
  },
  zoneSection: {
    height: '15%',
  },
  canvasSection: {
    flex: 1, // Takes remaining space (75%)
  },
  canvasHeader: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    color: '#f1f5f9',
    fontSize: 16,
    padding: 12,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#334155',
  },
  createButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectionCounterContainer: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  selectionCounter: {
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  selectionCounterText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  actionButtonText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextDisabled: {
    color: '#475569',
  },
  clearButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearButtonText: {
    color: '#fef2f2',
  },

  /* Share Modal styles */
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  shareContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 420,
    alignItems: 'center',
  },
  shareHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  shareButton: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareIcon: {
    width: 48,
    height: 48,
    tintColor: '#e2e8f0',
    resizeMode: 'contain',
  },
  sentText: {
    color: '#10b981',
    fontSize: 36,
    fontWeight: '800',
  },

  /* Toast styles */
  toastContainer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  toastBubble: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  toastText: {
    color: '#07203a',
    fontSize: 14,
    fontWeight: '700',
  },
});