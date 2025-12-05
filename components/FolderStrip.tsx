import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedView } from './themed-view';
import { useLayoutStore } from '@/store/useLayoutStore';
import { Folder } from '@/types';
import { Plus, Folder as FolderIcon } from 'lucide-react-native';

interface FolderStripProps {
  folders: Folder[];
  onFolderPress: (folderId: string) => void;
  onNewFolder: () => void;
}

export function FolderStrip({ 
  folders, 
  onFolderPress, 
  onNewFolder 
}: FolderStripProps) {
  const registerItem = useLayoutStore((state) => state.registerItem);

  return (
    <ThemedView 
      style={styles.container} 
      onLayout={(e) => {
        registerItem('folder-strip', 'zone', e.nativeEvent.layout, 'folder-strip');
      }}
    >
      {/* Folder List with New Button */}
      <View style={styles.folderHeader}>
        <TouchableOpacity style={styles.newButton} onPress={onNewFolder}>
          <Plus size={16} color="#3b82f6" />
          <Text style={styles.newButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Folder List */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.folderScroll}
        style={styles.scrollView}
      >
        {/* Folder Items */}
        {folders.map((folder) => {
          return (
            <TouchableOpacity
              key={folder.id}
              style={styles.folderCard}
              onPress={() => onFolderPress(folder.id)}
            >
              <FolderIcon size={24} color="#fbbf24" fill="#fbbf24" />
              <Text style={styles.folderName} numberOfLines={1}>
                {folder.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0D1526',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
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
  folderScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  scrollView: {
    minHeight: 84, // 60 (card) + 24 (padding)
  },
  folderCard: {
    width: 100,
    height: 60,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  folderName: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});

