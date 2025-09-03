// ===== src/screens/HomeScreen.js =====
import { signOut, deleteUser } from 'firebase/auth';
import { deleteDoc, doc, collection, addDoc } from 'firebase/firestore';
import {
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CrystalBalance from '../components/CrystalBalance';
import { useUser } from '../context/UserContext';
import { auth, db } from '../firebase/config';
import journeyService from '../services/journeyService';
import { resetRevenueCat } from '../revenueCat/revenueCat';
import { useState } from 'react';

export default function HomeScreen({ navigation }) {
  const { user, crystals } = useUser();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      resetRevenueCat();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmationText !== 'delete account') {
      Alert.alert('Error', 'Please type "delete account" to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      // Delete user data from Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      
      // End any active journey
      await journeyService.endJourney(user.uid);
      
      // Reset RevenueCat
      resetRevenueCat();
      
      // Delete Firebase Auth user
      await deleteUser(auth.currentUser);
      
      Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
    } catch (error) {
      Alert.alert('Error', error.message);
      setIsDeleting(false);
    }
    
    setShowDeleteModal(false);
    setConfirmationText('');
    setIsDeleting(false);
  };

  const openDeleteModal = () => {
    setShowDeleteModal(true);
    setConfirmationText('');
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setConfirmationText('');
  };

  const openFeedbackModal = () => {
    setShowFeedbackModal(true);
    setFeedbackText('');
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setFeedbackText('');
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Please enter your feedback');
      return;
    }

    setIsSendingFeedback(true);
    try {
      // Save feedback to Firestore
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        feedback: feedbackText.trim(),
        timestamp: new Date().toISOString(),
        userEmail: user.email || null,
        platform: 'mobile',
      });
      
      Alert.alert('Thank You!', 'Your feedback has been sent successfully.');
      closeFeedbackModal();
    } catch (error) {
      console.error('Error sending feedback:', error);
      Alert.alert('Error', 'Failed to send feedback. Please try again.');
    }
    setIsSendingFeedback(false);
  };

  // In your HomeScreen component, add this function:
  // Add this function:
const checkForActiveJourney = async () => {
  const hasJourney = await journeyService.hasActiveJourney(user.uid);
  if (hasJourney) {
    Alert.alert(
      'Continue Journey?',
      'You have an active journey in the Crystal Realm. Would you like to continue?',
      [
        {
          text: 'Start New',
          onPress: () => handleStartAdventure(true),
          style: 'destructive'
        },
        {
          text: 'Continue',
          onPress: () => handleResumeJourney()
        }
      ]
    );
  } else {
    handleStartAdventure(true);
  }
};

const handleResumeJourney = () => {
  navigation.navigate('Chat', { resumeJourney: true });
};

const handleStartAdventure = async (endPrevious = false) => {
  // if (crystals < 1) {
  //   Alert.alert(
  //     'Not Enough Crystals',
  //     'You need at least 1 crystal to start an adventure.',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       { text: 'Buy Crystals', onPress: () => navigation.navigate('CrystalShop') }
  //     ]
  //   );
  //   return;
  // }
  
  if (endPrevious) {
    await journeyService.endJourney(user.uid);
  }
    
    // Navigate to Chat screen
    navigation.navigate('Chat');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome, { 'Adventurer'}
        </Text>
        <CrystalBalance />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Echoes of the{'\n'}Crystal Realm</Text>
        
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={[styles.button, styles.adventureButton]}
            onPress={checkForActiveJourney}
          >
            <Text style={styles.buttonText}>Start/Continue Adventure</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.shopButton]}
            onPress={() => navigation.navigate('CrystalShop')}
          >
            <Text style={styles.buttonText}>Crystal Shop</Text>
          </TouchableOpacity>

          {/* Feedback Button */}
          <TouchableOpacity
            style={[styles.button, styles.feedbackButton]}
            onPress={openFeedbackModal}
          >
            <Text style={styles.buttonText}>Send Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
          >
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>

          

          {/* Delete Account Link */}
          <TouchableOpacity onPress={openDeleteModal} style={styles.deleteAccountLink}>
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Delete Account Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteModal}
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalText}>
              This action cannot be undone. All your data, crystals, and progress will be permanently deleted.
            </Text>
            <Text style={styles.modalInstruction}>
              Type "delete account" to confirm:
            </Text>
            
            <TextInput
              style={styles.confirmationInput}
              value={confirmationText}
              onChangeText={setConfirmationText}
              placeholder="delete account"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeDeleteModal}
                disabled={isDeleting}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.deleteButton,
                  confirmationText !== 'delete account' && styles.disabledButton
                ]}
                onPress={handleDeleteAccount}
                disabled={confirmationText !== 'delete account' || isDeleting}
              >
                <Text style={styles.modalButtonText}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showFeedbackModal}
        onRequestClose={closeFeedbackModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send Feedback</Text>
            <Text style={styles.modalText}>
              Help us improve your Crystal Realm experience! Share your thoughts, suggestions, or report any issues.
            </Text>
            
            <TextInput
              style={styles.feedbackInput}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Enter your feedback here..."
              placeholderTextColor="#666"
              multiline={true}
              numberOfLines={6}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeFeedbackModal}
                disabled={isSendingFeedback}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.sendButton,
                  !feedbackText.trim() && styles.disabledButton
                ]}
                onPress={handleSendFeedback}
                disabled={!feedbackText.trim() || isSendingFeedback}
              >
                <Text style={styles.modalButtonText}>
                  {isSendingFeedback ? 'Sending...' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  welcomeText: {
    color: '#A78BFA',
    fontSize: 16,
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#8B5CF6',
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 50,
  },
  menuContainer: {
    gap: 15,
  },
  button: {
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  adventureButton: {
    backgroundColor: '#8B5CF6',
  },
  shopButton: {
    backgroundColor: '#F59E0B',
  },
  signOutButton: {
    backgroundColor: '#cf0d6bff',
    marginTop: 20,
  },
  feedbackButton: {
    backgroundColor: '#10B981',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  buttonSubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
    marginTop: 5,
  },
  deleteAccountLink: {
    alignItems: 'center',
    marginTop: 30,
  },
  deleteAccountText: {
    color: '#fff',
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  modalContent: {
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalInstruction: {
    fontSize: 14,
    color: '#A78BFA',
    marginBottom: 15,
  },
  confirmationInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#4C1D95',
  },
  feedbackInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#4C1D95',
    height: 120,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  modalButton: {
    flex: 1,
    borderRadius: 15,
    padding: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#4C1D95',
  },
  deleteButton: {
    backgroundColor: '#fff',
  },
  sendButton: {
    backgroundColor: '#10B981',
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.5,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});