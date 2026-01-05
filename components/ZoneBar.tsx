import { StyleSheet, View, Text, Image } from 'react-native';
import { ThemedView } from './themed-view';
import { useLayoutStore } from '@/store/useLayoutStore';
import { Zone, ZoneType } from '@/types';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  SharedValue,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

export const zones: Zone[] = [
  { id: 'trash', type: 'trash', label: 'Delete', color: '#ef4444', icon: 'trash' },
  { id: 'temp', type: 'temp', label: 'Temp', color: '#8b5cf6', icon: 'temp' },
  { id: 'copy', type: 'copy', label: 'Duplicate', color: '#10b981', icon: 'duplicate' },
  { id: 'share', type: 'share', label: 'Share', color: '#3b82f6', icon: 'share' },
];

const iconMap: { [key: string]: any } = {
  trash: require('@/assets/icons/dark/trash.png'),
  temp: require('@/assets/icons/dark/temp.png'),
  duplicate: require('@/assets/icons/dark/duplicate.png'),
  share: require('@/assets/icons/dark/share.png'),
};

interface ZoneBarProps {
  hoveredZoneType?: SharedValue<ZoneType | null>;
}

interface ZoneItemProps {
  zone: Zone;
  isHovered: SharedValue<boolean>;
  onLayout: (e: any) => void;
}

function ZoneItem({ zone, isHovered, onLayout }: ZoneItemProps) {
  const isDuplicate = zone.type === 'copy';
  
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(isHovered.value ? 1.15 : 1, { damping: 20, stiffness: 150 }) },
      ],
    };
  });

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isHovered.value ? 0.125 : 0, { duration: 200 }),
    };
  });

  if (isDuplicate) {
    // Gate-style borders for Duplicate zone
    return (
      <Animated.View
        style={[styles.zoneItem, animatedContainerStyle]}
        onLayout={onLayout}
      >
        <View style={styles.gateContainer}>
          <View style={[styles.gateBracket, { backgroundColor: zone.color }]}>
            <Animated.View style={[styles.gateBracketBackground, { backgroundColor: zone.color }, animatedBackgroundStyle]} />
          </View>
          <Image 
            source={iconMap[zone.icon]} 
            style={[styles.icon, { tintColor: zone.color }]}
            resizeMode="contain"
          />
          <View style={[styles.gateBracket, { backgroundColor: zone.color }]}>
            <Animated.View style={[styles.gateBracketBackground, { backgroundColor: zone.color }, animatedBackgroundStyle]} />
          </View>
        </View>
        <Text style={styles.zoneLabel}>{zone.label}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.zoneItem, animatedContainerStyle]}
      onLayout={onLayout}
    >
      <View style={[styles.iconBox, { borderColor: zone.color }]}>
        <Animated.View style={[styles.iconBoxBackground, { backgroundColor: zone.color }, animatedBackgroundStyle]} />
        <Image 
          source={iconMap[zone.icon]} 
          style={[styles.icon, { tintColor: zone.color }]}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.zoneLabel}>{zone.label}</Text>
    </Animated.View>
  );
}

export function ZoneBar({ hoveredZoneType }: ZoneBarProps) {
  const registerItem = useLayoutStore((state) => state.registerItem);
  
  // Fallback shared value when hoveredZoneType is not provided
  const fallbackHovered = useSharedValue<ZoneType | null>(null);
  const activeHoveredType = hoveredZoneType ?? fallbackHovered;

  // Create derived values for each zone's hover state
  const trashHovered = useDerivedValue(() => activeHoveredType.value === 'trash');
  const tempHovered = useDerivedValue(() => activeHoveredType.value === 'temp');
  const copyHovered = useDerivedValue(() => activeHoveredType.value === 'copy');
  const shareHovered = useDerivedValue(() => activeHoveredType.value === 'share');

  const hoverMap: Record<ZoneType, SharedValue<boolean>> = {
    'trash': trashHovered,
    'temp': tempHovered,
    'copy': copyHovered,
    'share': shareHovered,
    'folder-strip': trashHovered, // Not used but needed for type
  };

  return (
    <ThemedView 
      style={styles.container}
      onLayout={(e) => {
        registerItem('zone-bar', 'zone', e.nativeEvent.layout);
      }}
    >
      {zones.map((zone) => (
        <ZoneItem
          key={zone.id}
          zone={zone}
          isHovered={hoverMap[zone.type]}
          onLayout={(e) => {
            const layout = e.nativeEvent.layout;
            registerItem(
              `zone-${zone.id}`, 
              'zone', 
              {
                x: layout.x,
                y: layout.y,
                width: layout.width,
                height: layout.height,
              },
              zone.type
            );
          }}
        />
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingHorizontal: 32,
    paddingVertical: 24,
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#334155',
  },
  zoneItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconBoxBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
  },
  gateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 54,
    gap: 12,
  },
  gateBracket: {
    width: 5,
    height: 54,
    borderRadius: 3,
    overflow: 'hidden',
  },
  gateBracketBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  icon: {
    width: 28,
    height: 28,
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
});

