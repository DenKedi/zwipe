import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface NewFolderModalProps {
  visible: boolean;
  folderName: string;
  onFolderNameChange: (name: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}

export function NewFolderModal({
  visible,
  folderName,
  onFolderNameChange,
  onCancel,
  onCreate,
}: NewFolderModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create New Folder</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Folder name"
            placeholderTextColor="#64748b"
            value={folderName}
            onChangeText={onFolderNameChange}
            autoFocus
            onSubmitEditing={onCreate}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.createButton]}
              onPress={onCreate}
            >
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
    color: '#f1f5f9',
    fontSize: 16,
    padding: 12,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#334155',
  },
  createButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
