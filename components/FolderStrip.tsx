import { useFileSystemStore } from '@/store/useFileSystemStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { Folder } from '@/types';
import { Folder as FolderIcon, Plus } from 'lucide-react-native';
import React, { forwardRef, memo, useImperativeHandle, useMemo } from 'react';
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { ThemedView } from './themed-view';

interface FolderStripProps {
  folders: Folder[];
  onFolderPress: (folderId: string) => void;
  onNewFolder: () => void;
  onFolderLongPress: (id: string) => void;
  dropTargetFolderId?: SharedValue<string | null>;
  hoverColor?: string;
  // Report scroll X offset (in content pixels) to parent so worklets can use it for hit-testing
  onScrollXChange?: (x: number) => void;
}

interface FolderStats {
  directFolders: number;
  totalFolders: number;
  directFiles: number;
  totalFiles: number;
}

// Memoized folder card component with hover animation
const FolderCard = memo(function FolderCard({
  folder,
  stats,
  onPress,
  onLongPress,
  isDropTarget,
  hoverColor = '#f865c4',
}: {
  folder: Folder;
  stats: FolderStats;
  onPress: () => void;
  onLongPress: (id: string) => void;
  isDropTarget: SharedValue<boolean>;
  hoverColor?: string;
}) {
  const registerItem = useLayoutStore(s => s.registerItem);

  // Animated styles for hover effect
  const animatedContainerStyle = useAnimatedStyle(() => {
    const isHovered = isDropTarget.value;
    return {
      transform: [
        {
          scale: withSpring(isHovered ? 1.05 : 1, {
            damping: 20,
            stiffness: 180,
          }),
        },
      ],
      borderColor: isHovered ? hoverColor : '#fbbf24',
      borderWidth: withSpring(isHovered ? 3 : 1.5, {
        damping: 20,
        stiffness: 180,
      }),
      shadowColor: isHovered ? hoverColor : 'transparent',
      shadowOpacity: withSpring(isHovered ? 0.5 : 0, {
        damping: 20,
        stiffness: 180,
      }),
      shadowRadius: withSpring(isHovered ? 10 : 0, {
        damping: 20,
        stiffness: 180,
      }),
      shadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <Animated.View
      style={[styles.folderCard, animatedContainerStyle]}
      onLayout={e => registerItem(folder.id, 'folder', e.nativeEvent.layout)}
    >
      <TouchableOpacity
        style={styles.folderCardInner}
        onPress={onPress}
        onLongPress={() => onLongPress(folder.id)}
        activeOpacity={0.7}
      >
        <View style={styles.folderHeader}>
          <FolderIcon size={20} color='#fbbf24' fill='#fbbf24' />
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.name}
          </Text>
        </View>
        <View style={styles.folderStats}>
          <View style={styles.statRow}>
            <Text style={styles.statDirect}>{stats.directFolders}</Text>
            <Text style={styles.statSeparator}>|</Text>
            <Text style={styles.statTotal}>{stats.totalFolders}</Text>
            <Text style={styles.statLabel}>Folders</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statDirect}>{stats.directFiles}</Text>
            <Text style={styles.statSeparator}>|</Text>
            <Text style={styles.statTotal}>{stats.totalFiles}</Text>
            <Text style={styles.statLabel}>Files</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

export const FolderStrip = memo(
  forwardRef(function FolderStrip(
    {
      folders,
      onFolderPress,
      onNewFolder,
      onFolderLongPress,
      dropTargetFolderId,
      hoverColor = '#f865c4',
      onScrollXChange,
    }: FolderStripProps,
    ref: any,
  ) {
    const registerItem = useLayoutStore(state => state.registerItem);
    const allFiles = useFileSystemStore(state => state.files);
    const allFolders = useFileSystemStore(state => state.folders);

    const scrollRef = React.useRef<ScrollView | null>(null);
    const lastOffsetRef = React.useRef(0);
    const autoScrollRef = React.useRef<number | null>(null);

    const [contentWidth, setContentWidth] = React.useState(0);
    const [containerWidth, setContainerWidth] = React.useState(0);
    const [showRightArrow, setShowRightArrow] = React.useState(false);
    const [showLeftArrow, setShowLeftArrow] = React.useState(false);
    const [rightUsed, setRightUsed] = React.useState(false);

    // Calculate folder statistics
    const folderStats = useMemo(() => {
      const stats = new Map<string, FolderStats>();

      const calculateStats = (folderId: string): FolderStats => {
        if (stats.has(folderId)) return stats.get(folderId)!;

        const directFiles = allFiles.filter(
          f => f.parentId === folderId,
        ).length;
        const directFolders = allFolders.filter(f => f.parentId === folderId);

        let totalFiles = directFiles;
        let totalFolders = directFolders.length;

        for (const subFolder of directFolders) {
          const subStats = calculateStats(subFolder.id);
          totalFiles += subStats.totalFiles;
          totalFolders += subStats.totalFolders;
        }

        const result = {
          directFolders: directFolders.length,
          totalFolders,
          directFiles,
          totalFiles,
        };
        stats.set(folderId, result);
        return result;
      };

      folders.forEach(folder => calculateStats(folder.id));
      return stats;
    }, [folders, allFiles, allFolders]);

    useImperativeHandle(
      ref,
      () => ({
        scrollBy: (dx: number) => {
          const sv: any = scrollRef.current;
          if (!sv) return;
          const newX = Math.max(0, (lastOffsetRef.current || 0) + dx);
          sv.scrollTo({ x: newX, animated: true });
          lastOffsetRef.current = newX;
          if (typeof onScrollXChange === 'function') onScrollXChange(newX);
        },
        scrollTo: (x: number) => {
          const sv: any = scrollRef.current;
          if (!sv) return;
          const maxX = Math.max(0, contentWidth - containerWidth);
          const newX = Math.min(Math.max(0, x), maxX);
          sv.scrollTo({ x: newX, animated: true });
          lastOffsetRef.current = newX;
          if (typeof onScrollXChange === 'function') onScrollXChange(newX);
          setShowLeftArrow(newX > 0 || rightUsed);
          setShowRightArrow(
            contentWidth > containerWidth &&
              newX + containerWidth < contentWidth,
          );
        },
        scrollToStart: () => {
          const sv: any = scrollRef.current;
          if (!sv) return;
          const newX = 0;
          sv.scrollTo({ x: newX, animated: true });
          lastOffsetRef.current = newX;
          if (typeof onScrollXChange === 'function') onScrollXChange(newX);
          setShowLeftArrow(false);
          setShowRightArrow(
            contentWidth > containerWidth &&
              newX + containerWidth < contentWidth,
          );
        },
        startAutoScroll: (dir: number) => {
          if (autoScrollRef.current) {
            clearInterval(autoScrollRef.current);
            autoScrollRef.current = null;
          }
          autoScrollRef.current = setInterval(() => {
            const sv: any = scrollRef.current;
            if (!sv) return;
            const maxX = Math.max(0, contentWidth - containerWidth);
            const step = Math.max(8, Math.round(containerWidth * 0.06));
            let newX = (lastOffsetRef.current || 0) + dir * step;
            newX = Math.min(Math.max(0, newX), maxX);
            sv.scrollTo({ x: newX, animated: false });
            lastOffsetRef.current = newX;
            if (dir === 1) setRightUsed(true);
            setShowLeftArrow(newX > 0 || rightUsed);
            setShowRightArrow(
              contentWidth > containerWidth &&
                newX + containerWidth < contentWidth,
            );
            if (typeof onScrollXChange === 'function') onScrollXChange(newX);
          }, 80) as unknown as number;
        },
        stopAutoScroll: () => {
          if (autoScrollRef.current) {
            clearInterval(autoScrollRef.current);
            autoScrollRef.current = null;
          }
        },
      }),
      [contentWidth, containerWidth, rightUsed],
    );

    React.useEffect(() => {
      setShowRightArrow(contentWidth > containerWidth || folders.length >= 4);
    }, [contentWidth, containerWidth, folders.length]);

    const handleContentSizeChange = (w: number) => {
      setContentWidth(w);
      setShowRightArrow(w > containerWidth || folders.length >= 4);
    };

    const handleLayout = (e: LayoutChangeEvent) =>
      setContainerWidth(e.nativeEvent.layout.width);

    const handleScroll = (e: any) => {
      const x = e.nativeEvent.contentOffset.x;
      lastOffsetRef.current = x;
      // Inform parent of scroll delta for accurate hit-testing
      if (typeof onScrollXChange === 'function') {
        onScrollXChange(x);
      }
      setShowLeftArrow(x > 0 || rightUsed);
      setShowRightArrow(
        contentWidth > containerWidth && x + containerWidth < contentWidth,
      );
    };

    const onPressRight = () => {
      const sv: any = scrollRef.current;
      if (!sv) return;
      const newX = Math.min(
        contentWidth - containerWidth,
        (lastOffsetRef.current || 0) + Math.round(containerWidth * 0.6),
      );
      sv.scrollTo({ x: newX, animated: true });
      lastOffsetRef.current = newX;
      setRightUsed(true);
      setShowLeftArrow(true);
      setShowRightArrow(newX + containerWidth < contentWidth);
    };

    const onPressLeft = () => {
      const sv: any = scrollRef.current;
      if (!sv) return;
      const newX = Math.max(
        0,
        (lastOffsetRef.current || 0) - Math.round(containerWidth * 0.6),
      );
      sv.scrollTo({ x: newX, animated: true });
      lastOffsetRef.current = newX;
      setShowRightArrow(
        contentWidth > containerWidth && newX + containerWidth < contentWidth,
      );
      setShowLeftArrow(newX > 0 || rightUsed);
    };

    return (
      <ThemedView
        style={styles.container}
        onLayout={e => {
          registerItem(
            'folder-strip',
            'zone',
            e.nativeEvent.layout,
            'folder-strip',
          );
        }}
      >
        {/* Folder List with New Button */}
        <View style={styles.folderHeader2}>
          <TouchableOpacity style={styles.newButton} onPress={onNewFolder}>
            <Plus size={16} color='#3b82f6' />
            <Text style={styles.newButtonText}>New</Text>
          </TouchableOpacity>
          {folders.length > 0 && (
            <View style={styles.folderCount}>
              <FolderIcon size={14} color='#64748b' />
              <Text style={styles.folderCountText}>{folders.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.stripContainer} onLayout={handleLayout}>


          {/* Folder List */}
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={true}
            persistentScrollbar={true}
            contentContainerStyle={styles.folderScroll}
            style={styles.scrollView}
            onContentSizeChange={(w, h) => handleContentSizeChange(w)}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps='handled'
            nestedScrollEnabled={true}
            scrollEnabled={true}
          >
            {folders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No folders yet</Text>
              </View>
            ) : (
              folders.map(folder => (
                <FolderCardWrapper
                  key={folder.id}
                  folder={folder}
                  stats={
                    folderStats.get(folder.id) || {
                      directFolders: 0,
                      totalFolders: 0,
                      directFiles: 0,
                      totalFiles: 0,
                    }
                  }
                  onPress={() => onFolderPress(folder.id)}
                  onLongPress={onFolderLongPress}
                  dropTargetFolderId={dropTargetFolderId}
                  hoverColor={hoverColor}
                />
              ))
            )}

          </ScrollView>

        </View>
      </ThemedView>
    );
  }),
);

// Wrapper component to create derived value for each folder
const FolderCardWrapper = memo(function FolderCardWrapper({
  folder,
  stats,
  onPress,
  onLongPress,
  dropTargetFolderId,
  hoverColor = '#f865c4',
}: {
  folder: Folder;
  stats: FolderStats;
  onPress: () => void;
  onLongPress: (id: string) => void;
  dropTargetFolderId?: SharedValue<string | null>;
  hoverColor?: string;
}) {
  const isDropTarget = useDerivedValue(() => {
    return dropTargetFolderId?.value === folder.id;
  });

  return (
    <FolderCard
      folder={folder}
      stats={stats}
      onPress={onPress}
      onLongPress={onLongPress}
      isDropTarget={isDropTarget}
      hoverColor={hoverColor}
    />
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0D1526',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  folderHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  newButtonText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  folderCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  folderCountText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  folderScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  scrollView: {
    minHeight: 100,
  },
  folderCard: {
    width: 120,
    height: 76,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    marginRight: 12,
  },
  folderCardInner: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  folderName: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginLeft: 6,
  },
  folderStats: {
    gap: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statDirect: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '600',
    minWidth: 12,
  },
  statSeparator: {
    color: '#475569',
    fontSize: 10,
  },
  statTotal: {
    color: '#64748b',
    fontSize: 10,
    minWidth: 12,
  },
  statLabel: {
    color: '#64748b',
    fontSize: 9,
    marginLeft: 2,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
  },
  stripContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  leftArrow: {
    position: 'absolute',
    left: 6,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightArrow: {
    position: 'absolute',
    right: 6,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    width: 20,
    height: 20,
    tintColor: '#cbd5e1',
    resizeMode: 'contain',
  },
  newFolderCard: {
    width: 120,
    height: 76,
    marginRight: 12,
    backgroundColor: '#0b1220',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newFolderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newFolderText: {
    color: '#64748b',
    fontSize: 12,
  },
});
