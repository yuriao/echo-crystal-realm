// ===== src/components/CrystalRequestModal.js =====
// Modal for crystal requests
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { CHARACTER_INFO } from '../constants/story';

export default function CrystalRequestModal({ visible, crystalRequest, onPurchase, onClose }) {
  if (!crystalRequest) return null;

  const characterInfo = CHARACTER_INFO[crystalRequest.companion];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={[styles.companionName, { color: characterInfo.color }]}>
              {characterInfo.name}
            </Text>
            <Text style={styles.title}>Crystal Required</Text>
          </View>

          <Image
            source={{ uri: 'https://picsum.photos/200/200' }} // Placeholder companion image
            style={styles.companionImage}
          />

          <Text style={styles.message}>
            {crystalRequest.message}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.purchaseButton]}
              onPress={onPurchase}
            >
              <Text style={styles.buttonText}>Get Crystals 💎</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.helpText}>
            You need crystals to continue your magical journey
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  companionName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  companionImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  message: {
    fontSize: 16,
    color: '#A78BFA',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  purchaseButton: {
    backgroundColor: '#8B5CF6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 15,
    textAlign: 'center',
  },
});