import { Eraser, Plus, Redo2, Undo2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActionBarProps {
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onUpload?: () => void;
}

export function ActionBar({
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onClear,
  onUpload,
}: ActionBarProps) {
  return (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={[styles.actionButton, !canUndo && styles.actionButtonDisabled]}
        onPress={onUndo}
        disabled={!canUndo}
      >
        <Undo2
          size={20}
          color={canUndo ? '#f1f5f9' : '#475569'}
          strokeWidth={2.5}
        />
        <Text
          style={[
            styles.actionButtonText,
            !canUndo && styles.actionButtonTextDisabled,
          ]}
        >
          Undo
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, !canRedo && styles.actionButtonDisabled]}
        onPress={onRedo}
        disabled={!canRedo}
      >
        <Redo2
          size={20}
          color={canRedo ? '#f1f5f9' : '#475569'}
          strokeWidth={2.5}
        />
        <Text
          style={[
            styles.actionButtonText,
            !canRedo && styles.actionButtonTextDisabled,
          ]}
        >
          Redo
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.clearButton,
          !hasSelection && styles.actionButtonDisabled,
        ]}
        onPress={onClear}
        disabled={!hasSelection}
      >
        <Eraser
          size={20}
          color={hasSelection ? '#fef2f2' : '#475569'}
          strokeWidth={2.5}
        />
        <Text
          style={[
            styles.actionButtonText,
            styles.clearButtonText,
            !hasSelection && styles.actionButtonTextDisabled,
          ]}
        >
          Clear
        </Text>
      </TouchableOpacity>

      {/* Upload button: matches style of other action buttons */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onUpload}
      >
        <Plus size={20} color={'#f1f5f9'} strokeWidth={2.5} />
        <Text style={styles.actionButtonText}>Upload</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  actionButtonText: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextDisabled: {
    color: '#475569',
  },
  clearButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearButtonText: {
    color: '#fef2f2',
  },
});
