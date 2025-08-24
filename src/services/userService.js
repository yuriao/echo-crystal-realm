// ===== src/services/userService.js =====
import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const updateCrystals = async (userId, crystalAmount) => {
  try {
    console.log(`Updating crystals for user ${userId}: +${crystalAmount}`);
    
    const userRef = doc(db, 'users', userId);
    
    // First check if user document exists
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create user document if it doesn't exist
      await setDoc(userRef, {
        crystals: crystalAmount,
        tokensUsed: 0,
        createdAt: new Date().toISOString(),
        lastCrystalPurchase: new Date().toISOString()
      });
      console.log(`Created new user document with ${crystalAmount} crystals`);
    } else {
      // Update existing user document
      await updateDoc(userRef, {
        crystals: increment(crystalAmount),
        lastCrystalPurchase: new Date().toISOString()
      });
      console.log(`Updated crystals: +${crystalAmount}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating crystals:', error);
    throw error;
  }
};

export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      console.log('User document does not exist');
      return null;
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};

export const updateUserTokens = async (userId, tokensUsed) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      tokensUsed: increment(tokensUsed),
      lastTokenUpdate: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error updating user tokens:', error);
    throw error;
  }
};

export const createUserProfile = async (userId, userData) => {
  try {
    const userRef = doc(db, 'users', userId);
    const defaultData = {
      crystals: 0, // Starting crystals
      tokensUsed: 0,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      ...userData
    };
    
    await setDoc(userRef, defaultData);
    console.log('User profile created successfully');
    
    return defaultData;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

// Alias for backward compatibility - fixes the "createUserDocument is not a function" error
export const createUserDocument = createUserProfile;