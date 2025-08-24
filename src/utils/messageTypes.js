// ===== src/utils/messageTypes.js - FIXED WITH CUSTOM ID GENERATOR =====

// Simple ID generator that doesn't rely on crypto
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 9);
  return `msg_${timestamp}_${randomPart}`;
};

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  CRYSTAL_REQUEST: 'crystal_request',  // 🔥 NEW: Crystal cost request
  CRYSTAL_CHOICE: 'crystal_choice',    // 🔥 NEW: Player crystal choice
  SYSTEM: 'system',
  NARRATOR: 'narrator',
};

// Create message helper
export const createMessage = (type, sender, content, stage = 0, metadata = {}) => {
  const baseMessage = {
    id: generateId(), // Using custom ID generator instead of uuid
    type,
    sender,
    content,
    timestamp: new Date().toISOString(),
    stage,
    ...metadata
  };

  // Add type-specific properties
  switch (type) {
    case MESSAGE_TYPES.CRYSTAL_REQUEST:
      return {
        ...baseMessage,
        crystalData: metadata.crystalData || {},
        crystalRequestId: metadata.crystalRequestId || `crystal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      
    case MESSAGE_TYPES.CRYSTAL_CHOICE:
      return {
        ...baseMessage,
        crystalRequestId: metadata.crystalRequestId,
        choice: metadata.choice,
        crystalCost: metadata.crystalCost,
      };
      
    case MESSAGE_TYPES.TEXT:
      return {
        ...baseMessage,
        beatContext: metadata.beatContext || null,
        responseType: metadata.responseType || null,
        qualityScore: metadata.qualityScore || 0,
        informationProvided: metadata.informationProvided || [],
      };
      
    case MESSAGE_TYPES.IMAGE:
      return {
        ...baseMessage,
        imageMetadata: metadata.imageMetadata || {},
      };
      
    default:
      return baseMessage;
  }
};

// Crystal message helpers
export const createCrystalRequestMessage = (
  content, 
  stage, 
  crystalData = {},
  crystalRequestId = null
) => {
  return createMessage(
    MESSAGE_TYPES.CRYSTAL_REQUEST,
    'SYSTEM',
    content,
    stage,
    {
      crystalData,
      crystalRequestId: crystalRequestId || `crystal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  );
};

export const createCrystalChoiceMessage = (
  crystalRequestId,
  choice,
  crystalCost = 1
) => {
  return createMessage(
    MESSAGE_TYPES.CRYSTAL_CHOICE,
    'PLAYER',
    `Crystal choice: ${choice}`,
    0,
    {
      crystalRequestId,
      choice,
      crystalCost
    }
  );
};

// System message helpers  
export const createSystemMessage = (content, stage = 0, messageType = 'info') => {
  let formattedContent = content;
  
  // Add appropriate emoji based on message type
  if (messageType === 'success' && !content.includes('✨')) {
    formattedContent = `✨ ${content}`;
  } else if (messageType === 'error' && !content.includes('💔')) {
    formattedContent = `💔 ${content}`;
  } else if (messageType === 'info' && !content.includes('ℹ️')) {
    formattedContent = `ℹ️ ${content}`;
  }
  
  return createMessage(
    MESSAGE_TYPES.SYSTEM,
    'SYSTEM',
    formattedContent,
    stage,
    { messageType }
  );
};

// Enhanced text message helper
export const createEnhancedTextMessage = (
  sender,
  content,
  stage = 0,
  options = {}
) => {
  return createMessage(
    MESSAGE_TYPES.TEXT,
    sender,
    content,
    stage,
    {
      beatContext: options.beatContext || null,
      responseType: options.responseType || null,
      qualityScore: options.qualityScore || 0,
      informationProvided: options.informationProvided || [],
      tokensUsed: options.tokensUsed || 0,
      relevanceScore: options.relevanceScore || 0,
    }
  );
};

// Message validation helpers
export const isValidMessageType = (type) => {
  return Object.values(MESSAGE_TYPES).includes(type);
};

export const isCrystalMessage = (message) => {
  return message.type === MESSAGE_TYPES.CRYSTAL_REQUEST || 
         message.type === MESSAGE_TYPES.CRYSTAL_CHOICE;
};

export const isCompanionMessage = (message) => {
  const companionSenders = ['elara', 'bramble', 'kael'];
  return companionSenders.includes(message.sender?.toLowerCase());
};

export const isSystemMessage = (message) => {
  return message.sender === 'SYSTEM' || 
         message.type === MESSAGE_TYPES.SYSTEM ||
         message.type === MESSAGE_TYPES.NARRATOR;
};

// Message filtering helpers
export const filterMessagesByType = (messages, type) => {
  return messages.filter(message => message.type === type);
};

export const filterCrystalMessages = (messages) => {
  return messages.filter(message => isCrystalMessage(message));
};

export const filterCompanionMessages = (messages) => {
  return messages.filter(message => isCompanionMessage(message));
};

// Message analytics helpers
export const getMessageStats = (messages) => {
  const stats = {
    total: messages.length,
    byType: {},
    bySender: {},
    crystalRequests: 0,
    crystalChoices: 0,
    companionMessages: 0,
    playerMessages: 0,
  };
  
  messages.forEach(message => {
    // Count by type
    stats.byType[message.type] = (stats.byType[message.type] || 0) + 1;
    
    // Count by sender
    stats.bySender[message.sender] = (stats.bySender[message.sender] || 0) + 1;
    
    // Count special categories
    if (message.type === MESSAGE_TYPES.CRYSTAL_REQUEST) {
      stats.crystalRequests++;
    } else if (message.type === MESSAGE_TYPES.CRYSTAL_CHOICE) {
      stats.crystalChoices++;
    } else if (isCompanionMessage(message)) {
      stats.companionMessages++;
    } else if (message.sender === 'PLAYER') {
      stats.playerMessages++;
    }
  });
  
  return stats;
};

// Export all for convenience
export default {
  MESSAGE_TYPES,
  createMessage,
  createCrystalRequestMessage,
  createCrystalChoiceMessage,
  createSystemMessage,
  createEnhancedTextMessage,
  isValidMessageType,
  isCrystalMessage,
  isCompanionMessage,
  isSystemMessage,
  filterMessagesByType,
  filterCrystalMessages,
  filterCompanionMessages,
  getMessageStats,
};