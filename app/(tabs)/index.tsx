import { testImages } from '@/assets/testImages';
import { ActionBar } from '@/components/ActionBar';
import { DrawingLayer } from '@/components/DrawingLayer';
import { FileCanvas } from '@/components/FileCanvas';
import { FolderStrip } from '@/components/FolderStrip';
import { NewFolderModal } from '@/components/modals';
import { ThemedView } from '@/components/themed-view';
import { ZoneBar } from '@/components/ZoneBar';
import { useFileSystem } from '@/hooks/useFileSystem';
import {
    createDeleteFilesAction,
    createMoveFilesAction,
    createMoveFolderAction,
    createSelectFilesAction,
    createToggleSelectionAction,
    FileMoveInfo,
    useActionHistoryStore,
} from '@/store/actions';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { BreadcrumbSegment, ZoneType } from '@/types';
import {
    buildSmoothPath,
    calculateIntersectedIds,
    checkFolderIntersection,
    checkZoneIntersection,
} from '@/utils/canvasIntersection';
import {
    assignTestImagesToFiles,
    generateRandomFiles,
} from '@/utils/fileSystemHelpers';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    Alert,
    ScrollView,
    Share,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { styles } from './_index.styles';

// Zone Colors - matching ZoneBar component
const zoneColors: Record<ZoneType, string> = {
  trash: '#ef4444',
  temp: '#8b5cf6',
  copy: '#10b981',
  share: '#3b82f6',
  'folder-strip': '#f59e0b',
};

const defaultGradient = { start: '#576ffb', end: '#f865c4' };

export default function HomeScreen() {
  const {
    files,
    folders,
    createFolder,
    createFile,
    moveFilesToFolder,
    deleteFolder,
    moveFolder,
    getFolderById,
  } = useFileSystem();

  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([
    { id: 'home', name: 'Home' },
  ]);

  // Action History for undo/redo
  const { execute, undo, redo, canUndo, canRedo } = useActionHistoryStore();

  // Selection State
  const {
    selectedIds,
    pendingIds,
    addToPending,
    commitPending,
    clearSelection,
    setSelectedIds,
  } = useSelectionStore();

  const selectedFileIds = useMemo(
    () => [...selectedIds, ...pendingIds],
    [selectedIds, pendingIds],
  );

  // Modal State
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Gradient Colors
  const [gradientStartColor, setGradientStartColor] = useState(
    defaultGradient.start,
  );
  const [gradientEndColor, setGradientEndColor] = useState(defaultGradient.end);

  // Canvas SharedValues
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Drawing SharedValues
  const path = useSharedValue('');
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const currentX = useSharedValue(0);
  const currentY = useSharedValue(0);
  const isDrawing = useSharedValue(false);
  const pointsX = useSharedValue<number[]>([]);
  const pointsY = useSharedValue<number[]>([]);

  // Selection & Layout SharedValues
  const activeSelection = useSharedValue<string[]>([]);
  const canvasLayout = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const folderStripX = useSharedValue(0);
  const folderStripY = useSharedValue(0);
  const folderStripHeight = useSharedValue(0);
  const folderStripScrollX = useSharedValue(0);
  const screenWidth = useSharedValue(0);
  const autoScrollDir = useSharedValue(0);
  const dropTargetFolderId = useSharedValue<string | null>(null);
  const hoveredZoneType = useSharedValue<ZoneType | null>(null);
  const zoneBarLayout = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });

  // Folder Drag SharedValues
  const draggingFolderId = useSharedValue<string | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const folderStripRef = useRef<any>(null);
  const canvasSectionRef = useRef<View>(null);
  const pinchStartValues = useRef({
    scale: 1,
    translateX: 0,
    translateY: 0,
    focalX: 0,
    focalY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  // Memoized visible items
  const visibleFiles = useMemo(
    () =>
      files.filter(file =>
        currentFolderId ? file.parentId === currentFolderId : !file.parentId,
      ),
    [files, currentFolderId],
  );

  const currentFolders = useMemo(
    () =>
      folders.filter(folder =>
        currentFolderId
          ? folder.parentId === currentFolderId
          : !folder.parentId,
      ),
    [folders, currentFolderId],
  );

  // --- Toast ---
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1500);
  }, []);

  // --- Gradient Handlers ---
  const handleGradientUpdate = (startColor: string, endColor: string) => {
    setGradientStartColor(startColor);
    setGradientEndColor(endColor);
  };

  const handleResetGradient = () => {
    setGradientStartColor(defaultGradient.start);
    setGradientEndColor(defaultGradient.end);
  };

  // --- Selection Handlers ---
  const handleSelectionUpdate = (newIds: string[]) => {
    addToPending(newIds);
  };

  const handleCommitSelection = () => {
    const previousSelection = [...selectedIds];
    const addedIds = commitPending();
    if (addedIds.length > 0) {
      const action = createSelectFilesAction(addedIds, previousSelection);
      execute(action);
    }
  };

  const handleFileSelect = useCallback(
    (fileId: string) => {
      const previousSelection = [...selectedIds];
      const isCurrentlySelected = selectedIds.includes(fileId);

      if (isCurrentlySelected) {
        setSelectedIds(selectedIds.filter(id => id !== fileId));
      } else {
        setSelectedIds([...selectedIds, fileId]);
      }

      const action = createToggleSelectionAction(
        fileId,
        isCurrentlySelected,
        previousSelection,
      );
      execute(action);
    },
    [selectedIds, setSelectedIds, execute],
  );

  // --- Folder Autoscroll ---
  const startFolderStripAutoScroll = useCallback((dir: number) => {
    folderStripRef.current?.startAutoScroll?.(dir);
  }, []);

  const stopFolderStripAutoScroll = useCallback(() => {
    folderStripRef.current?.stopAutoScroll?.();
  }, []);

  // --- Navigation Handlers ---
  const handleFolderPress = useCallback(
    (folderId: string) => {
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        setCurrentFolderId(folderId);
        setBreadcrumbs(prev => [...prev, { id: folderId, name: folder.name }]);
        folderStripRef.current?.scrollToStart?.();
      }
    },
    [folders],
  );

  const handleBreadcrumbPress = useCallback(
    (folderId: string) => {
      const index = breadcrumbs.findIndex(b => b.id === folderId);
      if (index !== -1) {
        setBreadcrumbs(breadcrumbs.slice(0, index + 1));
        setCurrentFolderId(folderId === 'home' ? null : folderId);
      }
    },
    [breadcrumbs],
  );

  // --- Folder Modal ---
  const handleNewFolder = useCallback(() => setShowNewFolderModal(true), []);

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim(), currentFolderId || undefined);
      setNewFolderName('');
      setShowNewFolderModal(false);
    }
  }, [newFolderName, currentFolderId, createFolder]);

  const handleCancelNewFolder = useCallback(() => {
    setNewFolderName('');
    setShowNewFolderModal(false);
  }, []);

  // --- Native Share ---
  const handleShare = useCallback(
    async (isFolderShare = false) => {
      if (!isFolderShare && selectedFileIds.length === 0) {
        showToast('Please select at least one file to share');
        return;
      }

      try {
        const fileCount = isFolderShare
          ? 'folder'
          : `${selectedFileIds.length} file${selectedFileIds.length > 1 ? 's' : ''}`;
        const message = `Check out this ${fileCount} from Zwipe!`;
        const url = 'https://example.com/shared/files'; // Replace with your actual share URL

        const result = await Share.share({
          message,
          url, // iOS only
          title: 'Share Files', // Android only
        });

        if (result.action === Share.sharedAction) {
          showToast('Shared successfully!');
          if (!isFolderShare) {
            clearSelection();
          }
        }
      } catch (error: any) {
        showToast(error.message || 'Failed to share');
      }
    },
    [selectedFileIds, showToast, clearSelection],
  );

  // --- Test Files ---
  const handleAddTestFiles = useCallback(() => {
    // Generate test files with random positions (not grid) and bias towards images
    const newFiles = generateRandomFiles(
      6,
      currentFolderId || undefined,
      false,
      0.8,
    );

    // Assign random unique image assets for image files where possible
    const augmented = assignTestImagesToFiles(newFiles, testImages, files);

    // Create files in the store, passing the asset when present
    augmented.forEach(file => {
      createFile(file.name, file.x, file.y, file.parentId, (file as any).asset);
    });
  }, [currentFolderId, createFile, files]);

  // --- File/Folder Actions ---
  const handleDropAction = useCallback(
    (targetId: string) => {
      const filesToMove = files.filter(f => selectedFileIds.includes(f.id));
      const moveInfos: FileMoveInfo[] = filesToMove.map(file => ({
        fileId: file.id,
        previousParentId: file.parentId || null,
        newParentId: targetId,
      }));

      moveFilesToFolder(selectedFileIds, targetId);
      execute(createMoveFilesAction(moveInfos, targetId));
      clearSelection();
    },
    [files, selectedFileIds, moveFilesToFolder, clearSelection, execute],
  );

  const handleDeleteAction = useCallback(() => {
    if (selectedFileIds.length > 0) {
      const filesToDelete = files.filter(f => selectedFileIds.includes(f.id));
      const moveInfos: FileMoveInfo[] = filesToDelete.map(file => ({
        fileId: file.id,
        previousParentId: file.parentId || null,
        newParentId: 'trash',
      }));

      moveFilesToFolder(selectedFileIds, 'trash');
      execute(createDeleteFilesAction(moveInfos));
      clearSelection();
    }
  }, [selectedFileIds, files, moveFilesToFolder, clearSelection, execute]);

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      Alert.alert(
        'Delete Folder',
        'Do you really want to delete this folder and everything inside?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteFolder(folderId),
          },
        ],
      );
    },
    [deleteFolder],
  );

  const handleMoveFolder = useCallback(
    (folderId: string, targetId: string) => {
      if (folderId === targetId) {
        showToast('Cannot move a folder into itself');
        return;
      }

      let p = getFolderById(targetId);
      while (p) {
        if (p.id === folderId) {
          showToast('Cannot move a folder into one of its sub-folders');
          return;
        }
        if (!p.parentId) break;
        p = getFolderById(p.parentId);
      }

      const previousParent = getFolderById(folderId)?.parentId || null;
      moveFolder(folderId, targetId);
      execute(createMoveFolderAction(folderId, previousParent, targetId));
      showToast('Folder moved');
    },
    [getFolderById, moveFolder, showToast, execute],
  );

  const handleFolderLongPress = useCallback(
    (id: string) => {
      draggingFolderId.value = id;
      isDrawing.value = false;

      try {
        const items = useLayoutStore.getState().getItems();
        const folderLayout = items.find(
          it => it.id === id && it.type === 'folder',
        );
        if (folderLayout) {
          dragX.value = folderLayout.layout.x + folderLayout.layout.width / 2;
          dragY.value = folderLayout.layout.y + folderLayout.layout.height / 2;
        }
        dropTargetFolderId.value = null;
      } catch {
        // ignore
      }
    },
    [draggingFolderId, isDrawing, dragX, dragY, dropTargetFolderId],
  );

  // --- Sync SharedValue → React ---
  useAnimatedReaction(
    () => activeSelection.value,
    (current, previous) => {
      const prevArr = previous ?? [];
      if (
        current.length !== prevArr.length ||
        current.some((id, i) => id !== prevArr[i])
      ) {
        runOnJS(handleSelectionUpdate)(current);
      }
    },
  );

  // --- Ghost Style for Folder Drag ---
  const ghostStyle = useAnimatedStyle(() => ({
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
      { scale: draggingFolderId.value ? 1.1 : 0 },
    ],
    opacity: draggingFolderId.value ? 1 : 0,
  }));

  // --- Gestures ---
  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onStart(e => {
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
    .onUpdate(e => {
      const cx = canvasLayout.value.width / 2;
      const cy = canvasLayout.value.height / 2;
      const focalX = e.focalX - canvasLayout.value.x;
      const focalY = e.focalY - canvasLayout.value.y;
      let newScale = pinchStartValues.current.scale * e.scale;
      newScale = Math.max(0.3, Math.min(3, newScale));
      scale.value = newScale;

      const newOffsetX =
        focalX -
        (pinchStartValues.current.focalX - pinchStartValues.current.offsetX) *
          e.scale;
      const newOffsetY =
        focalY -
        (pinchStartValues.current.focalY - pinchStartValues.current.offsetY) *
          e.scale;

      translateX.value = newOffsetX - cx * (1 - newScale);
      translateY.value = newOffsetY - cy * (1 - newScale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .activeOffsetY([-10, 10])
    .activeOffsetX([-10, 10])
    .shouldCancelWhenOutside(false)
    .onStart(e => {
      'worklet';
      if (
        e.y >= folderStripY.value &&
        e.y <= folderStripY.value + folderStripHeight.value
      ) {
        isDrawing.value = false;
        return;
      }

      dragX.value = e.x;
      dragY.value = e.y;

      if (draggingFolderId.value) {
        isDrawing.value = false;
      } else {
        isDrawing.value = true;
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
    .onUpdate(e => {
      'worklet';
      if (isDrawing.value) {
        currentX.value = e.x;
        currentY.value = e.y;

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
          canvasLayout.value.height,
        );
        activeSelection.value = ids;

        // Path building with point thinning
        const MAX_POINTS = 50;
        const MIN_DISTANCE = 5;
        let currentPointsX = pointsX.value;
        let currentPointsY = pointsY.value;
        const lastX = currentPointsX[currentPointsX.length - 1] ?? 0;
        const lastY = currentPointsY[currentPointsY.length - 1] ?? 0;
        const dist = Math.sqrt((e.x - lastX) ** 2 + (e.y - lastY) ** 2);

        if (dist >= MIN_DISTANCE || currentPointsX.length === 0) {
          if (currentPointsX.length >= MAX_POINTS) {
            currentPointsX = currentPointsX.filter((_, i) => i % 2 === 0);
            currentPointsY = currentPointsY.filter((_, i) => i % 2 === 0);
          }
          const newPointsX = [...currentPointsX, e.x];
          const newPointsY = [...currentPointsY, e.y];
          pointsX.value = newPointsX;
          pointsY.value = newPointsY;
          path.value = buildSmoothPath(newPointsX, newPointsY);
        }

        // Check folder intersection
        const folderId = checkFolderIntersection(
          e.x,
          e.y,
          currentFolders,
          folderStripX.value,
          folderStripY.value,
          folderStripScrollX.value,
        );

        if (folderId) {
          dropTargetFolderId.value = folderId;
          hoveredZoneType.value = null;
          runOnJS(handleResetGradient)();
        } else {
          dropTargetFolderId.value = null;
          const zoneType = checkZoneIntersection(
            e.x,
            e.y,
            zoneBarLayout.value.y,
            zoneBarLayout.value.height,
            zoneBarLayout.value.width,
          );

          if (zoneType && zoneType !== hoveredZoneType.value) {
            hoveredZoneType.value = zoneType;
            runOnJS(handleGradientUpdate)(zoneColors[zoneType], '#ffffff');
          } else if (!zoneType && hoveredZoneType.value !== null) {
            const previousZone = hoveredZoneType.value;
            hoveredZoneType.value = null;
            if (previousZone !== 'copy') {
              runOnJS(handleResetGradient)();
            }
          }
        }
      } else if (draggingFolderId.value) {
        dragX.value = e.x;
        dragY.value = e.y;

        const folderId = checkFolderIntersection(
          e.x,
          e.y,
          currentFolders,
          folderStripX.value,
          folderStripY.value,
          folderStripScrollX.value,
        );

        if (folderId) {
          dropTargetFolderId.value = folderId;
          hoveredZoneType.value = null;
        } else {
          dropTargetFolderId.value = null;
          hoveredZoneType.value = checkZoneIntersection(
            e.x,
            e.y,
            zoneBarLayout.value.y,
            zoneBarLayout.value.height,
            zoneBarLayout.value.width,
          );
        }

        // Autoscroll
        const EDGE_ZONE = 60;
        if (
          e.y >= folderStripY.value &&
          e.y <= folderStripY.value + folderStripHeight.value
        ) {
          if (e.x <= EDGE_ZONE) {
            if (autoScrollDir.value !== -1) {
              autoScrollDir.value = -1;
              runOnJS(startFolderStripAutoScroll)(-1);
            }
          } else if (e.x >= screenWidth.value - EDGE_ZONE) {
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

      if (folderIdToTrash) {
        if (currentZone === 'trash') {
          runOnJS(handleDeleteFolder)(folderIdToTrash);
        } else if (targetFolderId) {
          runOnJS(handleMoveFolder)(folderIdToTrash, targetFolderId);
        } else if (currentZone === 'share') {
          runOnJS(handleShare)(true);
        }
      } else if (isDrawing.value) {
        const willPerformAction =
          currentZone === 'trash' || targetFolderId !== null;

        if (!willPerformAction) {
          runOnJS(handleCommitSelection)();
        }

        if (currentZone === 'trash') {
          runOnJS(handleDeleteAction)();
        } else if (targetFolderId) {
          runOnJS(handleDropAction)(targetFolderId);
        } else if (currentZone === 'share') {
          runOnJS(handleShare)(false);
        }
      }

      // Reset
      draggingFolderId.value = null;
      dropTargetFolderId.value = null;
      hoveredZoneType.value = null;
      dragX.value = 0;
      dragY.value = 0;

      if (autoScrollDir.value !== 0) {
        autoScrollDir.value = 0;
        runOnJS(stopFolderStripAutoScroll)();
      }

      runOnJS(handleResetGradient)();
      path.value = '';
      pointsX.value = [];
      pointsY.value = [];
      startX.value = 0;
      startY.value = 0;
      currentX.value = 0;
      currentY.value = 0;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <ThemedView
        style={styles.container}
        onLayout={e => {
          screenWidth.value = e.nativeEvent.layout.width;
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
                  <TouchableOpacity
                    onPress={() => handleBreadcrumbPress(segment.id)}
                  >
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

        {/* Folder Strip */}
        <View
          style={styles.folderSection}
          onLayout={e => {
            const { x, y, height } = e.nativeEvent.layout;
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
              folderStripScrollX.value = x;
            }}
          />
        </View>

        {/* Zone Bar */}
        <View
          style={styles.zoneSection}
          onLayout={e => {
            const { x, y, width, height } = e.nativeEvent.layout;
            zoneBarLayout.value = { x, y, width, height };
          }}
        >
          <ZoneBar hoveredZoneType={hoveredZoneType} />
        </View>

        {/* Canvas */}
        <View
          ref={canvasSectionRef}
          style={styles.canvasSection}
          onLayout={e => {
            const { x, y, width, height } = e.nativeEvent.layout;
            canvasLayout.value = { x, y, width, height };
          }}
        >
          <View style={styles.canvasHeader}>
            <TouchableOpacity
              style={styles.addTestButton}
              onPress={handleAddTestFiles}
            >
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

        {/* Folder Ghost */}
        <Animated.View style={ghostStyle}>
          <Text style={{ fontSize: 20 }}>📁</Text>
        </Animated.View>

        {/* Drawing Layer */}
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
                {selectedFileIds.length}{' '}
                {selectedFileIds.length === 1 ? 'file' : 'files'} selected
              </Text>
            </View>
          </View>
        )}

        {/* Toast */}
        {toastVisible && (
          <View style={styles.toastContainer} pointerEvents='none'>
            <View style={styles.toastBubble}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        )}

        {/* Action Bar */}
        <ActionBar
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={selectedFileIds.length > 0}
          onUndo={undo}
          onRedo={redo}
          onClear={clearSelection}
        />

        {/* Modals */}
        <NewFolderModal
          visible={showNewFolderModal}
          folderName={newFolderName}
          onFolderNameChange={setNewFolderName}
          onCancel={handleCancelNewFolder}
          onCreate={handleCreateFolder}
        />
      </ThemedView>
    </GestureDetector>
  );
}
