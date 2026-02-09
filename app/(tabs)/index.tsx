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
  createDuplicateFilesAction,
  createMoveFilesAction,
  createMoveFolderAction,
  createSelectFilesAction,
  createToggleSelectionAction,
  FileMoveInfo,
  useActionHistoryStore,
} from '@/store/actions';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useFileSystemStore } from '@/store/useFileSystemStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { BreadcrumbSegment, TEMP_FOLDER_ID, ZoneType } from '@/types';
import {
  buildSmoothPath,
  calculateIntersectedIds,
  checkFolderIntersection,
  checkZoneIntersection,
} from '@/utils/canvasIntersection';
import {
  assignTestImagesToFiles,
  generateFileAt,
  generateRandomFiles,
  resolveNonOverlappingPosition,
} from '@/utils/fileSystemHelpers';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { styles } from '../../styles/tabIndex.styles';

// Zone Colors - matching ZoneBar component
const zoneColors: Record<ZoneType, string> = {
  trash: '#ef4444',
  temp: '#8b5cf6',
  copy: '#10b981',
  share: '#3b82f6',
  'folder-strip': '#f59e0b',
};

const defaultGradient = { start: '#576ffb', end: '#f865c4' };

/**
 * Generate a unique copy name for a file in a target folder.
 * First copy: "photo (copy).jpg"
 * Subsequent: "photo (copy 2).jpg", "photo (copy 3).jpg", etc.
 */
function getUniqueCopyName(
  originalName: string,
  existingFiles: { name: string; parentId?: string }[],
  targetParentId: string | null | undefined,
): string {
  const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
  // Strip any existing " (copy...)" suffix and extension to get the true base
  const nameWithoutExt = originalName.replace(/\.[^.]+$/, '');
  const trueBase = nameWithoutExt.replace(/ \(copy(?: \d+)?\)$/, '');

  // Collect all files in the target folder
  const siblings = existingFiles.filter(f => {
    const pid = f.parentId ?? null;
    const tid = targetParentId ?? null;
    return pid === tid;
  });

  const siblingNames = new Set(siblings.map(f => f.name));

  // Try "base (copy).ext" first
  const firstTry = `${trueBase} (copy)${ext}`;
  if (!siblingNames.has(firstTry)) return firstTry;

  // Then try "base (copy 2).ext", "base (copy 3).ext", ...
  let n = 2;
  while (true) {
    const candidate = `${trueBase} (copy ${n})${ext}`;
    if (!siblingNames.has(candidate)) return candidate;
    n++;
  }
}

export default function HomeScreen() {
  const {
    files,
    folders,
    createFolder,
    createFile,
    moveFile,
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
  // Preview state for lightbox
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<any | null>(null);

  // Duplication mode (React state synced from SharedValue for use in JS callbacks)
  const [isDupMode, setIsDupMode] = useState(false);

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
  const drawingStartTime = useSharedValue(0);
  const drawingFromTemp = useSharedValue(false);
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
  const isDuplicationMode = useSharedValue(false);
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

  // Note: uploaded images will be persisted to the file store via `createFile`

  // Temp Zone
  const tempFiles = useMemo(
    () => files.filter(f => f.parentId === TEMP_FOLDER_ID),
    [files],
  );
  const tempFileCount = tempFiles.length;
  const tempFileIds = useMemo(() => tempFiles.map(f => f.id), [tempFiles]);
  const isTempView = currentFolderId === TEMP_FOLDER_ID;

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

  const handlePreview = useCallback((file: any) => {
    // Support static require assets (number) and remote uri
    const asset = (file as any).asset ?? null;
    const uri = asset && typeof asset === 'object' && asset.uri ? asset.uri : null;
    if (uri) {
      setSelectedPreviewImage({ uri });
      return;
    }
    if (asset) {
      // static require asset (number) or object, pass through
      setSelectedPreviewImage(asset);
      return;
    }
    if ((file as any).uri) {
      setSelectedPreviewImage({ uri: (file as any).uri });
    }
  }, []);

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
      const filesToShare = isFolderShare
        ? files.filter(f => f.parentId === currentFolderId || (!currentFolderId && !f.parentId))
        : files.filter(f => selectedFileIds.includes(f.id));

      if (filesToShare.length === 0) {
        showToast('Please select at least one file to share');
        return;
      }

      try {
        // Collect shareable image URIs from selected files
        const shareableFiles = filesToShare
          .filter((f: any) => f.asset)
          .map((f: any) => {
            if (typeof f.asset === 'object' && f.asset.uri) return f.asset.uri;
            if (typeof f.asset === 'number') {
              // Bundled require() asset — resolve to URI
              const resolved = Image.resolveAssetSource(f.asset);
              return resolved?.uri || null;
            }
            return null;
          })
          .filter(Boolean) as string[];

        if (shareableFiles.length === 0) {
          // Fallback: share a text message if no image assets
          const fileCount = `${filesToShare.length} file${filesToShare.length > 1 ? 's' : ''}`;
          await Share.share({
            message: `Check out ${fileCount} from Zwipe!`,
            title: 'Share Files',
          });
          return;
        }

        // For a single file, use expo-sharing for native share sheet with file
        if (shareableFiles.length === 1) {
          const uri = shareableFiles[0];
          // If it's a local file, share directly; otherwise copy to cache first
          let shareUri = uri;
          if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
            const filename = `share_${Date.now()}.jpg`;
            const dest = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.downloadAsync(uri, dest);
            shareUri = dest;
          }
          await Sharing.shareAsync(shareUri, {
            mimeType: 'image/*',
            dialogTitle: 'Share Image',
          });
          if (!isFolderShare) clearSelection();
          return;
        }

        // Multiple files: share one by one isn't great UX, so share the first one
        // and mention the count
        const uri = shareableFiles[0];
        let shareUri = uri;
        if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
          const filename = `share_${Date.now()}.jpg`;
          const dest = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.downloadAsync(uri, dest);
          shareUri = dest;
        }
        await Sharing.shareAsync(shareUri, {
          mimeType: 'image/*',
          dialogTitle: `Share ${shareableFiles.length} Images`,
        });
        if (!isFolderShare) clearSelection();
      } catch (error: any) {
        if (error?.message?.includes('dismissed')) return;
        showToast(error.message || 'Failed to share');
      }
    },
    [selectedFileIds, files, currentFolderId, showToast, clearSelection],
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

    // Resolve positions to prevent overlap with existing files
    const siblings = files
      .filter(f => (currentFolderId ? f.parentId === currentFolderId : !f.parentId))
      .map(f => ({ x: f.x, y: f.y }));

    // Create files in the store, passing the asset when present
    augmented.forEach(file => {
      const pos = resolveNonOverlappingPosition(file.x, file.y, siblings);
      siblings.push(pos);
      createFile(file.name, pos.x, pos.y, file.parentId, (file as any).asset);
    });
  }, [currentFolderId, createFile, files]);

  // --- Image Picker Handler (FAB) ---
  const handlePickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        showToast('Permission to access photos is required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      // Normalize result to assets array
      if ((result as any).cancelled === true) return;
      const assets: any[] = (result as any).assets ?? ((result as any).uri ? [{ uri: (result as any).uri }] : []);
      if (!assets || assets.length === 0) return;

      const layout = canvasLayout.value as any;

      // Collect existing positions for overlap prevention
      const uploadSiblings = files
        .filter(f => (currentFolderId ? f.parentId === currentFolderId : !f.parentId))
        .map(f => ({ x: f.x, y: f.y }));

      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        const uri = a.uri;
        if (!uri) continue;

        const extMatch = uri.split('.').pop()?.split('?')[0].split('#')[0];
        const ext = (extMatch || 'jpg').toLowerCase();
        const name = `Upload_${Date.now()}_${i}.${ext}`;

        if (!layout || !layout.width || !layout.height) {
          const fallbackPos = resolveNonOverlappingPosition(120 + i * 10, 120 + i * 10, uploadSiblings);
          uploadSiblings.push(fallbackPos);
          const fallback = generateFileAt(fallbackPos.x, fallbackPos.y, name, ext, currentFolderId || undefined);
          (fallback as any).asset = { uri };
          createFile(fallback.name, fallback.x, fallback.y, fallback.parentId, (fallback as any).asset);
          continue;
        }

        // Place images as a tight cluster around the visible canvas center
        const cx = layout.width / 2;
        const cy = layout.height / 2;
        // Small spread to keep files clustered together
        const clusterRadius = 60;
        const angle = (i / assets.length) * Math.PI * 2;
        const r = Math.sqrt((i + 1) / assets.length) * clusterRadius;
        const centerOffsetX = Math.cos(angle) * r;
        const centerOffsetY = Math.sin(angle) * r;

        const localX = cx + centerOffsetX;
        const localY = cy + centerOffsetY;

        const canvasX = Math.round((localX - translateX.value - (1 - scale.value) * cx) / scale.value);
        const canvasY = Math.round((localY - translateY.value - (1 - scale.value) * cy) / scale.value);

        const pos = resolveNonOverlappingPosition(canvasX, canvasY, uploadSiblings);
        uploadSiblings.push(pos);
        const newFile = generateFileAt(pos.x, pos.y, name, ext, currentFolderId || undefined);
        (newFile as any).asset = { uri };
        createFile(newFile.name, newFile.x, newFile.y, newFile.parentId, (newFile as any).asset);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to pick image');
    }
  }, [canvasLayout, currentFolderId, scale, translateX, translateY, createFile, files]);

  // --- File/Folder Actions ---
  const handleDropAction = useCallback(
    (targetId: string) => {
      const filesToMove = files.filter(f => selectedFileIds.includes(f.id));
      if (isDupMode) {
        // Duplication mode: create copies of selected files in the target folder
        const duplicatedIds: string[] = [];
        const store = useFileSystemStore.getState();
        // Use current store files + already-created duplicates for name uniqueness
        const allFiles = [...store.files];
        // Collect occupied positions in the target folder for overlap prevention
        const occupied = store.files
          .filter(f => (targetId ? f.parentId === targetId : !f.parentId))
          .map(f => ({ x: f.x, y: f.y }));
        filesToMove.forEach((file) => {
          const newId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const copyName = getUniqueCopyName(file.name, allFiles, targetId);
          const pos = resolveNonOverlappingPosition(file.x, file.y, occupied);
          occupied.push(pos);
          const duplicate = {
            ...file,
            id: newId,
            name: copyName,
            extension: copyName.includes('.') ? copyName.split('.').pop() : file.extension,
            parentId: targetId || undefined,
            x: pos.x,
            y: pos.y,
            createdAt: new Date(),
            modifiedAt: new Date(),
          };
          store.addFile(duplicate);
          allFiles.push(duplicate as any);
          duplicatedIds.push(newId);
        });
        execute(createDuplicateFilesAction(duplicatedIds, targetId));
        clearSelection();
        showToast(`${filesToMove.length} file(s) duplicated`);
      } else {
        const moveInfos: FileMoveInfo[] = filesToMove.map(file => ({
          fileId: file.id,
          previousParentId: file.parentId || null,
          newParentId: targetId,
        }));
        moveFilesToFolder(selectedFileIds, targetId);
        execute(createMoveFilesAction(moveInfos, targetId));
        clearSelection();
        showToast(`${filesToMove.length} file(s) moved`);
      }
    },
    [files, selectedFileIds, moveFilesToFolder, clearSelection, execute, isDupMode, showToast],
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
      showToast(`${filesToDelete.length} file(s) deleted`);
    }
  }, [selectedFileIds, files, moveFilesToFolder, clearSelection, execute, showToast]);

  // --- Temp Zone Actions ---
  const handleMoveToTemp = useCallback(() => {
    if (selectedFileIds.length === 0) return;
    if (isDupMode) {
      // Duplication mode: create copies in Temp
      const filesToDup = files.filter(f => selectedFileIds.includes(f.id));
      const duplicatedIds: string[] = [];
      const store = useFileSystemStore.getState();
      const allFiles = [...store.files];
      const occupied = store.files
        .filter(f => f.parentId === TEMP_FOLDER_ID)
        .map(f => ({ x: f.x, y: f.y }));
      filesToDup.forEach((file) => {
        const newId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const copyName = getUniqueCopyName(file.name, allFiles, TEMP_FOLDER_ID);
        const pos = resolveNonOverlappingPosition(file.x, file.y, occupied);
        occupied.push(pos);
        const duplicate = {
          ...file,
          id: newId,
          name: copyName,
          extension: copyName.includes('.') ? copyName.split('.').pop() : file.extension,
          parentId: TEMP_FOLDER_ID,
          x: pos.x,
          y: pos.y,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
        store.addFile(duplicate);
        allFiles.push(duplicate as any);
        duplicatedIds.push(newId);
      });
      execute(createDuplicateFilesAction(duplicatedIds, TEMP_FOLDER_ID));
      clearSelection();
      showToast(`${selectedFileIds.length} file(s) duplicated to Temp`);
    } else {
      const filesToMove = files.filter(f => selectedFileIds.includes(f.id));
      const moveInfos: FileMoveInfo[] = filesToMove.map(file => ({
        fileId: file.id,
        previousParentId: file.parentId || null,
        newParentId: TEMP_FOLDER_ID,
      }));
      moveFilesToFolder(selectedFileIds, TEMP_FOLDER_ID);
      execute(createMoveFilesAction(moveInfos, TEMP_FOLDER_ID));
      clearSelection();
      showToast(`${selectedFileIds.length} file(s) stored in Temp`);
    }
  }, [selectedFileIds, files, moveFilesToFolder, clearSelection, execute, showToast, isDupMode]);

  const handleTempPress = useCallback(() => {
    if (currentFolderId === TEMP_FOLDER_ID) return;
    setCurrentFolderId(TEMP_FOLDER_ID);
    setBreadcrumbs([
      { id: 'home', name: 'Home' },
      { id: TEMP_FOLDER_ID, name: 'Temp' },
    ]);
    folderStripRef.current?.scrollToStart?.();
  }, [currentFolderId]);

  const handleTempDropToFolder = useCallback(
    (targetFolderId: string) => {
      if (tempFileIds.length === 0) {
        showToast('No files in Temp');
        return;
      }
      const moveInfos: FileMoveInfo[] = tempFiles.map(file => ({
        fileId: file.id,
        previousParentId: TEMP_FOLDER_ID as string | null,
        newParentId: targetFolderId,
      }));
      moveFilesToFolder(tempFileIds, targetFolderId);
      execute(createMoveFilesAction(moveInfos, targetFolderId));
      showToast(`${tempFileIds.length} file(s) moved from Temp`);
    },
    [tempFiles, tempFileIds, moveFilesToFolder, execute, showToast],
  );

  const handleTempToCanvas = useCallback(() => {
    if (tempFileIds.length === 0) {
      showToast('No files in Temp');
      return;
    }
    const targetId = currentFolderId === TEMP_FOLDER_ID ? null : currentFolderId;
    const moveInfos: FileMoveInfo[] = tempFiles.map(file => ({
      fileId: file.id,
      previousParentId: TEMP_FOLDER_ID as string | null,
      newParentId: targetId,
    }));
    moveFilesToFolder(tempFileIds, targetId);
    execute(createMoveFilesAction(moveInfos, targetId));
    showToast(`${tempFileIds.length} file(s) retrieved from Temp`);
  }, [tempFiles, tempFileIds, currentFolderId, moveFilesToFolder, execute, showToast]);

  const handleTempDelete = useCallback(() => {
    if (tempFileIds.length === 0) return;
    const moveInfos: FileMoveInfo[] = tempFiles.map(file => ({
      fileId: file.id,
      previousParentId: TEMP_FOLDER_ID as string | null,
      newParentId: 'trash',
    }));
    moveFilesToFolder(tempFileIds, 'trash');
    execute(createDeleteFilesAction(moveInfos));
    showToast(`${tempFileIds.length} file(s) deleted from Temp`);
  }, [tempFiles, tempFileIds, moveFilesToFolder, execute, showToast]);

  const handleTempShare = useCallback(async () => {
    if (tempFileIds.length === 0) {
      showToast('No files in Temp to share');
      return;
    }
    try {
      const message = `Check out these ${tempFileIds.length} file(s) from Zwipe Temp!`;
      const result = await Share.share({ message, title: 'Share Temp Files' });
      if (result.action === Share.sharedAction) {
        showToast('Shared successfully!');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to share');
    }
  }, [tempFileIds, showToast]);

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
    (id: string, pageX?: number, pageY?: number) => {
      draggingFolderId.value = id;
      isDrawing.value = false;

      // If caller supplied absolute touch coordinates (pageX/pageY), prefer those
      if (typeof pageX === 'number' && typeof pageY === 'number') {
        dragX.value = pageX;
        dragY.value = pageY;
        dropTargetFolderId.value = null;
        return;
      }

      try {
        const items = useLayoutStore.getState().getItems();
        const folderLayout = items.find(
          it => it.id === id && it.type === 'folder',
        );
        if (folderLayout) {
          // Convert registered folder layout (which is relative to the folder strip)
          // into absolute screen coordinates by adding the folder strip offsets
          const absX = folderStripX.value + (folderLayout.layout.x || 0) - folderStripScrollX.value + (folderLayout.layout.width || 0) / 2;
          const absY = folderStripY.value + (folderLayout.layout.y || 0) + (folderLayout.layout.height || 0) / 2;
          dragX.value = absX;
          dragY.value = absY;
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

  // Sync isDuplicationMode SharedValue → React state
  useAnimatedReaction(
    () => isDuplicationMode.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setIsDupMode)(current);
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
      // subtract half the ghost size so the ghost is centered at the pointer
      { translateX: dragX.value - 40 },
      { translateY: dragY.value - 40 },
      { scale: draggingFolderId.value ? 1.1 : 0 },
    ],
    opacity: draggingFolderId.value ? 1 : 0,
  }));

  // --- Gestures ---
  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .enabled(true)
    .onStart(e => {
      // Block pinch if drawing has been active for more than 0.5s
      if (isDrawing.value && drawingStartTime.value > 0) {
        const elapsed = Date.now() - drawingStartTime.value;
        if (elapsed >= 500) {
          return;
        }
      }
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
      // Block pinch if drawing has been active for more than 0.5s
      if (isDrawing.value && drawingStartTime.value > 0) {
        const elapsed = Date.now() - drawingStartTime.value;
        if (elapsed >= 500) {
          return;
        }
      }
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

      // Check if starting from temp zone
      const startZone = checkZoneIntersection(
        e.x,
        e.y,
        zoneBarLayout.value.y,
        zoneBarLayout.value.height,
        zoneBarLayout.value.width,
      );

      if (draggingFolderId.value) {
        isDrawing.value = false;
        drawingStartTime.value = 0;
        drawingFromTemp.value = false;
      } else if (startZone === 'temp') {
        // Drawing from temp zone
        drawingFromTemp.value = true;
        isDrawing.value = true;
        drawingStartTime.value = Date.now();
        runOnJS(handleGradientUpdate)('#8b5cf6', '#ffffff');
        activeSelection.value = [];
        pointsX.value = [e.x];
        pointsY.value = [e.y];
        startX.value = e.x;
        startY.value = e.y;
        currentX.value = e.x;
        currentY.value = e.y;
        path.value = `M ${e.x} ${e.y}`;
      } else {
        drawingFromTemp.value = false;
        isDrawing.value = true;
        drawingStartTime.value = Date.now();
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

        // Skip file intersection when drawing from temp zone
        if (!drawingFromTemp.value) {
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
        }

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
          // When in duplication mode and hovering a folder, keep green tint
          if (isDuplicationMode.value) {
            runOnJS(handleGradientUpdate)('#10b981', '#ffffff');
          } else {
            runOnJS(handleResetGradient)();
          }
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
            if (zoneType === 'copy') {
              // Entering copy zone activates duplication mode
              isDuplicationMode.value = true;
              runOnJS(handleGradientUpdate)(zoneColors[zoneType], '#ffffff');
            } else if (zoneType === 'temp' && isDuplicationMode.value) {
              // Temp zone + duplication mode: combined green+purple gradient
              runOnJS(handleGradientUpdate)('#10b981', '#8b5cf6');
            } else {
              runOnJS(handleGradientUpdate)(zoneColors[zoneType], '#ffffff');
            }
          } else if (!zoneType && hoveredZoneType.value !== null) {
            const previousZone = hoveredZoneType.value;
            hoveredZoneType.value = null;
            if (previousZone !== 'copy') {
              // When leaving any zone while in duplication mode, keep green tint
              if (isDuplicationMode.value) {
                runOnJS(handleGradientUpdate)('#10b981', '#ffffff');
              } else {
                runOnJS(handleResetGradient)();
              }
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
        if (drawingFromTemp.value) {
          // Drawing from temp zone - handle temp file operations
          if (currentZone === 'trash') {
            runOnJS(handleTempDelete)();
          } else if (targetFolderId) {
            runOnJS(handleTempDropToFolder)(targetFolderId);
          } else if (currentZone === 'share') {
            runOnJS(handleTempShare)();
          } else {
            // Ended on canvas - move temp files to current folder
            runOnJS(handleTempToCanvas)();
          }
        } else {
          const inDupMode = isDuplicationMode.value;
          const willPerformAction =
            (!inDupMode && currentZone === 'trash') || currentZone === 'temp' || targetFolderId !== null;

          if (!willPerformAction) {
            runOnJS(handleCommitSelection)();
          }

          if (currentZone === 'trash' && !inDupMode) {
            runOnJS(handleDeleteAction)();
          } else if (currentZone === 'temp') {
            runOnJS(handleMoveToTemp)();
          } else if (targetFolderId) {
            runOnJS(handleDropAction)(targetFolderId);
          } else if (currentZone === 'share') {
            runOnJS(handleShare)(false);
          }
        }
      }

      // Reset
      draggingFolderId.value = null;
      dropTargetFolderId.value = null;
      hoveredZoneType.value = null;
      drawingFromTemp.value = false;
      isDuplicationMode.value = false;
      dragX.value = 0;
      dragY.value = 0;

      if (autoScrollDir.value !== 0) {
        autoScrollDir.value = 0;
        runOnJS(stopFolderStripAutoScroll)();
      }

      runOnJS(handleResetGradient)();
      isDrawing.value = false;
      drawingStartTime.value = 0;
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
            onNewFolder={isTempView ? undefined : handleNewFolder}
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
          <ZoneBar
            hoveredZoneType={hoveredZoneType}
            tempFileCount={tempFileCount}
            onTempPress={handleTempPress}
            drawingFromTemp={drawingFromTemp}
            isDuplicationMode={isDuplicationMode}
          />
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
          <FileCanvas
            scale={scale}
            translateX={translateX}
            translateY={translateY}
            files={visibleFiles}
            selectedFileIds={selectedFileIds}
            onFileSelect={handleFileSelect}
            onPreview={handlePreview}
          />
          {/* upload moved into ActionBar */}
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

        {/* Image Preview Modal */}
        <Modal
          visible={!!selectedPreviewImage}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPreviewImage(null)}
        >
          <TouchableWithoutFeedback onPress={() => setSelectedPreviewImage(null)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableWithoutFeedback>
                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setSelectedPreviewImage(null)}
                    style={{ position: 'absolute', top: 40, right: 20, zIndex: 20 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 24 }}>✕</Text>
                  </TouchableOpacity>

                  {selectedPreviewImage && (
                    <Image
                      source={ typeof selectedPreviewImage === 'string' ? { uri: selectedPreviewImage } : selectedPreviewImage }
                      style={{ width: '92%', height: '80%' }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

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
          onUpload={handlePickImage}
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
