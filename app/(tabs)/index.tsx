import { DrawingLayer } from '@/components/DrawingLayer';
import { FileCanvas } from '@/components/FileCanvas';
import { FolderStrip } from '@/components/FolderStrip';
import { ThemedView } from '@/components/themed-view';
import { ZoneBar, zones } from '@/components/ZoneBar';
import { useFileSystem } from '@/hooks/useFileSystem';
import { BreadcrumbSegment, FileSystemItem, ZoneType } from '@/types';
import { generateRandomFiles } from '@/utils/fileSystemHelpers';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';

export default function HomeScreen() {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { files, folders, createFolder, createFile, moveFilesToFolder } = useFileSystem();
  
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([
    { id: 'home', name: 'Home' }
  ]);

  // Selection State
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  
  // Folder creation modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
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
  const folderStripY = useSharedValue(0);
  const dropTargetFolderId = useSharedValue<string | null>(null);

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
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      newIds.forEach(id => newSet.add(id));
      return Array.from(newSet);
    });
  };

  const handleResetSelection = () => {
    setSelectedFileIds([]);
  };

  const handleGradientUpdate = (startColor: string, endColor: string) => {
    setGradientStartColor(startColor);
    setGradientEndColor(endColor);
  };

  const handleResetGradient = () => {
    setGradientStartColor(defaultGradient.start);
    setGradientEndColor(defaultGradient.end);
  };
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
    setSelectedFileIds(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  }, []);

  // Clear selection when clicking on empty background
  const handleBackgroundClick = useCallback(() => {
    setSelectedFileIds([]); 
  }, []);

  // Handle dropping files in folder 
  const handleDropAction = useCallback((targetId: string) => {
    const filesToMove = files.filter(f => selectedFileIds.includes(f.id));
    console.log(`Moving ${filesToMove.length} files to folder ${targetId}`, filesToMove);
    moveFilesToFolder(selectedFileIds, targetId);
    setSelectedFileIds([]);
  }, [files, selectedFileIds, moveFilesToFolder]);

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
    const xInStrip = x - PADDING_LEFT;
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
      runOnJS(handleResetSelection)(); 
      runOnJS(handleResetGradient)();
      activeSelection.value = []; 
      isDrawing.value = true;
      pointsX.value = [e.x];
      pointsY.value = [e.y];
      startX.value = e.x;
      startY.value = e.y;
      currentX.value = e.x;
      currentY.value = e.y;
      path.value = `M ${e.x} ${e.y}`;
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
    })
    .onEnd(() => {
      'worklet';
      console.log(dropTargetFolderId.value);
      isDrawing.value = false;

      const targetId = dropTargetFolderId.value;
      if (targetId) {
        runOnJS(handleDropAction)(targetId);
      }
      dropTargetFolderId.value = null;
      hoveredZoneType.value = null;
      
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
      
      // TODO: Fix coordinate transformation while zoomed out
    });

  // Combine gestures: Pinch (2 fingers) and Pan (1 finger) can run simultaneously
  // But actually, we want them to be exclusive based on pointers.
  // Simultaneous allows both. If I use 2 fingers, Pan might also trigger if I don't limit it.
  // I limited Pan to maxPointers(1).

  // Tap Gesture to clear selection
  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      // Wir nutzen deine existierende Funktion, um zu prüfen, ob wir etwas treffen
      const ids = calculateIntersectedIds(
        e.x,
        e.y,
        visibleFiles,
        scale.value,
        translateX.value,
        translateY.value,
        canvasLayout.value.x, // Canvas offset X (relative to GestureDetector)
        canvasLayout.value.y,  // Canvas offset Y (relative to GestureDetector)
        canvasLayout.value.width,
        canvasLayout.value.height
      );

      // Wenn die Liste leer ist, haben wir ins Leere geklickt
      if (ids.length === 0) {
        runOnJS(handleBackgroundClick)();
      }
    });


  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, tapGesture);

  return (
    <GestureDetector gesture={composedGesture}>
      <ThemedView 
        style={styles.container} 
        onLayout={(e) => setDimensions(e.nativeEvent.layout)}
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
            folderStripY.value = e.nativeEvent.layout.y;
          }}
        >
          <FolderStrip 
            folders={currentFolders}
            onFolderPress={handleFolderPress}
            onNewFolder={handleNewFolder}
            dropTargetFolderId={dropTargetFolderId}
            hoverColor={gradientEndColor}
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
});