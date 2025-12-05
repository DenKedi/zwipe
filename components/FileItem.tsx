import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { FileSystemItem } from '@/types';
import { FileText, Image as ImageIcon, File, FileSpreadsheet } from 'lucide-react-native';

interface FileItemProps {
  file: FileSystemItem;
  isSelected: boolean;
  selectionColor?: string;
  onPress?: () => void;
  onLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
}

export function FileItem({ file, isSelected, selectionColor = '#576ffb', onPress, onLayout }: FileItemProps) {
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
        return <ImageIcon size={size} color="#10b981" />;
      case 'txt':
        return <FileText size={size} color={color} />;
      case 'doc':
      case 'docx':
        return <FileText size={size} color="#3b82f6" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet size={size} color="#10b981" />;
      default:
        return <File size={size} color={color} />;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(isSelected ? 1.08 : 1) },
      ],
    };
  });

  const truncateFilename = (name: string, maxLength: number = 15) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop();
    const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
    const truncated = nameWithoutExt.substring(0, maxLength - ext!.length - 4);
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
              shadowOpacity: 0.8,
              shadowRadius: 8,
              elevation: 8,
            },
          ]}
        >
        {/* Preview for images */}
        {(fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png') ? (
          <View style={styles.imagePreview}>
            {getFileIcon()}
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
}

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

