import { FileSystemItem } from '@/types';
import { Archive, File, FileSpreadsheet, FileText, Film, Image as ImageIcon, Music } from 'lucide-react-native';
import { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface FileItemProps {
  file: FileSystemItem;
  isSelected: boolean;
  selectionColor?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
}

export const FileItem = memo(function FileItem({ file, isSelected, selectionColor = '#576ffb', onPress, onLongPress, onLayout }: FileItemProps) {
  const selected = useSharedValue(isSelected ? 1 : 0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    selected.value = isSelected ? 1 : 0;
  }, [isSelected, selected]);
  const fileExtension = file.extension?.toLowerCase();
  
  const getFileIcon = () => {
    const size = 32;
    const color = '#94a3b8';
    
    switch (fileExtension) {
      case 'pdf':
        return <FileText size={size} color="#ef4444" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
      case 'heic':
      case 'heif':
        return <ImageIcon size={size} color="#10b981" />;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
        return <Film size={size} color="#8b5cf6" />;
      case 'mp3':
      case 'wav':
      case 'flac':
        return <Music size={size} color="#f59e0b" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive size={size} color="#64748b" />;
      case 'txt':
        return <FileText size={size} color={color} />;
      case 'doc':
      case 'docx':
        return <FileText size={size} color="#3b82f6" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet size={size} color="#10b981" />;
      case 'pptx':
      case 'ppt':
        return <FileText size={size} color="#f97316" />;
      default:
        return <File size={size} color={color} />;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(selected.value ? 1.1 : 1, { damping: 12, stiffness: 180 }) },
      ],
    };
  });

  const truncateFilename = (name: string, maxMainChars: number = 8) => {
    // If there's no extension, do a simple truncate
    if (!name.includes('.')) {
      if (name.length <= maxMainChars) return name;
      return `${name.substring(0, maxMainChars)}...`;
    }

    const ext = name.split('.').pop()!;
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));

    if (nameWithoutExt.length <= maxMainChars) return name;

    const truncated = nameWithoutExt.substring(0, maxMainChars);
    return `${truncated}...${ext}`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { left: file.x, top: file.y },
        animatedStyle,
      ]}
      onLayout={(e) => {
        if (onLayout) {
          const layout = e.nativeEvent.layout;
          onLayout({
            x: file.x,
            y: file.y,
            width: layout.width,
            height: layout.height,
          });
        }
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.card,
            isSelected && {
              borderColor: selectionColor,
              borderWidth: 3,
              shadowColor: selectionColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.9,
              shadowRadius: 12,
              elevation: 10,
            },
          ]}
        >
          {/* Preview for images */}
          {(fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png' || fileExtension === 'gif' || fileExtension === 'webp' || fileExtension === 'heic' || fileExtension === 'heif') ? (
            <View style={styles.imagePreview}>
              {(file as any).asset && !imageError ? (
                <Image
                  source={
                    typeof (file as any).asset === 'number'
                      ? (file as any).asset
                      : typeof (file as any).asset === 'object' && (file as any).asset.uri
                        ? { uri: (file as any).asset.uri }
                        : (file as any).asset
                  }
                  style={styles.image}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                getFileIcon()
              )}
            </View>
          ) : (
            <View style={styles.iconContainer}>{getFileIcon()}</View>
          )}
          
          <Text style={styles.name} numberOfLines={2}>
            {truncateFilename(file.name)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
})

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 100,
    height: 100,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 20, // More rounded for square appearance
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 12, // More rounded
    backgroundColor: '#0f172a',
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  iconContainer: {
    marginBottom: 4,
  },
  name: {
    fontSize: 11,
    textAlign: 'center',
    color: '#e2e8f0',
    fontWeight: '500',
  },
});

