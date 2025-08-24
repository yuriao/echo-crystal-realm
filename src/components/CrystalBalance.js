// ===== src/components/CrystalBalance.js =====
import { StyleSheet, Text, View } from 'react-native';
import { useUser } from '../context/UserContext';

export default function CrystalBalance() {
  const { crystals } = useUser();

  return (
    <View style={styles.container}>
      <Text style={styles.crystalIcon}>💎</Text>
      <Text style={styles.crystalCount}>{crystals || 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  crystalIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  crystalCount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});