// ===== src/services/journeyService.js - Updated for World/Landmark System =====
import { doc, setDoc, getDoc, updateDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class JourneyService {
  // Save current journey state
  async saveJourneyState(userId, journeyData) {
    const journeyRef = doc(db, 'journeys', userId);
    
    const journeyState = {
      userId,
      // Changed from storyStage to currentLandmark
      currentLandmark: journeyData.currentLandmark || 'sanctuary_heart',
      // Added new world-based state
      conversationMemory: journeyData.conversationMemory || {},
      companionStates: journeyData.companionStates || {},
      worldContext: journeyData.worldContext || null,
      activeCompanions: journeyData.activeCompanions || ['elara', 'bramble', 'kael'],
      // Keep existing fields
      tokenCount: journeyData.tokenCount,
      lastSaved: new Date().toISOString(),
      conversationHistory: journeyData.conversationHistory || [],
      isActive: true,
      journeyId: journeyData.journeyId || `journey_${Date.now()}`,
      // Remove story progression fields, but keep for backwards compatibility
      storyStage: journeyData.storyStage || 0, // Deprecated
      storyState: journeyData.storyState || {}, // Deprecated
    };

    try {
      await setDoc(journeyRef, journeyState, { merge: true });
      
      // Also save locally for quick access
      await AsyncStorage.setItem(
        `journey_${userId}`,
        JSON.stringify(journeyState)
      );
      
      return true;
    } catch (error) {
      console.error('Error saving journey state:', error);
      return false;
    }
  }

  // Load saved journey
  async loadJourneyState(userId) {
    try {
      // Try to load from local storage first
      const localData = await AsyncStorage.getItem(`journey_${userId}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        // Check if local data is recent (within last hour)
        const lastSaved = new Date(parsed.lastSaved);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (lastSaved > hourAgo) {
          // Ensure backwards compatibility
          if (!parsed.currentLandmark && parsed.storyStage !== undefined) {
            parsed.currentLandmark = 'sanctuary_heart'; // Default landmark
          }
          return parsed;
        }
      }

      // Load from Firebase
      const journeyRef = doc(db, 'journeys', userId);
      const journeyDoc = await getDoc(journeyRef);
      
      if (journeyDoc.exists()) {
        const data = journeyDoc.data();
        
        // Ensure backwards compatibility
        if (!data.currentLandmark && data.storyStage !== undefined) {
          data.currentLandmark = 'sanctuary_heart'; // Default landmark
        }
        
        // Save to local storage
        await AsyncStorage.setItem(
          `journey_${userId}`,
          JSON.stringify(data)
        );
        
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading journey state:', error);
      return null;
    }
  }

  // Check if user has an active journey
  async hasActiveJourney(userId) {
    try {
      const journeyRef = doc(db, 'journeys', userId);
      const journeyDoc = await getDoc(journeyRef);
      
      if (journeyDoc.exists()) {
        const data = journeyDoc.data();
        return data.isActive === true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking active journey:', error);
      return false;
    }
  }

  // End current journey
  async endJourney(userId) {
    try {
      const journeyRef = doc(db, 'journeys', userId);
      
      await updateDoc(journeyRef, {
        isActive: false,
        endedAt: new Date().toISOString(),
      });
      
      // Clear local storage
      await AsyncStorage.removeItem(`journey_${userId}`);
      
      return true;
    } catch (error) {
      console.error('Error ending journey:', error);
      return false;
    }
  }

  // Load chat messages for journey
  async loadJourneyMessages(userId, journeyId) {
    try {
      const q = query(
        collection(db, 'chatLogs'),
        where('userId', '==', userId),
        where('journeyId', '==', journeyId),
        orderBy('timestamp', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const messages = [];
      
      querySnapshot.forEach((doc) => {
        const messageData = doc.data();
        // Update old stage references to landmark for backwards compatibility
        if (messageData.stage !== undefined && !messageData.landmark) {
          messageData.landmark = 'sanctuary_heart'; // Default landmark for old messages
        }
        messages.push({ id: doc.id, ...messageData });
      });
      
      return messages;
    } catch (error) {
      console.error('Error loading journey messages:', error);
      return [];
    }
  }

  // New method: Update current landmark
  async updateCurrentLandmark(userId, newLandmark) {
    try {
      const journeyRef = doc(db, 'journeys', userId);
      
      await updateDoc(journeyRef, {
        currentLandmark: newLandmark,
        lastLandmarkChange: new Date().toISOString(),
      });
      
      // Update local storage
      const localData = await AsyncStorage.getItem(`journey_${userId}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        parsed.currentLandmark = newLandmark;
        await AsyncStorage.setItem(`journey_${userId}`, JSON.stringify(parsed));
      }
      
      return true;
    } catch (error) {
      console.error('Error updating landmark:', error);
      return false;
    }
  }

  // New method: Get journey statistics
  async getJourneyStats(userId) {
    try {
      const journeyRef = doc(db, 'journeys', userId);
      const journeyDoc = await getDoc(journeyRef);
      
      if (journeyDoc.exists()) {
        const data = journeyDoc.data();
        return {
          currentLandmark: data.currentLandmark || 'sanctuary_heart',
          activeCompanions: data.activeCompanions || [],
          tokenCount: data.tokenCount || 0,
          journeyStarted: data.journeyId ? new Date(parseInt(data.journeyId.split('_')[1])) : null,
          lastSaved: data.lastSaved ? new Date(data.lastSaved) : null,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting journey stats:', error);
      return null;
    }
  }
}

export default new JourneyService();