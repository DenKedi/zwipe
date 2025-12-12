import { DrawingLayer } from '@/components/DrawingLayer';
import { FileCanvas } from '@/components/FileCanvas';
import { FolderStrip } from '@/components/FolderStrip';
import { ThemedView } from '@/components/themed-view';
import { ZoneBar } from '@/components/ZoneBar';
import { useFileSystem } from '@/hooks/useFileSystem';
import { BreadcrumbSegment, FileSystemItem } from '@/types';
import { generateRandomFiles } from '@/utils/fileSystemHelpers';
import { useRef, useState } from 'react';
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
  const canvasOffset = useSharedValue({ x: 0, y: 0 });
  const folderStripY = useSharedValue(0);
  const dropTargetFolderId = useSharedValue<string | null>(null);

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

  // Get files for current folder
  const visibleFiles = files.filter(file => 
    currentFolderId ? file.parentId === currentFolderId : !file.parentId
  );
  const currentFolders = folders.filter(folder => 
    currentFolderId ? folder.parentId === currentFolderId : !folder.parentId
  );

  // Navigation Handlers
  const handleFolderPress = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setCurrentFolderId(folderId);
      setBreadcrumbs([...breadcrumbs, { id: folderId, name: folder.name }]);
    }
  };

  const handleBreadcrumbPress = (folderId: string) => {
    const index = breadcrumbs.findIndex(b => b.id === folderId);
    if (index !== -1) {
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      setCurrentFolderId(folderId === 'home' ? null : folderId);
    }
  };

  const handleNewFolder = () => {
    setShowNewFolderModal(true);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder = createFolder(newFolderName.trim(), currentFolderId || undefined);
      console.log('Folder created:', newFolder);
      setNewFolderName('');
      setShowNewFolderModal(false);
    } else {
      console.log('No folder name provided');
    }
  };

  const handleCancelNewFolder = () => {
    setNewFolderName('');
    setShowNewFolderModal(false);
  };

  // Add test files handler
  const handleAddTestFiles = () => {
    const newFiles = generateRandomFiles(5, currentFolderId || undefined, true);
    newFiles.forEach(file => {
      createFile(file.name, file.x, file.y, file.parentId);
    });
  };

  // Toggle file selection (for testing)
  const handleFileSelect = (fileId: string) => {
    //console.log(files)
    setSelectedFileIds(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };

  // Clear selection when clicking on empty background
  const handleBackgroundClick = () => {
    setSelectedFileIds([]); 
  };

  // Handle drpping files in folder 
  const handleDropAction = (targetId: string) => {
    const filesToMove = files.filter(f => selectedFileIds.includes(f.id));
    console.log(`Moving ${filesToMove.length} files to folder ${targetId}`, filesToMove);
    moveFilesToFolder(selectedFileIds, targetId);
    setSelectedFileIds([]);
  };

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
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      
      const startOffsetX = cx * (1 - savedScale.value) + savedTranslateX.value;
      const startOffsetY = cy * (1 - savedScale.value) + savedTranslateY.value;

      pinchStartValues.current = {
        scale: savedScale.value,
        translateX: savedTranslateX.value,
        translateY: savedTranslateY.value,
        focalX: e.focalX,
        focalY: e.focalY,
        offsetX: startOffsetX,
        offsetY: startOffsetY,
      };
    })
    .onUpdate((e) => {
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      const newScale = pinchStartValues.current.scale * e.scale;
      
      scale.value = newScale;

      const newOffsetX = e.focalX - (pinchStartValues.current.focalX - pinchStartValues.current.offsetX) * e.scale;
      const newOffsetY = e.focalY - (pinchStartValues.current.focalY - pinchStartValues.current.offsetY) * e.scale;

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
    absX: number,
    absY: number,
    visibleFiles: FileSystemItem[],
    currentScale: number,
    transX: number,
    transY: number,
    offX: number, // Neuer Parameter
    offY: number  // Neuer Parameter
  ): string[] => {
    'worklet'; 
    // Hier wird der Offset abgezogen, bevor durch Scale geteilt wird
    const canvasX = (absX - offX - transX) / currentScale;
    const canvasY = (absY - offY - transY) / currentScale;

    const selectionArea = {
      minX: canvasX - 5,
      minY: canvasY - 5,
      maxX: canvasX + 5,
      maxY: canvasY + 5,
    };

    const intersectedIds: string[] = [];

    for (const file of visibleFiles) {
      if (
        selectionArea.maxX > file.x &&
        selectionArea.minX < file.x + FILE_WIDTH &&
        selectionArea.maxY > file.y &&
        selectionArea.minY < file.y + FILE_HEIGHT
      ) {
        intersectedIds.push(file.id);
      }
    }
    return intersectedIds;
  };

// Intersection Helper for folder
  const checkFolderIntersection = (absX: number, absY: number, foldersList: typeof currentFolders): string | null => {
    'worklet';
    const CARD_WIDTH = 100;
    const GAP = 12;
    const PADDING_LEFT = 16;
    const OFFSET_TOP = 120;
    const CARD_HEIGHT = 60;

    const stripY = folderStripY.value;
    const minY = stripY + OFFSET_TOP;
    const maxY = minY + CARD_HEIGHT;

    if (absY < minY || absY > maxY) {
      return null;
    }

    const xInStrip = absX - PADDING_LEFT;
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

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onStart((e) => {
      'worklet';
      runOnJS(handleResetSelection)(); 
      activeSelection.value = []; 
      isDrawing.value = true;
      pointsX.value = [e.absoluteX];
      pointsY.value = [e.absoluteY];
      startX.value = e.absoluteX;
      startY.value = e.absoluteY;
      currentX.value = e.absoluteX;
      currentY.value = e.absoluteY;
      path.value = `M ${e.absoluteX} ${e.absoluteY}`;
    })
    .onUpdate((e) => {
      'worklet';
      if (isDrawing.value) {
        currentX.value = e.absoluteX;
        currentY.value = e.absoluteY;

        //Debug log
        //console.log("X: ", Math.floor(currentX.value), " Y: ", Math.floor(currentY.value));

        // Calculate intersections and udate SharedValue 
        const ids = calculateIntersectedIds(
          e.absoluteX, e.absoluteY, visibleFiles, scale.value, translateX.value, translateY.value, canvasOffset.value.x, canvasOffset.value.y
        );
        activeSelection.value = ids;
        
        // Add new point
        const newPointsX = [...pointsX.value, e.absoluteX];
        const newPointsY = [...pointsY.value, e.absoluteY];
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

        const folderId = checkFolderIntersection(e.absoluteX, e.absoluteY, currentFolders);
        if (folderId) {
          dropTargetFolderId.value = folderId;
        }
      }
    })
    .onEnd(() => {
      console.log(dropTargetFolderId.value);
      'worklet';
      isDrawing.value = false;

      const targetId = dropTargetFolderId.value;
      if (targetId) {
        runOnJS(handleDropAction)(targetId);
      }
      dropTargetFolderId.value = null;
      
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
        e.absoluteX,
        e.absoluteY,
        visibleFiles,
        scale.value,
        translateX.value,
        translateY.value,
        canvasOffset.value.x, // Offset X
        canvasOffset.value.y  // Offset Y
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
          />
        </View>

        {/* 5% - Zone Bar */}
        <View style={styles.zoneSection}>
          <ZoneBar />
        </View>

        {/* 75% - Canvas */}
        <View 
          style={styles.canvasSection}
          onLayout={(e) => {
            // Schritt 2: Messen des Offsets (Versatz von oben/links)
            canvasOffset.value = { 
              x: e.nativeEvent.layout.x, 
              y: e.nativeEvent.layout.y 
            };
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