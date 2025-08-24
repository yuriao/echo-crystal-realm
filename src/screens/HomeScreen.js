// ===== src/screens/HomeScreen.js =====
import { signOut } from 'firebase/auth';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CrystalBalance from '../components/CrystalBalance';
import { useUser } from '../context/UserContext';
import { auth } from '../firebase/config';
import journeyService from '../services/journeyService';
import { resetRevenueCat } from '../revenueCat/revenueCat';

export default function HomeScreen({ navigation }) {
  const { user, crystals } = useUser();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      resetRevenueCat();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
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

          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
          >
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>

        </View>
      </View>
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
    backgroundColor: '#EF4444',
    marginTop: 20,
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
});
