import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/config'; // Adjust path as needed
import crystalTokenManager from '../services/CrystalTokenManage'; // Adjust path as needed

// Replace these with your actual SDK API keys from RevenueCat dashboard
const REVENUECAT_API_KEY_IOS = 'appl_bwfUTdWxWYFDZODmWbxyroBjiub';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_SDK_KEY_HERE';

// Crystal amounts mapped to product IDs
const CRYSTAL_AMOUNTS = {
  'crystal_10': 10,
  'crystal_50': 50,
  // Add more mappings as needed
};

// Track if RevenueCat has been initialized
let isRevenueCatInitialized = false;

// Development mode flag - set to false for production builds
const IS_DEV_MODE = false; // Change to false to test real RevenueCat in dev

export const initRevenueCat = async (userId) => {
  try {
    // Development mode bypass
    if (IS_DEV_MODE) {
      console.log('🔧 DEV MODE: Mocking RevenueCat initialization');
      isRevenueCatInitialized = true;
      await crystalTokenManager.initializeUser(userId);
      
      // Return mock customer info
      return {
        originalAppUserId: userId,
        activeSubscriptions: {},
        allPurchasedProductIdentifiers: [],
        nonSubscriptionTransactions: []
      };
    }

    // Prevent multiple initializations
    if (isRevenueCatInitialized) {
      console.log('RevenueCat already initialized, updating user ID...');
      
      // Just update the user ID if already initialized
      if (userId) {
        await Purchases.logIn(userId);
      }
      
      // Initialize crystal token manager for this user
      await crystalTokenManager.initializeUser(userId);
      
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    }

    if (!userId) {
      throw new Error('User ID is required for RevenueCat initialization');
    }

    console.log('Initializing RevenueCat for user:', userId);
    console.log('Platform:', Platform.OS);
    
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    console.log('Using API key:', apiKey.substring(0, 10) + '...');
    
    // Check if we have a valid API key
    if (!apiKey || apiKey.includes('YOUR_') || apiKey === 'goog_YOUR_ANDROID_KEY_HERE') {
      throw new Error(`Missing ${Platform.OS} API key. Please set up RevenueCat API keys for ${Platform.OS}.`);
    }
    
    // Configure RevenueCat
    await Purchases.configure({
      apiKey,
      appUserID: userId,
    });
    
    // Mark as initialized
    isRevenueCatInitialized = true;
    
    // Set up debug logging in development
    if (__DEV__) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    }
    
    console.log('RevenueCat initialized successfully for user:', userId);
    
    // Initialize crystal token manager for this user
    await crystalTokenManager.initializeUser(userId);
    
    // Get initial customer info
    const customerInfo = await Purchases.getCustomerInfo();
    console.log('Initial customer info:', {
      originalAppUserId: customerInfo.originalAppUserId,
      activeSubscriptions: Object.keys(customerInfo.activeSubscriptions),
      allPurchasedProductIdentifiers: customerInfo.allPurchasedProductIdentifiers
    });
    
    return customerInfo;
  } catch (error) {
    console.error('Error initializing RevenueCat:', error);
    isRevenueCatInitialized = false; // Reset on error
    throw error;
  }
};

export const getOfferings = async () => {
  try {
    // Development mode bypass
    if (IS_DEV_MODE) {
      console.log('🔧 DEV MODE: Returning mock offerings');
      return {
        current: {
          identifier: 'default',
          availablePackages: [
            {
              identifier: 'crystal_10',
              product: {
                identifier: 'crystal_10',
                priceString: '$4.99',
                title: '10 Crystals',
                description: 'Small crystal pack'
              }
            },
            {
              identifier: 'crystal_50', 
              product: {
                identifier: 'crystal_50',
                priceString: '$17.99',
                title: '50 Crystals',
                description: 'Large crystal pack'
              }
            }
          ]
        },
        all: {}
      };
    }

    // Check if RevenueCat is initialized
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized. Call initRevenueCat() first.');
    }

    console.log('Fetching RevenueCat offerings...');
    const offerings = await Purchases.getOfferings();
    
    console.log('RevenueCat offerings fetched:', {
      current: offerings.current?.identifier,
      availablePackages: offerings.current?.availablePackages?.length || 0,
      allOfferings: Object.keys(offerings.all || {})
    });
    
    if (offerings.current && offerings.current.availablePackages) {
      console.log('Available packages:', 
        offerings.current.availablePackages.map(pkg => ({
          identifier: pkg.identifier,
          price: pkg.product.priceString,
          title: pkg.product.title,
          crystals: CRYSTAL_AMOUNTS[pkg.identifier] || 0
        }))
      );
    }
    
    return offerings;
  } catch (error) {
    console.error('Error getting offerings:', error);
    throw error;
  }
};

// Add crystals to Firebase after successful purchase
const addCrystalsToFirebase = async (userId, amount) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      crystals: increment(amount),
      lastPurchase: new Date().toISOString()
    });
    
    console.log(`Added ${amount} crystals to user ${userId} in Firebase`);
    return true;
  } catch (error) {
    console.error('Error adding crystals to Firebase:', error);
    throw error;
  }
};

// Process successful purchase and update user's crystals
const processPurchaseSuccess = async (customerInfo, productIdentifier) => {
  try {
    const userId = customerInfo.originalAppUserId;
    const crystalAmount = CRYSTAL_AMOUNTS[productIdentifier];
    
    if (!crystalAmount) {
      console.warn(`No crystal amount defined for product: ${productIdentifier}`);
      return { success: false, error: 'Unknown product' };
    }
    
    console.log(`Processing purchase: ${productIdentifier} -> ${crystalAmount} crystals`);
    
    // Add crystals to Firebase
    await addCrystalsToFirebase(userId, crystalAmount);
    
    // Update local crystal manager
    await crystalTokenManager.onCrystalsPurchased(crystalAmount);
    
    return {
      success: true,
      crystalAmount,
      productId: productIdentifier,
      userId
    };
  } catch (error) {
    console.error('Error processing purchase success:', error);
    return { success: false, error: error.message };
  }
};

export const purchasePackage = async (packageToPurchase,userId) => {
  try {
    // Development mode bypass
    if (IS_DEV_MODE) {
      console.log('🔧 DEV MODE: Simulating purchase for:', packageToPurchase.identifier);
      
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful purchase
      const crystalAmount = CRYSTAL_AMOUNTS[packageToPurchase.identifier] || 10;
      
      // Add crystals to Firebase (real operation)
      await addCrystalsToFirebase(userId, crystalAmount);
      
      // Update local crystal manager (real operation)
      await crystalTokenManager.onCrystalsPurchased(crystalAmount);
      
      return {
        customerInfo: {
          originalAppUserId: userId,
          activeSubscriptions: {},
          nonSubscriptionTransactions: []
        },
        productIdentifier: packageToPurchase.identifier,
        processingResult: {
          success: true,
          crystalAmount,
          productId: packageToPurchase.identifier,
          userId
        }
      };
    }

    // Check if RevenueCat is initialized
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized. Call initRevenueCat() first.');
    }

    if (!packageToPurchase) {
      throw new Error('No package provided for purchase');
    }
    
    const crystalAmount = CRYSTAL_AMOUNTS[packageToPurchase.identifier];
    
    console.log('Starting purchase for package:', {
      identifier: packageToPurchase.identifier,
      price: packageToPurchase.product.priceString,
      title: packageToPurchase.product.title,
      crystalAmount: crystalAmount || 'Unknown'
    });
    
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);
    
    console.log('Purchase completed successfully:', {
      productIdentifier,
      originalAppUserId: customerInfo.originalAppUserId,
      activeSubscriptions: Object.keys(customerInfo.activeSubscriptions),
      nonSubscriptionTransactions: customerInfo.nonSubscriptionTransactions.length,
      latestExpirationDate: customerInfo.latestExpirationDate
    });
    
    // Process the successful purchase
    const processingResult = await processPurchaseSuccess(customerInfo, productIdentifier);
    
    return {
      customerInfo,
      productIdentifier,
      processingResult
    };
  } catch (error) {
    console.error('Purchase error details:', {
      code: error.code,
      message: error.message,
      userCancelled: error.userCancelled,
      underlyingErrorMessage: error.underlyingErrorMessage
    });
    
    // Re-throw with additional context
    throw {
      ...error,
      timestamp: new Date().toISOString(),
      platform: Platform.OS
    };
  }
};

export const restorePurchases = async () => {
  try {
    // Check if RevenueCat is initialized
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized. Call initRevenueCat() first.');
    }

    console.log('Restoring purchases...');
    const customerInfo = await Purchases.restorePurchases();
    
    console.log('Purchases restored:', {
      originalAppUserId: customerInfo.originalAppUserId,
      activeSubscriptions: Object.keys(customerInfo.activeSubscriptions),
      nonSubscriptionTransactions: customerInfo.nonSubscriptionTransactions.length
    });
    
    // Process any restored non-subscription purchases (consumables)
    if (customerInfo.nonSubscriptionTransactions.length > 0) {
      console.log('Processing restored consumable purchases...');
      
      // Note: For consumables, you might want to track which ones have been processed
      // to avoid giving crystals multiple times for the same purchase
      for (const transaction of customerInfo.nonSubscriptionTransactions) {
        console.log('Restored transaction:', {
          productIdentifier: transaction.productIdentifier,
          purchaseDate: transaction.purchaseDate,
          transactionIdentifier: transaction.transactionIdentifier
        });
      }
    }
    
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
};

export const getCustomerInfo = async () => {
  try {
    // Check if RevenueCat is initialized
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized. Call initRevenueCat() first.');
    }

    const customerInfo = await Purchases.getCustomerInfo();
    
    console.log('Customer info retrieved:', {
      originalAppUserId: customerInfo.originalAppUserId,
      activeSubscriptions: Object.keys(customerInfo.activeSubscriptions),
      allPurchasedProductIdentifiers: customerInfo.allPurchasedProductIdentifiers,
      nonSubscriptionTransactions: customerInfo.nonSubscriptionTransactions.length
    });
    
    return customerInfo;
  } catch (error) {
    console.error('Error getting customer info:', error);
    throw error;
  }
};

// Helper function to get crystal amount for a product
export const getCrystalAmountForProduct = (productIdentifier) => {
  return CRYSTAL_AMOUNTS[productIdentifier] || 0;
};

// Sync with crystal token manager (useful for debugging or manual sync)
export const syncWithCrystalManager = async () => {
  try {
    // Check if RevenueCat is initialized
    if (!isRevenueCatInitialized) {
      throw new Error('RevenueCat not initialized. Call initRevenueCat() first.');
    }

    const customerInfo = await getCustomerInfo();
    await crystalTokenManager.refreshUserData();
    
    console.log('Synced RevenueCat with Crystal Manager');
    return { success: true, customerInfo };
  } catch (error) {
    console.error('Error syncing with crystal manager:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to reset RevenueCat (useful for testing or user logout)
export const resetRevenueCat = () => {
  isRevenueCatInitialized = false;
  console.log('RevenueCat initialization state reset');
};