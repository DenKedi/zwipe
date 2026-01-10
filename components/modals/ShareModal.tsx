import React from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ShareModalProps {
  visible: boolean;
  sentStatus: boolean;
  onClose: () => void;
  onSend: (method: string) => void;
}

export function ShareModal({ visible, sentStatus, onClose, onSend }: ShareModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.shareOverlay}>
        <View style={styles.shareContent}>
          <View style={styles.shareHeader}>
            <Text style={styles.modalTitle}>Share via...</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: '#94a3b8', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {!sentStatus ? (
            <View style={styles.shareGrid}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => onSend('Messenger')}
              >
                <Image
                  source={require('../../assets/icons/dark/Messenger.png')}
                  style={styles.shareIcon}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => onSend('Twitter')}
              >
                <Image
                  source={require('../../assets/icons/dark/Twitter.png')}
                  style={styles.shareIcon}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => onSend('Email')}
              >
                <Image
                  source={require('../../assets/icons/dark/Email.png')}
                  style={styles.shareIcon}
                />
              </TouchableOpacity>

              <View style={[styles.shareButton, styles.shareButtonDisabled]}>
                <Image
                  source={require('../../assets/icons/dark/share.png')}
                  style={[styles.shareIcon, { opacity: 0.4 }]}
                />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={styles.sentText}>Sent</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  shareContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 420,
    alignItems: 'center',
  },
  shareHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '600',
  },
  shareGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  shareButton: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareIcon: {
    width: 48,
    height: 48,
    tintColor: '#e2e8f0',
    resizeMode: 'contain',
  },
  sentText: {
    color: '#10b981',
    fontSize: 36,
    fontWeight: '800',
  },
});
