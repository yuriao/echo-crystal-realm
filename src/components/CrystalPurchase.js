import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

class RevenueCatService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (Platform.OS === 'ios') {
        await Purchases.configure({ apiKey: 'YOUR_IOS_API_KEY' });
      } else if (Platform.OS === 'android') {
        await Purchases.configure({ apiKey: 'YOUR_ANDROID_API_KEY' });
      }
      
      this.isInitialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('Error initializing RevenueCat:', error);
    }
  }

  async identifyUser(userId) {
    try {
      await Purchases.logIn(userId);
      console.log('User identified in RevenueCat:', userId);
    } catch (error) {
      console.error('Error identifying user:', error);
    }
  }

  async getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('Error getting offerings:', error);
      return null;
    }
  }

  async purchaseProduct(productId, crystalAmount) {
    try {
      const { customerInfo, productIdentifier } = await Purchases.purchaseProduct(productId);
      
      // Check if purchase was successful
      if (customerInfo.activeSubscriptions.length > 0 || 
          customerInfo.nonSubscriptionTransactions.length > 0) {
        
        console.log('Purchase successful:', productIdentifier);
        return {
          success: true,
          customerInfo,
          productId: productIdentifier,
          crystalAmount
        };
      }
      
      return { success: false, error: 'Purchase verification failed' };
    } catch (error) {
      console.error('Purchase error:', error);
      return { success: false, error: error.message };
    }
  }

  async restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo;
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return null;
    }
  }
}

export default new RevenueCatService();