// ===== src/services/openaiService.js - SIMPLIFIED SERVICE =====

import { 
  COMPANION_CONFIG, 
  RESPONSE_CONFIG, 
  WORLD_CONFIG,
  SYSTEM_CONFIG,
  getRelationshipDynamic 
} from '../constants/story';

const BACKEND_BASE_URL = 'https://echo-crystal-realm-backend-production.up.railway.app';

// Token counting utility
class TokenCounter {
  static countTokens(text) {
    if (!text) return 0;
    const charCount = text.length;
    const punctuationCount = (text.match(/[.,!?;:'"]/g) || []).length;
    const baseTokens = charCount / 4;
    const punctuationTokens = punctuationCount * 0.5;
    return Math.ceil(baseTokens + punctuationTokens);
  }
  
  static countMessageTokens(messages) {
    const messageOverhead = 4;
    let totalTokens = 0;
    messages.forEach(message => {
      totalTokens += messageOverhead;
      totalTokens += this.countTokens(message.content || '');
      if (message.name) {
        totalTokens += this.countTokens(message.name) + 1;
      }
    });
    totalTokens += 2;
    return totalTokens;
  }
}

// Rate limiter
class RateLimiter {
  constructor(minDelay = 1000, maxRetries = 3) {
    this.lastCall = 0;
    this.minDelay = minDelay;
    this.maxRetries = maxRetries;
  }

  async throttle() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    if (timeSinceLastCall < this.minDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minDelay - timeSinceLastCall)
      );
    }
    this.lastCall = Date.now();
  }

  async execute(fn, retries = 0) {
    try {
      await this.throttle();
      return await fn();
    } catch (error) {
      if (error.status === 429 && retries < this.maxRetries) {
        const waitTime = Math.pow(2, retries) * 1000;
        console.log(`Rate limited, waiting ${waitTime}ms before retry ${retries + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.execute(fn, retries + 1);
      }
      throw error;
    }
  }
}

class OpenAIService {
  constructor() {
    this.tokenCount = 0;
    this.conversationHistory = [];
    this.rateLimiter = new RateLimiter(800, 3);
    this.recentMemory = []; // Store recent conversation for context
  }

  // Make API request to backend
  async makeBackendRequest(endpoint, body) {
    console.log('Making backend request to:', endpoint);
    
    try {
      const response = await fetch(`${BACKEND_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let error;
        try {
          const errorData = JSON.parse(responseText);
          error = new Error(errorData.error?.message || `Backend API error: ${response.status}`);
        } catch (e) {
          error = new Error(`Backend API error: ${response.status} - ${responseText}`);
        }
        error.status = response.status;
        throw error;
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error('Backend API request failed:', error);
      throw error;
    }
  }

  // Update memory with recent messages
  updateMemory(message, sender = 'player') {
    this.recentMemory.push({ sender, content: message, timestamp: Date.now() });
    
    // Keep only recent messages based on config
    const memoryLimit = RESPONSE_CONFIG.memory.recent_messages;
    if (this.recentMemory.length > memoryLimit) {
      this.recentMemory = this.recentMemory.slice(-memoryLimit);
    }
  }

  // Get recent conversation context
  getRecentContext() {
    const contextWindow = RESPONSE_CONFIG.memory.context_window;
    return this.recentMemory.slice(-contextWindow);
  }

  // Build companion prompt based on configuration
  buildCompanionPrompt(companion, context) {
    const config = COMPANION_CONFIG[companion];
    if (!config) return '';

    let prompt = `You are ${config.name}, ${config.title}. ${config.personality.core}\n\n`;
    
    // Add personality traits
    prompt += `Your traits: ${config.personality.traits.join(', ')}.\n`;
    prompt += `Communication style: ${config.personality.communication}\n`;
    prompt += `Approach: ${config.personality.approach}\n\n`;
    
    // Add expertise
    prompt += `Primary expertise: ${config.expertise.primary.join(', ')}.\n`;
    prompt += `You have deep knowledge of: ${config.expertise.knowledge.join(', ')}.\n\n`;
    
    // Add current location context
    if (context.currentLandmark) {
      const landmark = WORLD_CONFIG.landmarks[context.currentLandmark];
      if (landmark) {
        prompt += `Current location: ${landmark.name}. ${landmark.description}\n`;
        prompt += `Available here: ${landmark.activities.join(', ')}.\n\n`;
      }
    }
    
    // Add recent conversation context
    const recentContext = this.getRecentContext();
    if (recentContext.length > 0) {
      prompt += `Recent conversation:\n`;
      recentContext.forEach(msg => {
        prompt += `${msg.sender}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    // Add response constraints
    prompt += `IMPORTANT INSTRUCTIONS:\n`;
    prompt += `- Respond in ${RESPONSE_CONFIG.ideal_words}-${RESPONSE_CONFIG.max_words} words maximum\n`;
    prompt += `- Blend your expertise with the mystical environment naturally\n`;
    prompt += `- Reference specific features of the current location when relevant\n`;
    prompt += `- Draw from both mystical and real-world knowledge\n`;
    prompt += `- Be concise but meaningful\n`;
    
    // Add context-specific instructions
    if (context.responseType === 'discussion') {
      const otherCompanion = context.discussionWith;
      const dynamic = getRelationshipDynamic(companion, otherCompanion);
      if (dynamic) {
        prompt += `- You're discussing with ${otherCompanion}. ${dynamic.interaction_style}\n`;
      }
    }
    
    if (context.responseType === 'reaction') {
      prompt += `- You're responding to ${context.reactingTo}'s point. Be supportive or offer a complementary perspective.\n`;
    }
    
    if (context.shouldSynthesize) {
      prompt += `- Synthesize the different perspectives shared into a unified understanding.\n`;
    }
    
    return prompt;
  }

  // Generate companion response
  async generateCompanionResponse(companion, message, context = {}) {
    const systemPrompt = this.buildCompanionPrompt(companion, context);
    
    console.log(`🎭 Generating response for ${companion} (${context.responseType || 'primary'})`);
    
    return this.rateLimiter.execute(async () => {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ];
        
        const estimatedTokens = TokenCounter.countMessageTokens(messages);
        console.log('📊 Estimated tokens:', estimatedTokens);
        
        const response = await this.makeBackendRequest('/api/chat/completions', {
          model: 'gpt-4o-mini',
          messages: messages,
          max_completion_tokens: 80, // Allow slightly more for better responses
          temperature: 0.8, // Add some creativity
        });

        let responseText = response.choices[0]?.message?.content || '';
        
        // Enforce word limit
        const words = responseText.trim().split(/\s+/);
        if (words.length > RESPONSE_CONFIG.max_words) {
          responseText = words.slice(0, RESPONSE_CONFIG.max_words).join(' ');
        }
        
        // Update memory with companion's response
        this.updateMemory(responseText, companion);
        
        const tokensUsed = response.usage?.total_tokens || estimatedTokens + this.countTokens(responseText);
        this.tokenCount += tokensUsed;
        
        return {
          sender: companion,
          text: responseText,
          tokensUsed: tokensUsed,
          totalTokens: this.tokenCount,
        };
        
      } catch (error) {
        console.error('Error generating companion response:', error);
        
        // Fallback response
        const fallbackText = this.getFallbackResponse(companion, context);
        return {
          sender: companion,
          text: fallbackText,
          tokensUsed: 30,
          totalTokens: this.tokenCount + 30,
        };
      }
    });
  }

  // Generate discussion between companions
  async generateCompanionDiscussion(companion1, companion2, topic, context = {}) {
    const dynamic = getRelationshipDynamic(companion1, companion2);
    
    let discussionPrompt = `You are having a discussion with ${companion2} about: ${topic}.\n`;
    if (dynamic) {
      discussionPrompt += `Your interaction style: ${dynamic.interaction_style}\n`;
      discussionPrompt += `Common ground: ${dynamic.common_ground.join(', ')}\n`;
    }
    discussionPrompt += `Offer your perspective based on your expertise, in ${RESPONSE_CONFIG.response_types.supportive.max_words} words.`;
    
    return this.generateCompanionResponse(
      companion1, 
      discussionPrompt,
      {
        ...context,
        responseType: 'discussion',
        discussionWith: companion2
      }
    );
  }

  // Get fallback response
  getFallbackResponse(companion, context) {
    const config = COMPANION_CONFIG[companion];
    const landmark = context.currentLandmark ? WORLD_CONFIG.landmarks[context.currentLandmark] : null;
    
    const fallbacks = {
      elara: `The spiritual energies here ${landmark ? `in ${landmark.name}` : ''} invite deep exploration.`,
      bramble: `This touches on something important. ${landmark ? `Perhaps ${landmark.features[0]} can help us explore this.` : 'Let\'s explore this together.'}`,
      kael: `An intriguing question that invites philosophical reflection ${landmark ? `here in ${landmark.name}` : ''}.`
    };
    
    return fallbacks[companion] || "Let's explore this together.";
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
    this.recentMemory = [];
  }

  // Reset service
  reset() {
    this.tokenCount = 0;
    this.conversationHistory = [];
    this.recentMemory = [];
  }

  // Count tokens
  countTokens(text) {
    return TokenCounter.countTokens(text);
  }

  getTotalTokens() {
    return this.tokenCount;
  }

  getConversationHistory() {
    return this.conversationHistory;
  }
}

export default new OpenAIService();