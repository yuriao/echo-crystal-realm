// ===== src/services/crystalTokenManager.js =====
// Manages token counting and crystal deduction
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import openAIService from './openaiService';

class CrystalTokenManager {
  constructor() {
    this.TOKENS_PER_CRYSTAL = 6000; // 6k tokens per crystal
    this.tokenCheckpoints = [];
    this.userId = null;
    this.tokensUsed = 0;
    this.crystals = 0;
    this.nextCrystalThreshold = 0;
  }

  // Initialize for a user
  async initializeUser(userId) {
    this.userId = userId;
    await this.refreshUserData();
  }

  // Refresh user data from Firebase
  async refreshUserData() {
    if (!this.userId) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', this.userId));
      const userData = userDoc.data();
      
      this.tokensUsed = userData?.tokensUsed || 0;
      this.crystals = userData?.crystals || 0;
      this.nextCrystalThreshold = Math.ceil(this.tokensUsed / this.TOKENS_PER_CRYSTAL) * this.TOKENS_PER_CRYSTAL;
      
      if (this.nextCrystalThreshold <= this.tokensUsed) {
        this.nextCrystalThreshold += this.TOKENS_PER_CRYSTAL;
      }
      
      console.log('CrystalTokenManager refreshed:', {
        userId: this.userId,
        tokensUsed: this.tokensUsed,
        crystals: this.crystals,
        nextThreshold: this.nextCrystalThreshold
      });
      
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }

  // Update token count and check for crystal requirement
  async updateTokenCount(newTokens) {
    this.tokensUsed += newTokens;
    
    // Update in Firebase
    try {
      await updateDoc(doc(db, 'users', this.userId), {
        tokensUsed: this.tokensUsed,
        lastTokenUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating tokens in Firebase:', error);
    }

    // Check if we've hit the threshold
    if (this.tokensUsed >= this.nextCrystalThreshold) {
      return await this.checkCrystalRequirement();
    }

    return { requiresCrystal: false };
  }

  // Check if crystal is required
  async checkCrystalRequirement() {
    // Get current crystal count (refresh from Firebase)
    await this.refreshUserData();

    if (this.crystals > 0) {
      // Deduct crystal automatically
      const deductResult = await this.deductCrystal();
      return { 
        requiresCrystal: true, 
        crystalDeducted: deductResult.success,
        remainingCrystals: deductResult.remainingCrystals,
        crystalCost: 1
      };
    } else {
      // No crystals available
      return { 
        requiresCrystal: true, 
        crystalDeducted: false,
        remainingCrystals: 0,
        crystalCost: 1
      };
    }
  }

  // Force crystal use (when user explicitly chooses to use a crystal)
  async forceCrystalUse() {
    // Refresh data first
    await this.refreshUserData();
    
    if (this.crystals <= 0) {
      return {
        success: false,
        error: 'No crystals available',
        remainingCrystals: 0
      };
    }
    
    const deductResult = await this.deductCrystal();
    
    if (deductResult.success) {
      return {
        success: true,
        remainingCrystals: deductResult.remainingCrystals,
        message: 'Crystal used successfully'
      };
    } else {
      return {
        success: false,
        error: 'Failed to deduct crystal',
        remainingCrystals: this.crystals
      };
    }
  }

  // Deduct a crystal
  async deductCrystal() {
    try {
      // Double-check we have crystals
      if (this.crystals <= 0) {
        return {
          success: false,
          remainingCrystals: 0,
          error: 'No crystals available'
        };
      }
      
      await updateDoc(doc(db, 'users', this.userId), {
        crystals: increment(-1),
        lastCrystalUse: new Date().toISOString()
      });
      
      this.crystals--;
      this.nextCrystalThreshold += this.TOKENS_PER_CRYSTAL;
      
      // Log crystal usage
      this.tokenCheckpoints.push({
        timestamp: new Date().toISOString(),
        tokensAtCheckpoint: this.tokensUsed,
        crystalsRemaining: this.crystals,
        type: 'crystal_deducted'
      });
      
      console.log('Crystal deducted successfully:', {
        userId: this.userId,
        remainingCrystals: this.crystals,
        newThreshold: this.nextCrystalThreshold
      });
      
      return {
        success: true,
        remainingCrystals: this.crystals
      };
      
    } catch (error) {
      console.error('Error deducting crystal:', error);
      return {
        success: false,
        remainingCrystals: this.crystals,
        error: error.message
      };
    }
  }

  // Get progress towards next crystal requirement
  getProgress() {
    const tokensUntilNextCrystal = this.nextCrystalThreshold - this.tokensUsed;
    const progressPercentage = ((this.TOKENS_PER_CRYSTAL - tokensUntilNextCrystal) / this.TOKENS_PER_CRYSTAL) * 100;
    
    return {
      tokensUsed: this.tokensUsed,
      tokensUntilNextCrystal: Math.max(0, tokensUntilNextCrystal),
      progressPercentage: Math.max(0, Math.min(100, progressPercentage)),
      currentCrystals: this.crystals,
      nextThreshold: this.nextCrystalThreshold
    };
  }

  // Get total tokens from OpenAI service
  getCurrentTokenCount() {
    return openAIService.getTotalTokens();
  }

  // Get current crystal count
  getCurrentCrystals() {
    return this.crystals;
  }

  // Method to be called after crystal purchase to refresh data
  async onCrystalsPurchased(amount) {
    console.log(`Crystal purchase detected: +${amount} crystals`);
    
    // Refresh user data from Firebase
    await this.refreshUserData();
    
    // Log the purchase
    this.tokenCheckpoints.push({
      timestamp: new Date().toISOString(),
      tokensAtCheckpoint: this.tokensUsed,
      crystalsRemaining: this.crystals,
      type: 'crystal_purchased',
      amount: amount
    });
    
    console.log('Crystal balance updated after purchase:', {
      userId: this.userId,
      newBalance: this.crystals,
      purchaseAmount: amount
    });
  }

  // Reset for new user session
  reset() {
    this.userId = null;
    this.tokensUsed = 0;
    this.crystals = 0;
    this.nextCrystalThreshold = 0;
    this.tokenCheckpoints = [];
  }

  // Get usage statistics
  getUsageStats() {
    return {
      userId: this.userId,
      tokensUsed: this.tokensUsed,
      crystals: this.crystals,
      nextThreshold: this.nextCrystalThreshold,
      checkpoints: this.tokenCheckpoints,
      tokensPerCrystal: this.TOKENS_PER_CRYSTAL
    };
  }
}

export default new CrystalTokenManager();