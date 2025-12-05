# Zwipe - AI Coding Agent Instructions

## Project Overview

Zwipe is a gesture-based file management mobile app built with Expo/React Native. It provides a unique 2D canvas interface for organizing files and folders through drawing-based multi-selection. Users draw lines across files on an infinite canvas to select and move them to folders/zones. Core interaction: pan gestures for drawing selection paths, pinch for zoom/pan on canvas.

## App Concept

### File & Directory Management

**Files**: Support for common file types (images, videos, documents, PDFs)
**Folders**: Nested folder structures with unlimited depth (folders within folders)
**Visual Positioning**: Files and folders are freely positioned on a 2D canvas
**Breadcrumb Navigation**: Shows current path (Home → Folder → Subfolder)

**Storage**: Frontend uses mock data (`constants/mockData.ts`). Future versions may integrate with cloud storage (Amazon S3, Google Drive).

### Core Features

#### 1. The Folder Section (~15% vertical space)

**Display**:

- Horizontal scrollable strip at top of screen
- Shows folders at current directory level
- Breadcrumb path shows navigation hierarchy: `[Home > Folder > Subfolder]`
- Click any breadcrumb segment → navigate to that level
- Supports infinite nesting depth

**Folder Statistics** (displayed on each folder card):

```
1 | 2  Folders
3 | 12 Files
```

- First number: Direct children in this folder
- Second number: Accumulated count including all subdirectories

**Interactions**:

- **Single click**: Opens folder, loads its contents on canvas
- **1-2 second hold**: Opens context menu (rename, open, share, delete, duplicate)
- **Drag folder into folder**: Creates subfolder relationship
- **Drag horizontally**: Scroll through folders
- **"New Folder" button**: Creates folder in current directory

#### 2. The Zone Bar (~15% vertical space)

Located between folder strip and canvas. Contains 4 action zones:

- **Trash**: Delete files/folders (with confirmation prompt)
- **Temp**: Temporary storage
- **Duplicate**: Copy files/folders
- **Share**: Share functionality

Visual: Dashed borders, icons from `assets/icons/dark/`, zone names below icons.

#### 3. File Display - 2D Canvas (~70% vertical space)

**Canvas Features**:

- Infinite 2D scrollable/zoomable space
- Grid background with dots
- Standard map-like zoom/pan controls (pinch to zoom, two-finger pan)
- Files positioned at (x, y) coordinates

**File Visualization**:

- Rounded rectangle containers
- File type icons (PDF, image, document, etc.)
- Image files: Show thumbnail previews
- Text truncation for long filenames
- Visual grouping by file type (create "islands")
- Sorting options: name, size, date uploaded

**File Interactions**:

- **Single short click**: Preview or open file (depends on type)
- **1-2 second hold**: Context menu (rename, open, share, delete, duplicate, show properties)
- **Click + immediate drag**: Activates drawing selection mode

#### 4. Drawing-Based Multi-Selection (Unique Standout Feature)

**How It Works**:

1. Click and drag on canvas background → draws a glowing line
2. Any file the line touches → gets selected
3. Release gesture → selection stays active
4. Draw another line → adds MORE files to selection (accumulative)
5. Drag selected files to folder/zone → all move together

**Visual Feedback**:

- **The Line**:
  - Starts with blue dot at origin
  - Gradients from blue (`#576ffb`) to bright pink (`#f865c4`)
  - End point has dot (current finger position)
  - Line color changes when passing through zones
- **Selected Files**:
  - Border color matches the line color where it intersected
  - Slight size increase (scale up animation)
  - Glowing border effect

**Selection Persistence**:

- Selections accumulate across multiple drawing gestures
- Clear selection: Clear button or start new action
- Selection survives canvas zoom/pan operations

**Line Color Behavior**:

- Default: Blue to pink gradient
- Passes through trash zone: Red tint
- Passes through temp zone: Yellow tint
- Passes through duplicate zone: Green tint
- Passes through share zone: Purple tint

#### 5. Undo/Redo System

Every action adds to action stack:

- Selection changes
- Moving files/folders
- Deleting items
- Duplicating items
- Creating folders
- Renaming items

Standard Ctrl+Z (undo) and Ctrl+Shift+Z (redo) behavior.

### Special Cases & Edge Cases

**Folder Behaviors**:

- Folder dragged into folder → Becomes subfolder
- Folder dragged into trash → Delete prompt ("Are you sure?")
- Folder dragged into temp → Works like regular file
- Folder + duplicate → Creates copy of folder structure

**Breadcrumb Interactions**:

- Drag file/folder onto breadcrumb segment → Moves to that directory level

**Text Handling**:

- Long filenames → Truncated with ellipsis (...)
- Full name visible on hover/long-press

**Selection Edge Cases**:

- Drawing line through partially visible file → Still selects
- Drawing through nested folders → Selects folder, not contents
- Empty selection → No action on zone drop

## Architecture

### State Management Architecture

- **Zustand stores**: Global state (see `store/useLayoutStore.ts` for layout registry pattern)
- **Custom hooks**: Local state + business logic (see `hooks/useFileSystem.ts`, `hooks/useSelection.ts`)
- **Shared values**: Reanimated's `useSharedValue` for gesture/animation state (worklet thread)

**Critical**: Gesture handlers use `'worklet'` directive - state updates must use `.value` syntax, no direct React state in gesture callbacks.

### Component Structure

```
app/(tabs)/index.tsx          # Main screen - orchestrates gestures & state
├── FileCanvas                # Infinite grid canvas with zoom/pan controls
├── DrawingLayer              # SVG path rendering for gesture selections
├── FolderStrip               # Top bar for folder zones
└── ZoneBar                   # Bottom bar for action zones (trash, temp, copy, share)
```

### Key Patterns

**1. Gesture State Separation**

- Canvas transformation: `scale`, `translateX/Y` (pinch gesture, 2 fingers)
- Drawing state: `path`, `startX/Y`, `currentX/Y`, `pointsX/Y` (pan gesture, 1 finger)
- Always separate saved values (`savedScale`) from animated values for gesture continuity

Example from `app/(tabs)/index.tsx`:

```tsx
const scale = useSharedValue(1);
const savedScale = useSharedValue(1); // Persists between gestures

const pinchGesture = Gesture.Pinch()
  .onStart(e => {
    pinchStartValues.current = {
      scale: savedScale.value, // Start from last saved state
      // ...
    };
  })
  .onEnd(() => {
    savedScale.value = scale.value; // Save for next gesture
  });
```

**2. Layout Registration System**
Uses Zustand store to track component layouts for collision detection:

```tsx
// In any positioned component:
onLayout={(e) => {
  registerItem('unique-id', 'zone', e.nativeEvent.layout, 'folder-strip');
}}
```

Used by `useSelection` to detect when drawn paths intersect with files/zones.

**3. SVG Path Generation for Gestures**
Smooth quadratic bezier curves from point arrays (see `app/(tabs)/index.tsx` lines 130-145):

```tsx
path.value = `M ${x0} ${y0} Q ${x1} ${y1} ${xc} ${yc} ...`;
```

**4. File System Hooks Pattern**
`useFileSystem` provides CRUD operations, `useSelection` handles gesture-to-action mapping:

- Drawing → Selected files (intersection detection)
- End point → Target zone (determines action: move/delete/share)

## Development Workflow

### Running the App

```bash
npm install
npx expo start
```

Press `i` for iOS simulator, `a` for Android, `w` for web.

### Project Structure Conventions

- **Path aliases**: `@/` maps to project root (configured in `tsconfig.json`)
- **Themed components**: Prefix with `Themed` (e.g., `ThemedView`), accept `lightColor`/`darkColor` props
- **Platform-specific**: Use `.ios.tsx`, `.web.tsx` suffixes (see `components/ui/icon-symbol.ios.tsx`)

### TypeScript Patterns

- Shared value types: `SharedValue<T>` from `react-native-reanimated`
- Always define interfaces in `types/index.ts` for cross-component data structures
- Use `type` for component props, `interface` for data models

### Styling

- Inline StyleSheet.create() at component bottom
- Dark theme colors: Canvas `#0f172a`, Grid dots `#334155`
- Gradient for drawing: `#576ffb` → `#f865c4`

## Critical Implementation Details

### Gesture Composition

Multi-pointer gestures require explicit min/max pointers:

```tsx
const panGesture = Gesture.Pan().minPointers(1).maxPointers(1); // Drawing
const pinchGesture = Gesture.Pinch(); // Zoom (2+ fingers)
```

Compose with `Gesture.Race()` or `Gesture.Simultaneous()` if needed.

### Canvas Coordinate Transformation

When mapping gesture coordinates to canvas space, account for scale + translation:

```tsx
const canvasX = (gestureX - translateX.value) / scale.value;
const canvasY = (gestureY - translateY.value) / scale.value;
```

### Performance Optimization

- Grid dots: Memoized with `useMemo` (50x50 grid = 2500 elements)
- Worklet thread: Keep gesture logic in worklets, minimal UI thread communication
- `runOnJS(true)` only when necessary (see pinch gesture in `index.tsx`)

## Common Tasks

### Adding a New Gesture Action

1. Define state in `useSelection` hook
2. Add zone type to `LayoutItem['zoneType']` union in `useLayoutStore`
3. Implement zone detection logic in `useSelection.getEndZone()`
4. Handle action in main screen's gesture end handler

### Creating Themed Components

```tsx
import { useThemeColor } from '@/hooks/use-theme-color';

export function MyComponent({ lightColor, darkColor, ...props }: ThemedProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  // ...
}
```

### Debugging Gestures

- Check `isDrawing.value` state in worklet logs
- Verify pointer counts match gesture configuration
- Test on device - web gestures behave differently

## Dependencies Notes

- **Expo SDK 54** with new architecture enabled (`newArchEnabled: true`)
- **React 19.1** - uses new JSX runtime
- **Reanimated 4.1** - worklet syntax required for gesture handlers
- **Lucide icons** - prefer over `@expo/vector-icons` for custom icons
- **Zustand 5** - no Provider needed, direct imports

## Known Issues & Workarounds

- Web platform doesn't support multi-touch gestures - test zoom/pan on mobile
- `expo-symbols` iOS-only - use platform-specific icon components
- Gesture handler requires `GestureHandlerRootView` wrapper in `_layout.tsx`
