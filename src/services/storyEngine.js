// ===== src/services/storyEngine.js - ENHANCED ENGINE =====

import { 
  WORLD_CONFIG, 
  COMPANION_CONFIG, 
  SYSTEM_CONFIG,
} from '../constants/story';
import openAIService from './openaiService';

class StoryEngine {
  constructor() {
    // Current state
    this.currentLandmark = 'sanctuary_heart'; // Start at the center
    this.conversationTopics = [];
    this.messageCount = 0;
    
    // Companion states
    this.companionStates = {
      elara: { lastSpoke: 0, recentTopics: [], mood: 'neutral', engagement: 0 },
      bramble: { lastSpoke: 0, recentTopics: [], mood: 'neutral', engagement: 0 },
      kael: { lastSpoke: 0, recentTopics: [], mood: 'neutral', engagement: 0 }
    };
    
    // Enhanced conversation memory
    this.conversationMemory = {
      recentMessages: [],
      currentThemes: [],
      emotionalTone: 'neutral',
      playerInterests: [],
      conversationPhase: 'introduction', // introduction, exploration, deep_discussion, conclusion
      previousIntents: [],
      userProfile: {
        communicationStyle: 'neutral', // formal, casual, technical, emotional
        engagementLevel: 'medium', // low, medium, high
        preferredCompanion: null
      }
    };

    // Intent patterns for comprehensive analysis
    this.intentPatterns = {
      greeting: {
        keywords: ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'howdy', 'sup', "what's up"],
        regex: /^(hi|hello|hey|yo|greetings?|good\s+(morning|afternoon|evening|day))/i
      },
      farewell: {
        keywords: ['bye', 'goodbye', 'see you', 'farewell', 'later', 'exit', 'quit', 'leave'],
        regex: /(bye|goodbye|see\s+you|farewell|talk\s+to\s+you\s+later|gotta\s+go|exit|quit)/i
      },
      informational: {
        keywords: ['what', 'when', 'where', 'who', 'why', 'how', 'explain', 'tell me', 'describe', 'info', 'information'],
        regex: /(what|when|where|who|why|how|explain|tell\s+me|describe|know\s+about)/i
      },
      navigational: {
        keywords: ['go', 'move', 'travel', 'visit', 'explore', 'journey', 'direction', 'map', 'location', 'landmark'],
        regex: /(go\s+to|move\s+to|travel|visit|explore|journey|where\s+is|how\s+to\s+get|direction|location)/i
      },
      emotional: {
        keywords: ['feel', 'feeling', 'emotion', 'mood', 'sad', 'happy', 'angry', 'anxious', 'depressed', 'excited', 'scared', 'worried', 'stressed'],
        regex: /(feel(ing)?|emotion|mood|sad|happy|angry|anxious|depressed|excited|scared|worried|stressed|overwhelmed)/i
      },
      help: {
        keywords: ['help', 'assist', 'support', 'problem', 'issue', 'stuck', 'confused', 'lost', 'guide', 'advice'],
        regex: /(help|assist|support|problem|issue|stuck|confused|lost|guide|advice|don't\s+understand|need\s+help)/i
      },
      philosophical: {
        keywords: ['meaning', 'purpose', 'life', 'existence', 'reality', 'truth', 'philosophy', 'believe', 'think', 'wonder'],
        regex: /(meaning|purpose|life|existence|reality|truth|philosophy|believe|wonder|consciousness|universe)/i
      },
      casual: {
        keywords: ['chat', 'talk', 'conversation', 'discuss', 'random', 'bored', 'fun', 'interesting'],
        regex: /(chat|talk|conversation|discuss|bored|fun|interesting|tell\s+me\s+something)/i
      },
      feedback: {
        keywords: ['good', 'bad', 'great', 'terrible', 'awesome', 'amazing', 'horrible', 'like', 'dislike', 'love', 'hate'],
        regex: /(good|bad|great|terrible|awesome|amazing|horrible|like|dislike|love|hate|excellent|poor)/i
      },
      technical: {
        keywords: ['system', 'function', 'work', 'mechanism', 'process', 'algorithm', 'method', 'technique'],
        regex: /(system|function|work|mechanism|process|algorithm|method|technique|how\s+does.*work)/i
      },
      story: {
        keywords: ['story', 'tale', 'narrative', 'history', 'past', 'remember', 'memory', 'experience'],
        regex: /(story|tale|narrative|history|past|remember|memory|experience|tell\s+me\s+about)/i
      },
      preference: {
        keywords: ['prefer', 'favorite', 'best', 'worst', 'rather', 'choose', 'like better'],
        regex: /(prefer|favorite|best|worst|rather|choose|like\s+better|would\s+you\s+rather)/i
      },
      agreement: {
        keywords: ['yes', 'yeah', 'yep', 'sure', 'okay', 'agree', 'right', 'correct', 'absolutely', 'definitely'],
        regex: /(yes|yeah|yep|sure|okay|agree|right|correct|absolutely|definitely|of\s+course)/i
      },
      disagreement: {
        keywords: ['no', 'nope', 'disagree', 'wrong', 'incorrect', 'false', 'not really', 'doubt'],
        regex: /(no|nope|disagree|wrong|incorrect|false|not\s+really|doubt|don't\s+think\s+so)/i
      },
      clarification: {
        keywords: ['mean', 'meant', 'clarify', 'explain more', 'elaborate', 'understand', 'confusing'],
        regex: /(what\s+do\s+you\s+mean|clarify|explain\s+more|elaborate|don't\s+understand|confusing)/i
      }
    };

    // Emotional state indicators
    this.emotionalIndicators = {
      positive: {
        strong: ['amazing', 'wonderful', 'fantastic', 'excellent', 'love', 'ecstatic', 'thrilled'],
        moderate: ['happy', 'good', 'nice', 'pleased', 'content', 'satisfied', 'glad'],
        mild: ['okay', 'fine', 'alright', 'decent', 'not bad']
      },
      negative: {
        strong: ['terrible', 'horrible', 'awful', 'hate', 'furious', 'devastated', 'miserable'],
        moderate: ['sad', 'upset', 'angry', 'frustrated', 'disappointed', 'annoyed', 'worried'],
        mild: ['concerned', 'unsure', 'uncomfortable', 'uneasy', 'tired']
      },
      neutral: {
        indicators: ['neutral', 'indifferent', 'whatever', 'meh', "don't care", 'no preference']
      }
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

  // Enhanced player message analysis
  analyzePlayerMessage(message) {
    const analysis = {
      originalMessage: message,
      intents: [],
      topics: [],
      mentionedCompanions: [],
      mentionedLandmarks: [],
      emotionalTone: 'neutral',
      emotionalIntensity: 0, // 0-10 scale
      sentimentScore: 0, // -1 to 1
      isQuestion: false,
      needsInfo: [],
      expertiseNeeded: [],
      conversationStyle: 'neutral',
      urgency: 'normal', // low, normal, high, urgent
      complexity: 'simple', // simple, moderate, complex
      userEngagement: 'active', // passive, active, highly_engaged
      messageLength: message.length,
      wordCount: message.split(/\s+/).length,
      contextualCues: [],
      edgeCases: []
    };

    const lowerMessage = message.toLowerCase();
    const words = lowerMessage.split(/\s+/);

    // Detect multiple intents (a message can have multiple intents)
    Object.entries(this.intentPatterns).forEach(([intent, pattern]) => {
      if (pattern.regex.test(lowerMessage) || 
          pattern.keywords.some(keyword => lowerMessage.includes(keyword))) {
        analysis.intents.push(intent);
      }
    });

    // Detect question type
    analysis.isQuestion = message.includes('?') || 
                          /^(what|when|where|who|why|how|is|are|can|could|would|should|do|does|did)/i.test(message);

    // Analyze emotional tone with intensity
    const emotionalAnalysis = this.analyzeEmotionalTone(lowerMessage, words);
    analysis.emotionalTone = emotionalAnalysis.tone;
    analysis.emotionalIntensity = emotionalAnalysis.intensity;
    analysis.sentimentScore = emotionalAnalysis.sentiment;

    // Check for companion mentions with nickname detection
    Object.keys(COMPANION_CONFIG).forEach(companion => {
      const config = COMPANION_CONFIG[companion];
      const companionMentioned = lowerMessage.includes(companion.toLowerCase()) || 
                                 config.triggers.keywords.some(keyword => lowerMessage.includes(keyword));
      
      if (companionMentioned) {
        analysis.mentionedCompanions.push(companion);
      }
    });

    // Check for landmark mentions with contextual understanding
    Object.entries(WORLD_CONFIG.landmarks).forEach(([key, landmark]) => {
      const landmarkMentioned = lowerMessage.includes(landmark.name.toLowerCase()) ||
                                landmark.themes.some(theme => lowerMessage.includes(theme));
      
      if (landmarkMentioned) {
        analysis.mentionedLandmarks.push(key);
      }
    });

    // Detect topics with weighted relevance
    this.detectTopics(lowerMessage, analysis);

    // Analyze message complexity
    analysis.complexity = this.analyzeComplexity(message, analysis);

    // Detect urgency
    analysis.urgency = this.detectUrgency(lowerMessage, analysis);

    // Analyze conversation style
    analysis.conversationStyle = this.analyzeConversationStyle(message, words);

    // Detect information needs with context
    this.detectInformationNeeds(lowerMessage, analysis);

    // Detect expertise needed
    this.detectExpertiseNeeded(lowerMessage, analysis);

    // Detect edge cases
    analysis.edgeCases = this.detectEdgeCases(message, lowerMessage, analysis);

    // Update conversation memory
    this.updateConversationMemory(analysis);

    return analysis;
  }

  // Analyze emotional tone with more nuance
  analyzeEmotionalTone(lowerMessage, words) {
    let emotionalTone = 'neutral';
    let intensity = 5;
    let sentiment = 0;
    let positiveCount = 0;
    let negativeCount = 0;

    // Check positive indicators
    Object.entries(this.emotionalIndicators.positive).forEach(([level, indicators]) => {
      indicators.forEach(indicator => {
        if (lowerMessage.includes(indicator)) {
          positiveCount++;
          if (level === 'strong') {
            intensity = Math.max(intensity, 9);
            sentiment += 0.8;
          } else if (level === 'moderate') {
            intensity = Math.max(intensity, 7);
            sentiment += 0.5;
          } else {
            intensity = Math.max(intensity, 5);
            sentiment += 0.2;
          }
        }
      });
    });

    // Check negative indicators
    Object.entries(this.emotionalIndicators.negative).forEach(([level, indicators]) => {
      indicators.forEach(indicator => {
        if (lowerMessage.includes(indicator)) {
          negativeCount++;
          if (level === 'strong') {
            intensity = Math.max(intensity, 9);
            sentiment -= 0.8;
          } else if (level === 'moderate') {
            intensity = Math.max(intensity, 7);
            sentiment -= 0.5;
          } else {
            intensity = Math.max(intensity, 5);
            sentiment -= 0.2;
          }
        }
      });
    });

    // Determine primary emotional tone
    if (positiveCount > negativeCount) {
      emotionalTone = 'positive';
    } else if (negativeCount > positiveCount) {
      emotionalTone = 'negative';
    } else if (positiveCount === 0 && negativeCount === 0) {
      // Check for specific emotional states
      if (/anxious|worried|nervous|stressed/i.test(lowerMessage)) {
        emotionalTone = 'anxious';
        intensity = 7;
        sentiment = -0.3;
      } else if (/confused|lost|don't understand/i.test(lowerMessage)) {
        emotionalTone = 'confused';
        intensity = 6;
        sentiment = -0.1;
      } else if (/curious|wonder|interested/i.test(lowerMessage)) {
        emotionalTone = 'curious';
        intensity = 6;
        sentiment = 0.2;
      }
    }

    // Normalize sentiment score
    sentiment = Math.max(-1, Math.min(1, sentiment / Math.max(1, positiveCount + negativeCount)));

    return { tone: emotionalTone, intensity, sentiment };
  }

  // Detect topics with weighted relevance
  detectTopics(lowerMessage, analysis) {
    const topicKeywords = {
      'emotional_support': ['feeling', 'emotion', 'mood', 'support', 'help me'],
      'exploration': ['explore', 'discover', 'find', 'search', 'look for'],
      'philosophy': ['meaning', 'purpose', 'existence', 'truth', 'reality'],
      'creativity': ['create', 'imagine', 'design', 'art', 'music'],
      'memories': ['remember', 'memory', 'past', 'history', 'story'],
      'relationships': ['friend', 'companion', 'together', 'relationship'],
      'personal_growth': ['learn', 'grow', 'improve', 'better', 'change'],
      'problem_solving': ['solve', 'fix', 'solution', 'problem', 'issue'],
      'meditation': ['meditate', 'calm', 'peace', 'relax', 'mindfulness'],
      'nature': ['nature', 'crystal', 'garden', 'forest', 'water']
    };

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        analysis.topics.push(topic);
      }
    });
  }

  // Analyze message complexity
  analyzeComplexity(message, analysis) {
    const factors = {
      wordCount: analysis.wordCount,
      questionCount: (message.match(/\?/g) || []).length,
      topicCount: analysis.topics.length,
      intentCount: analysis.intents.length,
      hasMultipleClauses: /,|;|and|but|or|because|although|however/i.test(message)
    };

    let complexityScore = 0;
    
    if (factors.wordCount > 20) complexityScore += 2;
    else if (factors.wordCount > 10) complexityScore += 1;
    
    if (factors.questionCount > 1) complexityScore += 2;
    else if (factors.questionCount === 1) complexityScore += 1;
    
    if (factors.topicCount > 2) complexityScore += 2;
    else if (factors.topicCount > 1) complexityScore += 1;
    
    if (factors.intentCount > 2) complexityScore += 2;
    else if (factors.intentCount > 1) complexityScore += 1;
    
    if (factors.hasMultipleClauses) complexityScore += 1;

    if (complexityScore >= 6) return 'complex';
    if (complexityScore >= 3) return 'moderate';
    return 'simple';
  }

  // Detect urgency in message
  detectUrgency(lowerMessage, analysis) {
    const urgentKeywords = ['urgent', 'emergency', 'immediately', 'now', 'quick', 'asap', 'hurry', 'crisis'];
    const highKeywords = ['important', 'need', 'must', 'have to', 'critical'];
    const lowKeywords = ['whenever', 'no rush', 'when you can', 'later', 'eventually'];

    if (urgentKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'urgent';
    }
    if (highKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'high';
    }
    if (lowKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'low';
    }
    
    // Check emotional intensity for urgency
    if (analysis.emotionalIntensity >= 8) {
      return 'high';
    }
    
    return 'normal';
  }

  // Analyze conversation style
  analyzeConversationStyle(message, words) {
    const formalIndicators = ['please', 'thank you', 'excuse me', 'pardon', 'kindly', 'would you'];
    const casualIndicators = ['hey', 'yeah', 'gonna', 'wanna', 'kinda', 'sorta', 'lol', 'btw'];
    const technicalIndicators = ['algorithm', 'system', 'process', 'function', 'mechanism', 'technical'];
    const emotionalIndicators = ['feel', 'feeling', 'emotion', 'heart', 'soul'];

    let styleScores = {
      formal: 0,
      casual: 0,
      technical: 0,
      emotional: 0
    };

    formalIndicators.forEach(indicator => {
      if (message.toLowerCase().includes(indicator)) styleScores.formal++;
    });
    casualIndicators.forEach(indicator => {
      if (message.toLowerCase().includes(indicator)) styleScores.casual++;
    });
    technicalIndicators.forEach(indicator => {
      if (message.toLowerCase().includes(indicator)) styleScores.technical++;
    });
    emotionalIndicators.forEach(indicator => {
      if (message.toLowerCase().includes(indicator)) styleScores.emotional++;
    });

    // Check for capitalization and punctuation
    if (message[0] === message[0].toUpperCase() && message.endsWith('.')) {
      styleScores.formal++;
    }

    // Determine dominant style
    const maxScore = Math.max(...Object.values(styleScores));
    if (maxScore === 0) return 'neutral';
    
    return Object.entries(styleScores).find(([style, score]) => score === maxScore)[0];
  }

  // Detect information needs
  detectInformationNeeds(lowerMessage, analysis) {
    const needsMapping = {
      'location': ['where', 'location', 'place', 'direction', 'map'],
      'explanation': ['what', 'explain', 'describe', 'definition', 'means'],
      'guidance': ['how', 'can i', 'should i', 'help me', 'guide'],
      'understanding': ['why', 'reason', 'meaning', 'purpose', 'because'],
      'validation': ['right', 'correct', 'true', 'valid', 'sure'],
      'options': ['choices', 'options', 'alternatives', 'possibilities', 'or'],
      'recommendation': ['suggest', 'recommend', 'advice', 'best', 'should'],
      'confirmation': ['confirm', 'verify', 'check', 'sure', 'certain']
    };

    Object.entries(needsMapping).forEach(([need, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        analysis.needsInfo.push(need);
      }
    });

    // Add greeting need if greeting intent detected
    if (analysis.intents.includes('greeting')) {
      analysis.needsInfo.push('greeting');
    }
  }

  // Detect expertise needed
  detectExpertiseNeeded(lowerMessage, analysis) {
    const expertiseMapping = {
      'emotional_intelligence': ['feeling', 'emotion', 'mood', 'anxiety', 'depression', 'stress'],
      'guidance': ['help', 'support', 'guide', 'advice', 'suggest'],
      'philosophical': ['meaning', 'purpose', 'existence', 'philosophy', 'truth'],
      'technical': ['system', 'function', 'mechanism', 'work', 'process'],
      'creative': ['create', 'imagine', 'art', 'music', 'design'],
      'analytical': ['analyze', 'understand', 'explain', 'reason', 'logic'],
      'narrative': ['story', 'tale', 'history', 'memory', 'experience']
    };

    Object.entries(expertiseMapping).forEach(([expertise, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        analysis.expertiseNeeded.push(expertise);
      }
    });
  }

  // Detect edge cases and special scenarios
  detectEdgeCases(message, lowerMessage, analysis) {
    const edgeCases = [];

    // Empty or very short message
    if (message.trim().length < 3) {
      edgeCases.push('minimal_input');
    }

    // Only punctuation or symbols
    if (/^[^a-zA-Z0-9]+$/.test(message)) {
      edgeCases.push('symbols_only');
    }

    // Excessive repetition
    if (/(.)\1{4,}/.test(message)) {
      edgeCases.push('repetitive_characters');
    }

    // All caps (shouting)
    if (message === message.toUpperCase() && message.length > 5) {
      edgeCases.push('all_caps');
    }

    // Multiple languages detected (simplified check)
    if (/[^\x00-\x7F]/.test(message)) {
      edgeCases.push('non_ascii_characters');
    }

    // Contradictory intents
    if (analysis.intents.includes('greeting') && analysis.intents.includes('farewell')) {
      edgeCases.push('contradictory_intents');
    }

    // Sarcasm indicators
    if (/yeah right|sure thing|oh great|wonderful \(not\)|just perfect/i.test(lowerMessage)) {
      edgeCases.push('potential_sarcasm');
    }

    // Code or technical syntax
    if (/function\(|var |const |if\(|for\(|\{|\}|<\/?\w+>/.test(message)) {
      edgeCases.push('code_syntax');
    }

    // Sensitive topics
    if (/suicide|self.?harm|kill myself|end it all/i.test(lowerMessage)) {
      edgeCases.push('crisis_situation');
    }

    return edgeCases;
  }

  // Update conversation memory with analysis
  updateConversationMemory(analysis) {
    // Add to recent messages
    this.conversationMemory.recentMessages.push({
      message: analysis.originalMessage,
      intents: analysis.intents,
      emotionalTone: analysis.emotionalTone,
      timestamp: Date.now()
    });

    // Keep only last 10 messages
    if (this.conversationMemory.recentMessages.length > 10) {
      this.conversationMemory.recentMessages.shift();
    }

    // Update emotional tone (weighted average of recent messages)
    const recentEmotions = this.conversationMemory.recentMessages.map(m => m.emotionalTone);
    const emotionCounts = {};
    recentEmotions.forEach(emotion => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    
    const dominantEmotion = Object.entries(emotionCounts).reduce((a, b) => 
      emotionCounts[a[0]] > emotionCounts[b[0]] ? a : b
    );
    this.conversationMemory.emotionalTone = dominantEmotion[0];

    // Update current themes
    analysis.topics.forEach(topic => {
      if (!this.conversationMemory.currentThemes.includes(topic)) {
        this.conversationMemory.currentThemes.push(topic);
      }
    });

    // Keep only last 5 themes
    if (this.conversationMemory.currentThemes.length > 5) {
      this.conversationMemory.currentThemes = this.conversationMemory.currentThemes.slice(-5);
    }

    // Update player interests based on topics
    analysis.topics.forEach(topic => {
      if (!this.conversationMemory.playerInterests.includes(topic)) {
        this.conversationMemory.playerInterests.push(topic);
      }
    });

    // Update conversation phase
    this.updateConversationPhase(analysis);

    // Update user profile
    this.updateUserProfile(analysis);
  }

  // Update conversation phase based on patterns
  updateConversationPhase(analysis) {
    const messageCount = this.conversationMemory.recentMessages.length;
    
    if (analysis.intents.includes('greeting') || messageCount <= 2) {
      this.conversationMemory.conversationPhase = 'introduction';
    } else if (analysis.intents.includes('farewell')) {
      this.conversationMemory.conversationPhase = 'conclusion';
    } else if (analysis.complexity === 'complex' || analysis.topics.includes('philosophy')) {
      this.conversationMemory.conversationPhase = 'deep_discussion';
    } else {
      this.conversationMemory.conversationPhase = 'exploration';
    }
  }

  // Update user profile based on interaction patterns
  updateUserProfile(analysis) {
    // Update communication style
    if (analysis.conversationStyle !== 'neutral') {
      this.conversationMemory.userProfile.communicationStyle = analysis.conversationStyle;
    }

    // Update engagement level
    if (analysis.wordCount > 20 || analysis.complexity === 'complex') {
      this.conversationMemory.userProfile.engagementLevel = 'high';
    } else if (analysis.wordCount < 5) {
      this.conversationMemory.userProfile.engagementLevel = 'low';
    } else {
      this.conversationMemory.userProfile.engagementLevel = 'medium';
    }

    // Track preferred companion based on mentions
    if (analysis.mentionedCompanions.length > 0) {
      const companion = analysis.mentionedCompanions[0];
      this.conversationMemory.userProfile.preferredCompanion = companion;
    }
  }

  // Enhanced companion relevance calculation
  calculateCompanionRelevance(companion, playerAnalysis) {
    let relevanceScore = 0;
    const config = COMPANION_CONFIG[companion];
    const lowerMessage = playerAnalysis.originalMessage.toLowerCase();

    // Direct mention = highest relevance
    if (playerAnalysis.mentionedCompanions.includes(companion)) {
      relevanceScore += 15;
    }

    // Intent-based relevance
    const intentRelevance = {
      elara: ['informational', 'navigational', 'story', 'technical'],
      bramble: ['emotional', 'help', 'casual', 'feedback'],
      kael: ['philosophical', 'clarification', 'preference', 'technical']
    };

    playerAnalysis.intents.forEach(intent => {
      if (intentRelevance[companion]?.includes(intent)) {
        relevanceScore += 4;
      }
    });

    // Handle greeting intent - all companions can respond
    if (playerAnalysis.intents.includes('greeting')) {
      relevanceScore += 3;
      
      // Bonus for companions who haven't spoken recently
      const timeSinceSpoke = this.messageCount - this.companionStates[companion].lastSpoke;
      if (timeSinceSpoke > 5) {
        relevanceScore += 2;
      }
    }

    // Handle farewell - companions with ongoing conversations get priority
    if (playerAnalysis.intents.includes('farewell')) {
      if (this.companionStates[companion].engagement > 5) {
        relevanceScore += 5;
      } else {
        relevanceScore += 2;
      }
    }

    // Emotional tone matching with nuance
    const emotionalRelevance = this.calculateEmotionalRelevance(companion, playerAnalysis);
    relevanceScore += emotionalRelevance;

    // Topic matching
    playerAnalysis.topics.forEach(topic => {
      if (config.triggers.topics.includes(topic)) {
        relevanceScore += 3;
      }
    });

    // Expertise matching
    playerAnalysis.expertiseNeeded.forEach(expertise => {
      if (config.expertise.primary.includes(expertise)) {
        relevanceScore += 5;
      } else if (config.expertise.secondary.some(sec => sec.toLowerCase().includes(expertise))) {
        relevanceScore += 3;
      }
    });

    // Complexity-based relevance
    if (playerAnalysis.complexity === 'complex') {
      if (companion === 'kael') relevanceScore += 4; // Philosopher handles complex topics
      if (companion === 'elara') relevanceScore += 2; // Guide can explain complex things
    } else if (playerAnalysis.complexity === 'simple') {
      if (companion === 'bramble') relevanceScore += 2; // Therapist good for simple support
    }

    // Urgency-based relevance
    if (playerAnalysis.urgency === 'urgent' || playerAnalysis.urgency === 'high') {
      if (companion === 'bramble') relevanceScore += 4; // Therapist responds to urgency
      if (companion === 'elara') relevanceScore += 2; // Guide provides quick help
    }

    // Information needs matching
    const infoNeedsRelevance = {
      elara: ['location', 'explanation', 'options', 'recommendation'],
      bramble: ['guidance', 'validation', 'confirmation', 'greeting'],
      kael: ['understanding', 'validation', 'explanation']
    };

    playerAnalysis.needsInfo.forEach(need => {
      if (infoNeedsRelevance[companion]?.includes(need)) {
        relevanceScore += 3;
      }
    });

    // Conversation phase relevance
    const phaseRelevance = {
      introduction: { elara: 3, bramble: 2, kael: 1 },
      exploration: { elara: 3, bramble: 2, kael: 2 },
      deep_discussion: { kael: 4, bramble: 3, elara: 2 },
      conclusion: { bramble: 3, elara: 2, kael: 2 }
    };
    
    relevanceScore += phaseRelevance[this.conversationMemory.conversationPhase]?.[companion] || 0;

    // User profile matching
    if (this.conversationMemory.userProfile.preferredCompanion === companion) {
      relevanceScore += 3;
    }

    // Communication style matching
    const styleMatch = {
      formal: { kael: 2, elara: 1, bramble: 0 },
      casual: { bramble: 2, elara: 1, kael: 0 },
      technical: { elara: 2, kael: 2, bramble: 0 },
      emotional: { bramble: 3, kael: 1, elara: 1 }
    };
    
    relevanceScore += styleMatch[playerAnalysis.conversationStyle]?.[companion] || 0;

    // Edge case handling
    if (playerAnalysis.edgeCases.includes('crisis_situation')) {
      if (companion === 'bramble') relevanceScore += 10; // Therapist handles crisis
    }
    if (playerAnalysis.edgeCases.includes('minimal_input')) {
      if (companion === 'elara') relevanceScore += 2; // Guide can prompt for more
    }
    if (playerAnalysis.edgeCases.includes('potential_sarcasm')) {
      if (companion === 'bramble') relevanceScore += 2; // Therapist understands emotions
    }

    // Keyword matching with context
    config.triggers.keywords.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        relevanceScore += 2;
      }
    });

    // Landmark affinity
    const landmarkAffinity = config.landmarkAffinities[this.currentLandmark] || 0.5;
    relevanceScore += Math.floor(landmarkAffinity * 3);

    // Recent speaking penalty with decay
    const timeSinceSpoke = this.messageCount - this.companionStates[companion].lastSpoke;
    if (timeSinceSpoke < 2) {
      relevanceScore -= 3;
    } else if (timeSinceSpoke < 4) {
      relevanceScore -= 1;
    } else if (timeSinceSpoke > 10) {
      relevanceScore += 1; // Bonus for long silence
    }

    // Engagement bonus
    if (this.companionStates[companion].engagement > 5) {
      relevanceScore += 2;
    }

    // Ensure minimum score for edge cases
    if (playerAnalysis.edgeCases.length > 0 && relevanceScore < 3) {
      relevanceScore = 3; // Ensure someone responds to edge cases
    }

    return Math.max(0, relevanceScore); // Ensure non-negative score
  }

  // Calculate emotional relevance for companion
  calculateEmotionalRelevance(companion, playerAnalysis) {
    let emotionalScore = 0;
    const tone = playerAnalysis.emotionalTone;
    const intensity = playerAnalysis.emotionalIntensity;

    // Bramble (therapist) responds strongly to emotional content
    if (companion === 'bramble') {
      if (tone === 'negative' || tone === 'anxious') {
        emotionalScore += 5 + Math.floor(intensity / 2);
      } else if (tone === 'confused') {
        emotionalScore += 4;
      } else if (tone === 'positive') {
        emotionalScore += 2;
      }
    }
    
    // Kael (philosopher) responds to existential emotions
    if (companion === 'kael') {
      if (tone === 'confused' || tone === 'curious') {
        emotionalScore += 4;
      } else if (intensity > 7) {
        emotionalScore += 2; // Responds to intense emotions philosophically
      }
    }
    
    // Elara (guide) provides balanced support
    if (companion === 'elara') {
      if (tone === 'curious') {
        emotionalScore += 3;
      } else if (tone === 'confused') {
        emotionalScore += 3;
      } else if (intensity < 5) {
        emotionalScore += 2; // Good for neutral conversations
      }
    }

    return emotionalScore;
  }

  // Enhanced companion response determination
  determineRespondingCompanions(playerAnalysis) {
    const companionRelevance = [];
    
    // Calculate relevance for each companion
    Object.keys(COMPANION_CONFIG).forEach(companion => {
      const relevance = this.calculateCompanionRelevance(companion, playerAnalysis);
      companionRelevance.push({
        companion,
        relevance,
        config: COMPANION_CONFIG[companion]
      });
    });

    // Sort by relevance
    companionRelevance.sort((a, b) => b.relevance - a.relevance);

    // Log relevance scores for debugging
    console.log('Companion Relevance Scores:', companionRelevance.map(c => ({
      companion: c.companion,
      relevance: c.relevance
    })));

    // Dynamic thresholds based on context
    const thresholds = this.calculateDynamicThresholds(playerAnalysis);
    
    // Determine who responds
    const responding = [];
    let totalRelevance = companionRelevance.reduce((sum, c) => sum + c.relevance, 0);
    
    companionRelevance.forEach(({ companion, relevance }) => {
      // Must respond threshold
      if (relevance >= thresholds.must_respond) {
        responding.push(companion);
      }
      // Should respond threshold
      else if (relevance >= thresholds.should_respond && responding.length < 2) {
        responding.push(companion);
      }
      // May respond threshold (ensure at least one companion responds)
      else if (relevance >= thresholds.may_respond && responding.length === 0) {
        responding.push(companion);
      }
    });

    // Special handling for different scenarios
    if (playerAnalysis.intents.includes('greeting') && responding.length === 0) {
      // For greetings, pick the companion who hasn't spoken recently
      const leastRecent = companionRelevance.sort((a, b) => 
        this.companionStates[a.companion].lastSpoke - this.companionStates[b.companion].lastSpoke
      )[0];
      responding.push(leastRecent.companion);
    }

    // Ensure at least one companion responds (fallback)
    if (responding.length === 0 && companionRelevance.length > 0) {
      responding.push(companionRelevance[0].companion);
    }

    // Handle crisis situations
    if (playerAnalysis.edgeCases.includes('crisis_situation')) {
      if (!responding.includes('bramble')) {
        responding.unshift('bramble'); // Bramble takes priority in crisis
      }
    }

    // Limit to max companions per response
    const maxCompanions = this.determineMaxCompanions(playerAnalysis);
    const finalResponding = responding.slice(0, maxCompanions);

    // Update companion states
    finalResponding.forEach(companion => {
      this.companionStates[companion].lastSpoke = this.messageCount;
      this.companionStates[companion].engagement++;
      this.companionStates[companion].recentTopics = playerAnalysis.topics;
    });

    this.messageCount++;

    return finalResponding;
  }

  // Calculate dynamic thresholds based on context
  calculateDynamicThresholds(playerAnalysis) {
    let thresholds = {
      must_respond: 6,
      should_respond: 4,
      may_respond: 2
    };

    // Lower thresholds for urgent or emotional messages
    if (playerAnalysis.urgency === 'urgent' || playerAnalysis.emotionalIntensity > 7) {
      thresholds.must_respond -= 2;
      thresholds.should_respond -= 2;
      thresholds.may_respond -= 1;
    }

    // Lower thresholds for complex messages
    if (playerAnalysis.complexity === 'complex') {
      thresholds.must_respond -= 1;
      thresholds.should_respond -= 1;
    }

    // Lower thresholds for questions
    if (playerAnalysis.isQuestion) {
      thresholds.may_respond -= 1;
    }

    // Adjust for conversation phase
    if (this.conversationMemory.conversationPhase === 'introduction') {
      thresholds.may_respond -= 2; // Be more responsive during introduction
    }

    return thresholds;
  }

  // Determine maximum companions based on context
  determineMaxCompanions(playerAnalysis) {
    // Complex or philosophical discussions may benefit from multiple perspectives
    if (playerAnalysis.complexity === 'complex' || 
        playerAnalysis.topics.includes('philosophy') ||
        playerAnalysis.intents.includes('philosophical')) {
      return 3;
    }
    
    // Emotional support may benefit from focused attention
    if (playerAnalysis.emotionalTone === 'negative' || 
        playerAnalysis.emotionalIntensity > 7) {
      return 1;
    }
    
    // Normal conversations
    return 2;
  }

  // Enhanced check for companion discussion
  shouldCompanionsDiscuss(playerAnalysis, respondingCompanions) {
    if (respondingCompanions.length < 2) return false;
    
    // Factors that encourage discussion
    const discussionFactors = {
      complexTopic: playerAnalysis.complexity === 'complex',
      philosophicalNature: playerAnalysis.topics.includes('philosophy'),
      multipleExpertise: playerAnalysis.expertiseNeeded.length > 1,
      emotionalComplexity: playerAnalysis.emotionalIntensity > 6 && playerAnalysis.topics.length > 1,
      conflictingPerspectives: this.detectConflictingPerspectives(respondingCompanions, playerAnalysis),
      userConfusion: playerAnalysis.emotionalTone === 'confused' || playerAnalysis.intents.includes('clarification'),
      deepDiscussion: this.conversationMemory.conversationPhase === 'deep_discussion'
    };

    // Count positive factors
    const factorCount = Object.values(discussionFactors).filter(Boolean).length;
    
    // Determine discussion probability based on factors
    let discussionProbability = SYSTEM_CONFIG.conversation.discussion_probability;
    discussionProbability += factorCount * 0.1; // Increase probability with more factors
    discussionProbability = Math.min(discussionProbability, 0.8); // Cap at 80%

    return Math.random() < discussionProbability;
  }

  // Detect if responding companions might have conflicting perspectives
  detectConflictingPerspectives(respondingCompanions, playerAnalysis) {
    // Check if the topic might generate different viewpoints
    const perspectiveTopics = ['philosophy', 'meaning', 'purpose', 'truth', 'reality'];
    const hasPhilosophicalTopic = playerAnalysis.topics.some(topic => 
      perspectiveTopics.includes(topic)
    );

    // Check if companions have different expertise areas
    const expertiseAreas = respondingCompanions.map(companion => 
      COMPANION_CONFIG[companion].expertise.primary[0]
    );
    const hasDistinctExpertise = new Set(expertiseAreas).size === expertiseAreas.length;

    return hasPhilosophicalTopic && hasDistinctExpertise;
  }

  // Get enhanced world state
  getCurrentWorldState() {
    return {
      currentLandmark: this.currentLandmark,
      landmarkDetails: WORLD_CONFIG.landmarks[this.currentLandmark],
      availableLandmarks: Object.keys(WORLD_CONFIG.landmarks),
      conversationMemory: this.conversationMemory,
      companionStates: this.companionStates,
      messageCount: this.messageCount,
      worldAtmosphere: this.getCurrentAtmosphere()
    };
  }

  // Get current atmosphere based on conversation
  getCurrentAtmosphere() {
    const tone = this.conversationMemory.emotionalTone;
    const phase = this.conversationMemory.conversationPhase;
    
    const atmospheres = {
      positive: 'warm and welcoming',
      negative: 'contemplative and supportive',
      anxious: 'calming and reassuring',
      confused: 'patient and clarifying',
      curious: 'engaging and exploratory',
      neutral: 'peaceful and open'
    };

    return atmospheres[tone] || atmospheres.neutral;
  }

  // Move to a different landmark
  moveToLandmark(landmarkKey) {
    if (WORLD_CONFIG.landmarks[landmarkKey]) {
      this.currentLandmark = landmarkKey;
      console.log(`📍 Moved to ${WORLD_CONFIG.landmarks[landmarkKey].name}`);
      
      // Update companion moods based on new location
      Object.keys(this.companionStates).forEach(companion => {
        const affinity = COMPANION_CONFIG[companion].landmarkAffinities[landmarkKey] || 0.5;
        if (affinity > 0.7) {
          this.companionStates[companion].mood = 'positive';
        } else if (affinity < 0.3) {
          this.companionStates[companion].mood = 'neutral';
        }
      });
      
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
      elara: { lastSpoke: 0, recentTopics: [], mood: 'neutral', engagement: 0 },
      bramble: { lastSpoke: 0, recentTopics: [], mood: 'neutral', engagement: 0 },
      kael: { lastSpoke: 0, recentTopics: [], mood: 'neutral', engagement: 0 }
    };
    
    this.conversationMemory = {
      recentMessages: [],
      currentThemes: [],
      emotionalTone: 'neutral',
      playerInterests: [],
      conversationPhase: 'introduction',
      previousIntents: [],
      userProfile: {
        communicationStyle: 'neutral',
        engagementLevel: 'medium',
        preferredCompanion: null
      }
    };
    
    openAIService.reset();
    console.log('🔄 Story engine reset');
  }
}

export default new StoryEngine();