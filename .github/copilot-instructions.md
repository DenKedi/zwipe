# Zwipe - AI Coding Agent Instructions

## Project Overview

Zwipe is a gesture-based file management mobile app (Expo SDK 54, React Native 0.81, React 19). Users draw lines across files on an infinite 2D canvas to multi-select them, then drag to folders/zones (trash, temp, duplicate, share).

**Run**: `npm install && npx expo start` (press `i`/`a`/`w` for iOS/Android/web)

**Note**: This is a frontend dummy with mock data - no actual file system integration. Future versions may connect to Amazon S3 or Google Drive.

## App Layout (Top to Bottom)

1. **Folder Section (~20%)**: Horizontal scrollable strip + breadcrumb navigation
2. **Zone Bar**: Action zones between folders and canvas (trash, temp, duplicate, share)
3. **File Canvas (~70%)**: Infinite zoomable 2D grid where files are positioned

## Core Interaction: Drawing Multi-Selection

1. Click + drag on canvas background → draws glowing gradient line (blue `#576ffb` → pink `#f865c4`)
2. Files the line touches → selected (border glow + slight scale up)
3. Release → selection persists
4. Draw again → accumulative selection
5. Drag selection to folder/zone → batch action

**Visual feedback**: Start point has blue dot, end point follows finger. Selected files inherit line color at intersection point.

## Architecture

### Component Hierarchy

```
app/(tabs)/index.tsx     # Main screen - orchestrates gestures, state, modals
├── FolderStrip          # Top: horizontal folder bar with breadcrumbs
├── ZoneBar              # Action zones (trash, temp, copy, share)
├── FileCanvas           # Infinite zoomable grid with files
└── DrawingLayer         # SVG path rendering for gesture lines
```

### State Management Pattern

- **Zustand stores** (`store/`): Global state - no Provider, direct imports
  - `useFileSystemStore`: Files/folders CRUD, hierarchical navigation
  - `useLayoutStore`: Component layout registry for collision detection
- **Custom hooks** (`hooks/`): Business logic wrappers
  - `useFileSystem`: Wraps store with auto-initialization + factory methods
  - `useSelection`: Drawing state + intersection detection
- **Reanimated SharedValues**: Gesture/animation state on worklet thread

### Critical Gesture Pattern

Gestures run on worklet thread - **no direct React state in gesture callbacks**:

```tsx
// In app/(tabs)/index.tsx
const scale = useSharedValue(1);
const savedScale = useSharedValue(1); // Persist between gestures

const pinchGesture = Gesture.Pinch()
  .onStart(() => {
    /* read savedScale.value */
  })
  .onEnd(() => {
    savedScale.value = scale.value;
  }); // Save state

const panGesture = Gesture.Pan().minPointers(1).maxPointers(1); // Drawing
```

Use `runOnJS()` to bridge worklet → React state.

### Layout Registration (for collision detection)

Components register their bounds via `useLayoutStore`:

```tsx
onLayout={(e) => registerItem('zone-trash', 'zone', e.nativeEvent.layout, 'trash')}
```

### SVG Path Generation

Drawing uses smooth quadratic bezier curves from point arrays:

```tsx
// Build path from accumulated points
path.value = `M ${x0} ${y0} Q ${x1} ${y1} ${xc} ${yc} ...`;
```

See `DrawingLayer.tsx` for gradient + glow effect implementation.

## Key Conventions

### Files & Imports

- **Path alias**: `@/` → project root (e.g., `import { FileSystemItem } from '@/types'`)
- **Types**: Define shared interfaces in `types/index.ts`

### Theming

- Themed components: `ThemedView`, `ThemedText` with `lightColor`/`darkColor` props
- Dark canvas: `#0f172a`, grid dots: `#334155`
- Drawing gradient: `#576ffb` → `#f865c4`

### Styling

- `StyleSheet.create()` at component bottom
- Files: 100x100px rounded squares with `borderRadius: 20`

## Common Tasks

### Add a new zone type

1. Add to `ZoneType` union in `types/index.ts`
2. Add to `LayoutItem['zoneType']` in `store/useLayoutStore.ts`
3. Implement zone UI in `components/ZoneBar.tsx`
4. Handle action in gesture end handler in `app/(tabs)/index.tsx`

### Add new file actions

1. Create action in `useFileSystemStore` (immutable state updates)
2. Expose via `useFileSystem` hook
3. Call from gesture/UI handlers using `runOnJS()` if in worklet

## Dependencies Notes

- **Reanimated 4.1**: `'worklet'` directive required for gesture handlers
- **Lucide icons**: Prefer over `@expo/vector-icons` for custom icons
- **Zustand 5**: Direct store imports, no Provider wrapper
- **Web limitations**: Multi-touch gestures don't work - test zoom/pan on device
- **GestureHandlerRootView**: Required wrapper in `app/_layout.tsx`
