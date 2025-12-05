import { StyleSheet, View, Text, Image } from 'react-native';
import { ThemedView } from './themed-view';
import { useLayoutStore } from '@/store/useLayoutStore';
import { Zone } from '@/types';

const zones: Zone[] = [
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

export function ZoneBar() {
  const registerItem = useLayoutStore((state) => state.registerItem);

  return (
    <ThemedView 
      style={styles.container}
      onLayout={(e) => {
        registerItem('zone-bar', 'zone', e.nativeEvent.layout);
      }}
    >
      {zones.map((zone) => (
        <View
          key={zone.id}
          style={styles.zoneItem}
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
        >
          <View style={[styles.iconBox, { borderColor: zone.color }]}>
            <Image 
              source={iconMap[zone.icon]} 
              style={[styles.icon, { tintColor: zone.color }]}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.zoneLabel}>{zone.label}</Text>
        </View>
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

