import { create } from 'zustand';
import { LayoutRectangle } from 'react-native';

interface LayoutItem {
  id: string;
  type: 'file' | 'folder' | 'zone';
  layout: LayoutRectangle;
  zoneType?: 'trash' | 'temp' | 'copy' | 'share' | 'folder-strip';
}

interface LayoutState {
  items: Record<string, LayoutItem>;
  registerItem: (
    id: string,
    type: LayoutItem['type'],
    layout: LayoutRectangle,
    zoneType?: LayoutItem['zoneType']
  ) => void;
  unregisterItem: (id: string) => void;
  getItems: () => LayoutItem[];
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  items: {},
  registerItem: (id, type, layout, zoneType) => {
    set(state => ({
      items: {
        ...state.items,
        [id]: { id, type, layout, zoneType },
      },
    }));
  },
  unregisterItem: id => {
    set(state => {
      const newItems = { ...state.items };
      delete newItems[id];
      return { items: newItems };
    });
  },
  getItems: () => Object.values(get().items),
}));
