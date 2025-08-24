// ===== src/screens/LoadingScreen.js =====
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Echoes of the Crystal Realm</Text>
      <ActivityIndicator size="large" color="#8B5CF6" />
      <Text style={styles.loadingText}>Loading magical energies...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 20,
    color: '#A78BFA',
    fontSize: 16,
  },
});