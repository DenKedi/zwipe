import { useFileSystemStore } from '@/store/useFileSystemStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { Folder } from '@/types';
import { Folder as FolderIcon, Plus } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring
} from 'react-native-reanimated';
import { ThemedView } from './themed-view';

interface FolderStripProps {
  folders: Folder[];
  onFolderPress: (folderId: string) => void;
  onNewFolder: () => void;
  onFolderLongPress: (id: string) => void;
  dropTargetFolderId?: SharedValue<string | null>;
  hoverColor?: string;
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
  // Animated styles for hover effect
  const animatedContainerStyle = useAnimatedStyle(() => {
    const isHovered = isDropTarget.value;
    return {
      transform: [
        { scale: withSpring(isHovered ? 1.05 : 1, { damping: 20, stiffness: 180 }) },
      ],
      borderColor: isHovered ? hoverColor : '#fbbf24',
      borderWidth: withSpring(isHovered ? 3 : 1.5, { damping: 20, stiffness: 180 }),
      shadowColor: isHovered ? hoverColor : 'transparent',
      shadowOpacity: withSpring(isHovered ? 0.5 : 0, { damping: 20, stiffness: 180 }),
      shadowRadius: withSpring(isHovered ? 10 : 0, { damping: 20, stiffness: 180 }),
      shadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <Animated.View style={[styles.folderCard, animatedContainerStyle]}>
      <TouchableOpacity
        style={styles.folderCardInner}
        onPress={onPress}
        onLongPress={() => onLongPress(folder.id)}
        activeOpacity={0.7}
      >
        <View style={styles.folderHeader}>
          <FolderIcon size={20} color="#fbbf24" fill="#fbbf24" />
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

export const FolderStrip = memo(function FolderStrip({ 
  folders, 
  onFolderPress, 
  onNewFolder,
  onFolderLongPress,
  dropTargetFolderId,
  hoverColor = '#f865c4',
}: FolderStripProps) {
  const registerItem = useLayoutStore((state) => state.registerItem);
  const allFiles = useFileSystemStore((state) => state.files);
  const allFolders = useFileSystemStore((state) => state.folders);

  // Calculate folder statistics
  const folderStats = useMemo(() => {
    const stats = new Map<string, FolderStats>();
    
    const calculateStats = (folderId: string): FolderStats => {
      if (stats.has(folderId)) return stats.get(folderId)!;
      
      const directFiles = allFiles.filter(f => f.parentId === folderId).length;
      const directFolders = allFolders.filter(f => f.parentId === folderId);
      
      let totalFiles = directFiles;
      let totalFolders = directFolders.length;
      
      for (const subFolder of directFolders) {
        const subStats = calculateStats(subFolder.id);
        totalFiles += subStats.totalFiles;
        totalFolders += subStats.totalFolders;
      }
      
      const result = { directFolders: directFolders.length, totalFolders, directFiles, totalFiles };
      stats.set(folderId, result);
      return result;
    };
    
    folders.forEach(folder => calculateStats(folder.id));
    return stats;
  }, [folders, allFiles, allFolders]);

  return (
    <ThemedView 
      style={styles.container} 
      onLayout={(e) => {
        registerItem('folder-strip', 'zone', e.nativeEvent.layout, 'folder-strip');
      }}
    >
      {/* Folder List with New Button */}
      <View style={styles.folderHeader2}>
        <TouchableOpacity style={styles.newButton} onPress={onNewFolder}>
          <Plus size={16} color="#3b82f6" />
          <Text style={styles.newButtonText}>New</Text>
        </TouchableOpacity>
        {folders.length > 0 && (
          <View style={styles.folderCount}>
            <FolderIcon size={14} color="#64748b" />
            <Text style={styles.folderCountText}>{folders.length}</Text>
          </View>
        )}
      </View>

      {/* Folder List */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.folderScroll}
        style={styles.scrollView}
      >
        {folders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No folders yet</Text>
          </View>
        ) : (
          folders.map((folder) => (
            <FolderCardWrapper
              key={folder.id}
              folder={folder}
              stats={folderStats.get(folder.id) || { directFolders: 0, totalFolders: 0, directFiles: 0, totalFiles: 0 }}
              onPress={() => onFolderPress(folder.id)}
              onLongPress={onFolderLongPress}
              dropTargetFolderId={dropTargetFolderId}
              hoverColor={hoverColor}
            />
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
});

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
});

