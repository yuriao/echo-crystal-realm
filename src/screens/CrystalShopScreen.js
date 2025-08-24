// ===== src/screens/CrystalShopScreen.js =====
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CrystalBalance from '../components/CrystalBalance';
import { useUser } from '../context/UserContext';
import { 
  getOfferings, 
  purchasePackage, 
  initRevenueCat,
  restorePurchases,
  getCrystalAmountForProduct 
} from '../revenueCat/revenueCat';
import crystalTokenManager from '../services/CrystalTokenManage';

// Map your local package identifiers to RevenueCat product IDs
const CRYSTAL_PACKAGES = [
  { 
    id: 'small_pack', 
    crystals: 10, 
    fallbackPrice: 'free for test', 
    identifier: 'crystal_10'  // This should match your RevenueCat product ID
  },
  { 
    id: 'large_pack', 
    crystals: 50, 
    fallbackPrice: 'free for test', 
    identifier: 'crystal_50',  // This should match your RevenueCat product ID
  },
];

export default function CrystalShopScreen({ navigation }) {
  const { user, updateUserCrystals } = useUser();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [currentCrystals, setCurrentCrystals] = useState(0);
  
  
  useEffect(() => {
    if (user?.uid) {
      initializeRevenueCat();
      loadCurrentCrystals();
    }
  }, [user?.uid]); // Re-run when user changes

  const initializeRevenueCat = async () => {
    try {
      console.log('Initializing RevenueCat for user:', user?.uid);
      
      if (!user?.uid) {
        console.error('No user ID available for RevenueCat initialization');
        Alert.alert(
          'Authentication Error',
          'Please make sure you are logged in before accessing the crystal shop.'
        );
        setLoading(false);
        return;
      }

      // Initialize RevenueCat with user ID
      await initRevenueCat(user.uid);
      
      // Load offerings after successful initialization
      await loadOfferings();
      
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
      
      // Show specific error message based on the type of error
      let errorMessage = 'Failed to initialize purchase system. Please try again.';
      
      if (error.message.includes('singleton instance')) {
        errorMessage = 'Purchase system initialization error. Please restart the app.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      Alert.alert('Initialization Error', errorMessage);
      setLoading(false);
    }
  };

  const loadOfferings = async () => {
    try {
      console.log('Loading RevenueCat offerings...');
      const revenueCatOfferings = await getOfferings();
      
      console.log('RevenueCat Offerings loaded:', {
        current: revenueCatOfferings?.current?.identifier,
        packagesCount: revenueCatOfferings?.current?.availablePackages?.length || 0
      });
      
      setOfferings(revenueCatOfferings);
    } catch (error) {
      console.error('Error loading offerings:', error);
      Alert.alert('Error', 'Failed to load purchase options. Please try again. ', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentCrystals = () => {
    const crystals = crystalTokenManager.getCurrentCrystals();
    setCurrentCrystals(crystals);
  };

  const handlePurchase = async (packageConfig) => {
    if (!packageConfig) {
      Alert.alert('Error', 'Invalid package selected. Please try again.');
      return;
    }

    // Find the corresponding RevenueCat package
    const rcPackage = offerings?.current?.availablePackages?.find(
      p => p.identifier === packageConfig.identifier
    );

    if (!rcPackage) {
      Alert.alert(
        'Package Unavailable', 
        'This crystal package is not available right now. Please try again later.'
      );
      return;
    }

    setPurchasing(packageConfig.id);
    
    try {
      const crystalAmount = getCrystalAmountForProduct(packageConfig.identifier);
      
      console.log('Starting purchase:', {
        packageId: packageConfig.identifier,
        crystalAmount,
        price: rcPackage.product.priceString
      });
      
      // Make the purchase through RevenueCat (this handles everything)
      const result = await purchasePackage(rcPackage,user?.uid);
      
      console.log('Purchase result:', result);
      
      if (result.processingResult?.success) {
        // Purchase was successful and crystals were already added by RevenueCat service
        
        // Update local crystal count display
        loadCurrentCrystals();
        
        // Update user context to reflect new crystal balance
        await updateUserCrystals(0); // This will refresh from Firebase
        
        Alert.alert(
          'Purchase Successful! ✨',
          `You've received ${crystalAmount} crystals! Your magical energy has been restored.\n\nNew balance: ${crystalTokenManager.getCurrentCrystals()} crystals`,
          [{ 
            text: 'Continue Adventure', 
            onPress: () => navigation.goBack() 
          }]
        );
      } else {
        // Purchase completed but processing failed
        console.error('Purchase processing failed:', result.processingResult);
        
        Alert.alert(
          'Purchase Issue',
          result.processingResult?.error || 'There was an issue processing your purchase. Your payment went through - please contact support to receive your crystals.'
        );
      }
      
    } catch (error) {
      console.error('Purchase error:', error);
      
      if (error.userCancelled) {
        console.log('User cancelled purchase');
        // Don't show an error for user cancellation
      } else if (error.code === 'PURCHASE_NOT_ALLOWED_ERROR') {
        Alert.alert('Purchase Not Allowed', 'In-app purchases are not enabled on this device.');
      } else if (error.code === 'PAYMENT_PENDING_ERROR') {
        Alert.alert('Payment Pending', 'Your payment is being processed. Crystals will be added once confirmed.');
      } else if (error.code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR') {
        Alert.alert('Product Unavailable', 'This crystal package is temporarily unavailable.');
      } else {
        Alert.alert(
          'Purchase Failed', 
          error.message || 'There was an issue processing your purchase. Please try again or contact support if the problem persists.'
        );
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      console.log('Restoring purchases...');
      const customerInfo = await restorePurchases();
      
      // Refresh crystal count after restore
      await crystalTokenManager.refreshUserData();
      loadCurrentCrystals();
      await updateUserCrystals(0); // Refresh from Firebase
      
      Alert.alert(
        'Restore Complete', 
        'Your previous purchases have been restored successfully!'
      );
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert(
        'Restore Failed', 
        'Could not restore purchases. Please try again or contact support.'
      );
    }
  };

  const getPackagePrice = (pack) => {
    // Use RevenueCat price if available, otherwise fallback to hardcoded price
    const rcPackage = offerings?.current?.availablePackages?.find(
      p => p.identifier === pack.identifier
    );
    
    if (rcPackage?.product?.priceString) {
      return rcPackage.product.priceString;
    }
    
    return pack.fallbackPrice;
  };

  const isPackageAvailable = (pack) => {
    // Check if the package is available in RevenueCat offerings
    if (!offerings?.current?.availablePackages) return false;
    
    const rcPackage = offerings.current.availablePackages.find(
      p => p.identifier === pack.identifier
    );
    
    return !!rcPackage;
  };

  const getActualCrystalAmount = (pack) => {
    // Get the actual crystal amount from RevenueCat mapping or fallback to local config
    const crystalAmount = getCrystalAmountForProduct(pack.identifier);
    return crystalAmount || pack.crystals;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <CrystalBalance />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.title}>Crystal Shop</Text>
        <Text style={styles.subtitle}>Refill your magical energy</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading crystal packages...</Text>
          </View>
        ) : (
          <View style={styles.packagesContainer}>
            {CRYSTAL_PACKAGES.map((pack) => {
              const isAvailable = isPackageAvailable(pack);
              const isPurchasing = purchasing === pack.id;
              const packagePrice = getPackagePrice(pack);
              const actualCrystalAmount = getActualCrystalAmount(pack);
              
              return (
                <TouchableOpacity
                  key={pack.id}
                  style={[
                    styles.packageCard,
                    pack.popular && styles.popularCard,
                    !isAvailable && styles.unavailableCard,
                    isPurchasing && styles.purchasingCard
                  ]}
                  onPress={() => handlePurchase(pack)}
                  disabled={!isAvailable || purchasing !== null}
                >
                  {pack.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>MOST POPULAR</Text>
                    </View>
                  )}
                  
                  <Text style={[
                    styles.crystalAmount,
                    !isAvailable && styles.unavailableText
                  ]}>
                    {actualCrystalAmount}
                  </Text>
                  <Text style={[
                    styles.crystalLabel,
                    !isAvailable && styles.unavailableText
                  ]}>
                    Crystals
                  </Text>
                  <Text style={[
                    styles.price,
                    !isAvailable && styles.unavailableText
                  ]}>
                    {packagePrice}
                  </Text>
                  
                  {isPurchasing && (
                    <View style={styles.purchasingOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.purchasingText}>Processing...</Text>
                    </View>
                  )}
                  
                  {!isAvailable && !isPurchasing && (
                    <Text style={styles.unavailableLabel}>Unavailable</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Restore Purchases Button 
        <TouchableOpacity 
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          disabled={loading}
        >
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>*/}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>💎 About Crystals</Text>
          <Text style={styles.infoText}>
            • Crystals power your magical conversations with companions{'\n'}
            • Current balance: {currentCrystals} crystals{'\n'}
            • All purchases are secure and processed through your app store
          </Text>
        </View>

      </ScrollView>
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
  backButton: {
    color: '#A78BFA',
    fontSize: 18,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#8B5CF6',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#A78BFA',
    textAlign: 'center',
    marginBottom: 30,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  loadingText: {
    color: '#A78BFA',
    marginTop: 10,
    fontSize: 16,
  },
  packagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 20,
  },
  packageCard: {
    width: '47%',
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    minHeight: 150,
  },
  popularCard: {
    borderColor: '#F59E0B',
  },
  unavailableCard: {
    opacity: 0.5,
    backgroundColor: '#1a1a2e',
  },
  purchasingCard: {
    opacity: 0.8,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  crystalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  crystalLabel: {
    color: '#A78BFA',
    fontSize: 16,
    marginBottom: 10,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  unavailableText: {
    color: '#666',
  },
  unavailableLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },
  purchasingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchasingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  restoreButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    color: '#8B5CF6',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});