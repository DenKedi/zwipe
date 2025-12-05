# File System Implementation

## Overview

This implementation provides a dummy file system with directory tree and files that can be displayed in the folder section and on the canvas.

## Key Features

### 1. **Zustand Store** (`store/useFileSystemStore.ts`)

- Centralized state management for files and folders
- Persistent state across the application
- Automatic initialization with dummy data on first load

### 2. **Dummy Data Generation** (`utils/fileSystemHelpers.ts`)

- Helper functions to generate random files and folders
- Support for various file types (PDF, JPG, PNG, XLSX, DOCX, TXT, CSV, etc.)
- Grid layout or random positioning options

### 3. **File Display**

- Files are displayed as **rounded squares** (borderRadius: 20) on the canvas
- Each file shows an icon based on its file type
- Files are positioned at specific x,y coordinates
- Non-interactive for now (no selection/opening yet)

### 4. **Folder Management**

- Folders can be created using the **"New" button** in the folder strip
- All folders are stored in the Zustand store
- Folders display in the folder strip with color coding
- Default location: Root/Home (parentId: undefined)

## Initial Dummy Data

### Folders (4 default folders in Root/Home):

1. **Work** (Blue - #3b82f6)
2. **Personal** (Green - #10b981)
3. **Projects** (Orange - #f59e0b)
4. **Archive** (Indigo - #6366f1)

### Files (8 default files in Root/Home):

- Document.pdf
- Photo.jpg
- Notes.txt
- Spreadsheet.xlsx
- Presentation.pptx
- Report.docx
- Image.png
- Data.csv

## Usage

### Creating a New Folder

1. Click the **"New"** button in the folder strip
2. Enter a folder name in the modal
3. Click **"Create"**
4. The folder will be added to the store and displayed immediately

### File System State

- All files and folders are stored in `useFileSystemStore`
- State is initialized automatically on first render
- Files with `parentId: undefined` are shown in Root/Home

## File Structure

```
store/
  └── useFileSystemStore.ts     # Zustand store for file system
utils/
  └── fileSystemHelpers.ts      # Helper functions for generating dummy data
hooks/
  └── useFileSystem.ts          # Hook that wraps the store
components/
  ├── FolderStrip.tsx           # Displays folders horizontally
  ├── FileCanvas.tsx            # Canvas for displaying files
  └── FileItem.tsx              # Individual file component (rounded square)
```

## Future Enhancements

- File selection and interaction
- File opening/preview
- Drag and drop files between folders
- File and folder deletion
- File renaming
- Search functionality
- Sorting options
