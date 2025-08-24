// ===== src/context/UserContext.js =====
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getUserData, createUserProfile } from '../services/userService';
import crystalTokenManager from '../services/CrystalTokenManage';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [crystals, setCrystals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userDataListener, setUserDataListener] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        setUser(firebaseUser);
        await initializeUserData(firebaseUser);
        setupUserDataListener(firebaseUser.uid);
      } else {
        // User is signed out - clean up everything
        if (userDataListener) {
          userDataListener();
          setUserDataListener(null);
        }
        
        // Clear user data
        setUser(null);
        setCrystals(0);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Clean up listener on component unmount
      if (userDataListener) {
        userDataListener();
      }
    };
  }, []);

  const initializeUserData = async (firebaseUser) => {
    try {
      let userData = await getUserData(firebaseUser.uid);
      
      if (!userData) {
        // Create new user profile with starting crystals
        userData = await createUserProfile(firebaseUser.uid, {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      }
      
      setCrystals(userData.crystals || 0);
      
      // Initialize crystal token manager
      await crystalTokenManager.initializeUser(firebaseUser.uid);
      
      console.log('User data initialized:', {
        uid: firebaseUser.uid,
        crystals: userData.crystals || 0
      });
      
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  const setupUserDataListener = (userId) => {
    // Clean up existing listener
    if (userDataListener) {
      userDataListener();
    }

    // Set up real-time listener for user data changes
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          setCrystals(userData.crystals || 0);
          
          // Update crystal token manager when crystals change
          if (crystalTokenManager.crystals !== userData.crystals) {
            crystalTokenManager.refreshUserData();
          }
          
          console.log('User data updated from Firestore:', {
            crystals: userData.crystals || 0
          });
        }
      },
      (error) => {
        console.error('Error listening to user data:', error);
        // Don't show alerts for permission errors during sign out
        if (!error.message?.includes('insufficient permissions')) {
          console.error('Unexpected Firestore error:', error);
        }
      }
    );

    setUserDataListener(() => unsubscribe);
  };

  const updateUserCrystals = async (amount) => {
    try {
      console.log(`Updating user crystals: +${amount}`);
      
      // The crystals should already be updated in Firestore by the purchase process
      // This function is mainly for triggering any local updates needed
      
      // Refresh crystal token manager
      await crystalTokenManager.onCrystalsPurchased(amount);
      
      // The real-time listener will handle updating the local state
      console.log('Crystal purchase processed successfully');
      
      return true;
    } catch (error) {
      console.error('Error in updateUserCrystals:', error);
      throw error;
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    
    try {
      const userData = await getUserData(user.uid);
      if (userData) {
        setCrystals(userData.crystals || 0);
        await crystalTokenManager.refreshUserData();
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const value = {
    user,
    crystals,
    loading,
    updateUserCrystals,
    refreshUserData,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};