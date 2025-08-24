// ===== src/services/storyEngine.js - SIMPLIFIED ENGINE =====

import { 
  WORLD_CONFIG, 
  COMPANION_CONFIG, 
  COMPANION_RELATIONSHIPS,
  RESPONSE_CONFIG,
  SYSTEM_CONFIG,
  getRelationshipDynamic 
} from '../constants/story';
import openAIService from './openaiService';
import messageLogger from './messageLogger';
import { MESSAGE_TYPES } from '../utils/messageTypes';

class StoryEngine {
  constructor() {
    // Current state
    this.currentLandmark = 'sanctuary_heart'; // Start at the center
    this.conversationTopics = [];
    this.messageCount = 0;
    
    // Companion states
    this.companionStates = {
      elara: { lastSpoke: 0, recentTopics: [] },
      bramble: { lastSpoke: 0, recentTopics: [] },
      kael: { lastSpoke: 0, recentTopics: [] }
    };
    
    // Conversation memory
    this.conversationMemory = {
      recentMessages: [],
      currentThemes: [],
      emotionalTone: 'neutral',
      playerInterests: []
    };
  }

  // Initialize the world context
  initializeWorldContext() {
    console.log('🌟 Initializing Crystal Sanctuary...');
    console.log('📍 Starting location:', WORLD_CONFIG.landmarks[this.currentLandmark].name);
    
    return {
      world: WORLD_CONFIG,
      currentLandmark: this.currentLandmark,
      availableLandmarks: Object.keys(WORLD_CONFIG.landmarks),
      companions: Object.keys(COMPANION_CONFIG)
    };
  }

  // Analyze player message
  analyzePlayerMessage(message) {
    const analysis = {
      originalMessage: message,
      topics: [],
      mentionedCompanions: [],
      mentionedLandmarks: [],
      emotionalTone: 'neutral',
      isQuestion: message.includes('?'),
      needsInfo: [],
      expertiseNeeded: []
    };

    const lowerMessage = message.toLowerCase();

    // Check for companion mentions
    Object.keys(COMPANION_CONFIG).forEach(companion => {
      const config = COMPANION_CONFIG[companion];
      if (lowerMessage.includes(companion.toLowerCase()) || 
          config.triggers.keywords.some(keyword => lowerMessage.includes(keyword))) {
        analysis.mentionedCompanions.push(companion);
      }
    });

    // Check for landmark mentions
    Object.entries(WORLD_CONFIG.landmarks).forEach(([key, landmark]) => {
      if (lowerMessage.includes(landmark.name.toLowerCase()) ||
          landmark.themes.some(theme => lowerMessage.includes(theme))) {
        analysis.mentionedLandmarks.push(key);
      }
    });

    // Detect emotional tone
    if (lowerMessage.includes('sad') || lowerMessage.includes('depressed') || lowerMessage.includes('anxious')) {
      analysis.emotionalTone = 'distressed';
    } else if (lowerMessage.includes('happy') || lowerMessage.includes('excited') || lowerMessage.includes('wonderful')) {
      analysis.emotionalTone = 'positive';
    } else if (lowerMessage.includes('confused') || lowerMessage.includes('help') || lowerMessage.includes("don't understand")) {
      analysis.emotionalTone = 'confused';
    }

    // Detect topics and expertise needed
    Object.values(COMPANION_CONFIG).forEach(config => {
      config.triggers.topics.forEach(topic => {
        if (lowerMessage.includes(topic.split(' ').join(' '))) {
          analysis.topics.push(topic);
        }
      });
      
      config.triggers.keywords.forEach(keyword => {
        if (lowerMessage.includes(keyword)) {
          if (!analysis.expertiseNeeded.includes(config.expertise.primary[0])) {
            analysis.expertiseNeeded.push(config.expertise.primary[0]);
          }
        }
      });
    });

    // Detect information needs
    if (lowerMessage.includes('where') || lowerMessage.includes('location')) {
      analysis.needsInfo.push('location');
    }
    if (lowerMessage.includes('what') || lowerMessage.includes('explain')) {
      analysis.needsInfo.push('explanation');
    }
    if (lowerMessage.includes('how') || lowerMessage.includes('can i')) {
      analysis.needsInfo.push('guidance');
    }
    if (lowerMessage.includes('why') || lowerMessage.includes('meaning')) {
      analysis.needsInfo.push('understanding');
    }
    if (lowerMessage.includes('hi') || lowerMessage.includes('gello')) {
      analysis.needsInfo.push('greeting');
    }

    return analysis;
  }

  // Calculate companion relevance independently
  calculateCompanionRelevance(companion, playerAnalysis) {
    let relevanceScore = 0;
    const config = COMPANION_CONFIG[companion];
    const lowerMessage = playerAnalysis.originalMessage.toLowerCase();

    // Direct mention = highest relevance
    if (playerAnalysis.mentionedCompanions.includes(companion)) {
      relevanceScore += 10;
    }

    // Keyword matching
    config.triggers.keywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        relevanceScore += 2;
      }
    });

    // Topic matching
    playerAnalysis.topics.forEach(topic => {
      if (config.triggers.topics.includes(topic)) {
        relevanceScore += 3;
      }
    });

    // Expertise matching
    playerAnalysis.expertiseNeeded.forEach(expertise => {
      if (config.expertise.primary.includes(expertise)) {
        relevanceScore += 4;
      } else if (config.expertise.secondary.some(sec => sec.toLowerCase().includes(expertise))) {
        relevanceScore += 2;
      }
    });

    // Emotional tone matching
    if (playerAnalysis.emotionalTone === 'distressed' && companion === 'bramble') {
      relevanceScore += 3; // Therapist responds to distress
    } else if (playerAnalysis.emotionalTone === 'confused') {
      if (companion === 'kael') relevanceScore += 2; // Philosopher clarifies
      if (companion === 'bramble') relevanceScore += 2; // Therapist supports
    }

    // Information needs matching
    if (playerAnalysis.needsInfo.includes('understanding') && companion === 'kael') {
      relevanceScore += 3;
    }
    if (playerAnalysis.needsInfo.includes('guidance') && companion === 'bramble') {
      relevanceScore += 2;
    }
    if (playerAnalysis.needsInfo.includes('explanation') && companion === 'elara') {
      relevanceScore += 2;
    }
    if (playerAnalysis.needsInfo.includes('greeting') ) {
      relevanceScore += 2;
    }

    // Landmark affinity
    const landmarkAffinity = config.landmarkAffinities[this.currentLandmark] || 0.5;
    relevanceScore += Math.floor(landmarkAffinity * 3);

    // Recent speaking penalty (to encourage variety)
    const timeSinceSpoke = this.messageCount - this.companionStates[companion].lastSpoke;
    if (timeSinceSpoke < 2) {
      relevanceScore -= 2;
    }

    return relevanceScore;
  }

  // Determine which companions should respond
  determineRespondingCompanions(playerAnalysis) {
    const companionRelevance = [];
    
    // Calculate relevance for each companion
    const relevance_all=[];
    Object.keys(COMPANION_CONFIG).forEach(companion => {
      const relevance = this.calculateCompanionRelevance(companion, playerAnalysis);
      companionRelevance.push({
        companion,
        relevance,
        willRespond: relevance >= RESPONSE_CONFIG.relevance_thresholds.may_respond
      });
      relevance_all.push(relevance)
    });
    console.log(relevance_all)
    // Sort by relevance
    companionRelevance.sort((a, b) => b.relevance - a.relevance);

    // Determine who responds based on thresholds
    const responding = [];
    companionRelevance.forEach(({ companion, relevance, willRespond }) => {
      if (relevance >= RESPONSE_CONFIG.relevance_thresholds.must_respond) {
        responding.push(companion);
      } else if (relevance >= RESPONSE_CONFIG.relevance_thresholds.should_respond && responding.length < 2) {
        responding.push(companion);
      } else if (relevance >= RESPONSE_CONFIG.relevance_thresholds.may_respond && responding.length === 0) {
        responding.push(companion);
      }
    });

    // Limit to max companions per response
    return responding.slice(0, SYSTEM_CONFIG.conversation.max_companions_per_response);
  }

  // Check if companions should discuss among themselves
  shouldCompanionsDiscuss(playerAnalysis, respondingCompanions) {
    if (respondingCompanions.length < 2) return false;
    
    // Check collaboration triggers
    const triggers = COMPANION_RELATIONSHIPS.collaboration_triggers;
    const shouldDiscuss = triggers.some(trigger => {
      if (trigger.includes('complex') && playerAnalysis.expertiseNeeded.length > 1) return true;
      if (trigger.includes('existential') && playerAnalysis.topics.includes('life meaning')) return true;
      if (trigger.includes('confused') && playerAnalysis.emotionalTone === 'confused') return true;
      if (trigger.includes('comprehensive') && playerAnalysis.needsInfo.includes('understanding')) return true;
      return false;
    });

    // Apply probability
    return shouldDiscuss && Math.random() < SYSTEM_CONFIG.conversation.discussion_probability;
  }

  // Get current world state
  getCurrentWorldState() {
    return {
      currentLandmark: this.currentLandmark,
      landmarkDetails: WORLD_CONFIG.landmarks[this.currentLandmark],
      availableLandmarks: Object.keys(WORLD_CONFIG.landmarks),
      conversationMemory: this.conversationMemory,
      companionStates: this.companionStates
    };
  }

  // Move to a different landmark
  moveToLandmark(landmarkKey) {
    if (WORLD_CONFIG.landmarks[landmarkKey]) {
      this.currentLandmark = landmarkKey;
      console.log(`📍 Moved to ${WORLD_CONFIG.landmarks[landmarkKey].name}`);
      return true;
    }
    return false;
  }

  // Reset the engine
  reset() {
    this.currentLandmark = 'sanctuary_heart';
    this.conversationTopics = [];
    this.messageCount = 0;
    
    this.companionStates = {
      elara: { lastSpoke: 0, recentTopics: [] },
      bramble: { lastSpoke: 0, recentTopics: [] },
      kael: { lastSpoke: 0, recentTopics: [] }
    };
    
    this.conversationMemory = {
      recentMessages: [],
      currentThemes: [],
      emotionalTone: 'neutral',
      playerInterests: []
    };
    
    openAIService.reset();
    console.log('🔄 Story engine reset');
  }
}

export default new StoryEngine();