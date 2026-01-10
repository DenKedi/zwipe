# Zwipe - AI Coding Agent Instructions

## Project Overview

Zwipe is a gesture-based file management mobile app (Expo SDK 54, React Native 0.81, React 19). Users draw lines across files on an infinite 2D canvas to multi-select them, then drag to folders/zones (trash, temp, duplicate, share).

**Run**: `npm install && npx expo start` (press `i`/`a`/`w` for iOS/Android/web)

**Status**: Frontend prototype with mock data - see [FEATURE_CHECKLIST.md](../FEATURE_CHECKLIST.md) for implementation status.

## Architecture

### Component Hierarchy

```
app/(tabs)/index.tsx     # Main orchestrator (~1400 lines) - gestures, modals, all handlers
├── FolderStrip          # Horizontal folder bar + breadcrumbs + folder drag
├── ZoneBar              # Action zones (trash, temp, copy, share) with hover animations
├── FileCanvas           # Infinite zoomable grid with positioned files
└── DrawingLayer         # SVG path with gradient + glow effect
```

### State Management (3-Store Pattern)

- **`useFileSystemStore`**: Files/folders CRUD with `parentId` hierarchy
- **`useSelectionStore`**: Selection state with `pending` (during draw) + `committed` phases
- **`useLayoutStore`**: Component bounds registry for worklet hit-testing

```tsx
// Direct import pattern (no Providers)
import { useFileSystemStore } from '@/store/useFileSystemStore';
const { files, moveFilesToFolder } = useFileSystemStore();
```

### Undo/Redo Action Pattern

All user actions go through `store/actions/` with Command pattern:

```tsx
// 1. Define action factory in store/actions/fileActions.ts
export function createMoveFilesAction(
  moveInfos: FileMoveInfo[],
  targetId: string
): Action {
  return {
    type: ActionType.MOVE_FILES,
    description: `Move ${moveInfos.length} files`,
    undo: () => {
      /* restore previous parentIds */
    },
    redo: () => {
      /* re-apply move */
    },
  };
}

// 2. Execute via useActionHistoryStore
const { execute } = useActionHistoryStore();
execute(createMoveFilesAction(moveInfos, targetId));
```

### Critical: Worklet Thread Separation

Gestures run on UI thread. **Never access React state directly in gesture callbacks**:

```tsx
// ❌ WRONG - will crash
.onUpdate((e) => {
  setSelectedFiles(calculate(e.x, e.y)); // React state in worklet!
})

// ✅ CORRECT - use SharedValues + runOnJS bridge
const activeSelection = useSharedValue<string[]>([]);
.onUpdate((e) => {
  'worklet';
  const ids = calculateIntersectedIds(e.x, e.y, ...); // Pure worklet function
  activeSelection.value = ids;
})

// Sync to React via useAnimatedReaction
useAnimatedReaction(
  () => activeSelection.value,
  (current) => { runOnJS(handleSelectionUpdate)(current); }
);
```

### Canvas Coordinate Transform

Screen → Canvas conversion (accounts for scale/translate around center):

```tsx
// In calculateIntersectedIds worklet
const cx = canvasW / 2;
const cy = canvasH / 2;
const canvasX = (localX - transX - (1 - currentScale) * cx) / currentScale;
const canvasY = (localY - transY - (1 - currentScale) * cy) / currentScale;
```

## Key Conventions

- **Path alias**: `@/` → project root
- **Types**: All shared interfaces in [types/index.ts](../types/index.ts)
- **Styling**: `StyleSheet.create()` at component bottom; files are 100×100px, `borderRadius: 20`
- **Icons**: Lucide React Native (not `@expo/vector-icons`)
- **Colors**: Canvas `#0f172a`, grid dots `#334155`, drawing gradient `#576ffb` → `#f865c4`

## Common Tasks

### Add a new zone type

1. Add to `ZoneType` in [types/index.ts](../types/index.ts): `'trash' | 'temp' | 'copy' | 'share' | 'newzone'`
2. Add entry in `zones` array in [ZoneBar.tsx](../components/ZoneBar.tsx)
3. Handle in `checkZoneIntersection` worklet and gesture `.onEnd()` in [index.tsx](<../app/(tabs)/index.tsx>)

### Add a new undoable action

1. Create factory in `store/actions/` following [fileActions.ts](../store/actions/fileActions.ts) pattern
2. Export from [store/actions/index.ts](../store/actions/index.ts)
3. Call `execute(createYourAction(...))` from handler

### Collision detection

Files use spatial grid for performance - see [collisionDetection.ts](../utils/collisionDetection.ts):

- `FILE_WIDTH = 100`, `FILE_HEIGHT = 100`
- Max 20% overlap allowed between files

## Gotchas

- **Web**: Multi-touch (pinch zoom) doesn't work - test on device/simulator
- **GestureHandlerRootView**: Required wrapper in `app/_layout.tsx`
- **SharedValue persistence**: Use `savedScale`/`savedTranslate` pattern to persist between gestures
- **Folder drag**: Uses long-press → drag pattern with ghost overlay (`ghostStyle`)
