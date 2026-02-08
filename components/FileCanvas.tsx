import { FileSystemItem } from '@/types';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    SharedValue,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { FileItem } from './FileItem';
import { ThemedView } from './themed-view';

interface FileCanvasProps {
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  files: FileSystemItem[];
  selectedFileIds: string[];
  onFileSelect?: (fileId: string) => void;
  onPreview?: (file: FileSystemItem) => void;
}

export function FileCanvas({ 
  scale, 
  translateX, 
  translateY,
  files,
  selectedFileIds,
  onFileSelect,
  onPreview,
}: FileCanvasProps) {
  // Optimized: Reduced from 50x50 (2500 views) to 10x10 (100 views) for better performance
  const gridSpacing = 200;
  const gridSize = 10;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const gridDots = useMemo(() => {
    const dots = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        dots.push(
          <View
            key={`dot-${row}-${col}`}
            style={[
              styles.dot,
              {
                left: col * gridSpacing,
                top: row * gridSpacing,
              },
            ]}
          />
        );
      }
    }
    return dots;
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.gestureArea}>
        <Animated.View style={[styles.grid, animatedStyle]}>
          {gridDots}
          
          {/* Render Files */}
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              isSelected={selectedFileIds.includes(file.id)}
              selectionColor="#576ffb"
              onPress={onPreview ? () => onPreview(file) : onFileSelect ? () => onFileSelect(file.id) : undefined}
              onLongPress={onFileSelect ? () => onFileSelect(file.id) : undefined}
            />
          ))}
        </Animated.View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  gestureArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  grid: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
    opacity: 0.8,
  },
});

