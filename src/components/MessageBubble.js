// ===== src/components/MessageBubble.js - COMPLETE CRYSTAL BUBBLE VERSION =====
// ===== src/components/MessageBubble.js - FIXED VERSION =====
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { CHARACTERS, COMPANION_CONFIG } from '../constants/story';
import { MESSAGE_TYPES } from '../utils/messageTypes';

const { width: screenWidth } = Dimensions.get('window');

export default function MessageBubble({ 
  message = {}, // FIX: Default empty object
  storyContext = {}, // FIX: Default empty object
  onCrystalChoice,
  crystals = 0
}) {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showFullMessage, setShowFullMessage] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  
  // Animate message appearance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // FIX: Add null checks for message properties
  const isPlayer = message.sender === CHARACTERS.PLAYER;
  const isNarrator = message.sender === CHARACTERS.NARRATOR;
  const isSystem = message.sender === CHARACTERS.SYSTEM;
  const isCrystalRequest = message.type === MESSAGE_TYPES.CRYSTAL_REQUEST;

  const getCompanionInfo = () => {
    if (isPlayer || isNarrator || isSystem) return null;
    // FIX: Add null check and fallback
    if (!message.sender) return { name: 'Unknown', color: '#8B5CF6', avatar: '👤' };
    return COMPANION_CONFIG[message.sender] || { 
      name: message.sender, 
      color: '#8B5CF6',
      avatar: '👤'
    };
  };

  const companionInfo = getCompanionInfo();

  // 🔥 ENHANCED: Crystal request bubble with full functionality
  const renderCrystalRequestBubble = () => {
    const crystalData = message.crystalData || {};
    const hasChoiceMade = message.crystalChoice;
    const isProcessing = crystalData.isProcessing;
    
    return (
      <Animated.View 
        style={[
          styles.crystalRequestContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={[
          styles.crystalRequestBubble,
          crystalData.urgency === 'high' && styles.crystalRequestUrgent,
          hasChoiceMade && styles.crystalRequestCompleted
        ]}>
          {/* Crystal Icon Header with Animation */}
          <View style={styles.crystalRequestHeader}>
            <Animated.Text 
              style={[
                styles.crystalIcon,
                crystalData.isAutoDeducted && styles.crystalIconSuccess
              ]}
            >
              {crystalData.isAutoDeducted ? '✨' : '💎'}
            </Animated.Text>
            <View style={styles.crystalRequestTitleContainer}>
              <Text style={styles.crystalRequestTitle}>
                {crystalData.isAutoDeducted ? 'Crystal Magic Used' : 'Crystal Magic Required'}
              </Text>
              {crystalData.urgency === 'high' && (
                <Text style={styles.crystalUrgencyBadge}>🌟 Special Moment</Text>
              )}
            </View>
          </View>
          
          {/* Main Message with Better Typography */}
          <Text style={styles.crystalRequestText}>
            {crystalData.canAfford ? 
              "✨ A crystal has been used to sustain this magical experience" : 
              "✨ A crystal is needed to sustain this magical experience"
            }
          </Text>
          
          {/* Choice Made Display */}
          {hasChoiceMade && (
            <View style={[
              styles.crystalChoiceMade,
              message.crystalChoice === 'use_crystal' && styles.crystalChoiceSuccess,
              message.crystalChoice === 'not_now' && styles.crystalChoiceDeclined,
              message.crystalChoice === 'shop' && styles.crystalChoiceShop
            ]}>
              <Text style={styles.crystalChoiceText}>
                {getChoiceDisplayText(message.crystalChoice, crystalData)}
              </Text>
              <Text style={styles.crystalChoiceTime}>
                {new Date(message.crystalChoiceTime).toLocaleTimeString()}
              </Text>
            </View>
          )}
          
          {/* Action Buttons (only if no choice made and not processing) */}
          {!hasChoiceMade && !isProcessing && (
            <View style={styles.crystalActionsContainer}>
              {crystalData.isAutoDeducted ? (
                // Auto-deducted crystal - just show acknowledge
                <TouchableOpacity
                  style={styles.crystalAcknowledgeButton}
                  onPress={() => onCrystalChoice && onCrystalChoice(message.crystalRequestId, 'acknowledge')}
                  accessible={true}
                  accessibilityLabel="Acknowledge crystal use and continue"
                  accessibilityRole="button"
                >
                  <Text style={styles.crystalAcknowledgeButtonText}>✨ Continue Magic</Text>
                </TouchableOpacity>
              ) : crystalData.canAfford ? (
                // Can afford crystal - show use/decline options
                <>
                  <TouchableOpacity
                    style={styles.crystalUseButton}
                    onPress={() => onCrystalChoice && onCrystalChoice(message.crystalRequestId, 'use_crystal')}
                    accessible={true}
                    accessibilityLabel={`Use ${crystalData.cost || 1} crystal to continue conversation`}
                    accessibilityHint="This will deduct crystals from your collection"
                    accessibilityRole="button"
                  >
                    <Text style={styles.crystalUseButtonText}>✨ Use Crystal</Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Cannot afford crystal - show shop and decline options
                <>
                  <TouchableOpacity
                    style={styles.crystalShopButton}
                    onPress={() => onCrystalChoice && onCrystalChoice(message.crystalRequestId, 'shop')}
                    accessible={true}
                    accessibilityLabel="Go to Crystal Shop to get more crystals"
                    accessibilityRole="button"
                  >
                    <Text style={styles.crystalShopButtonText}>Get Crystals</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
          
          {/* Processing State */}
          {isProcessing && (
            <View style={styles.crystalProcessingContainer}>
              <Text style={styles.crystalProcessingText}>Processing crystal magic...</Text>
            </View>
          )}
          
        </View>
      </Animated.View>
    );
  };

  // 🔥 ENHANCED: Choice display text with more context
  const getChoiceDisplayText = (choice, crystalData) => {
    // FIX: Add null check for CHARACTER_INFO
    const CHARACTER_INFO = {}; // You may need to import this properly
    const companionName = CHARACTER_INFO[crystalData.requestingCompanion]?.name || 'companion';
    
    switch (choice) {
      case 'use_crystal':
        return `✨ Crystal used! ${companionName}'s magical guidance continues flowing.`;
      case 'not_now':
        return `⏸️ Conversation paused. ${companionName} will wait for your return.`;
      case 'shop':
        return `🛒 Redirected to Crystal Shop. ${companionName} awaits your return with more magical energy.`;
      case 'acknowledge':
        return `✅ Crystal magic flows freely through your conversation.`;
      case 'timeout':
        return `⏰ Crystal request timed out. ${companionName} understands and will be here when ready.`;
      default:
        return `✅ Choice recorded. ${companionName} appreciates your decision.`;
    }
  };

  // 🔥 ENHANCED: System message with better styling and context
  const renderSystemMessage = () => {
    // FIX: Add null check for message.content
    const content = message.content || '';
    const isSuccess = content.includes('✨') || content.includes('Crystal energy flows');
    const isError = content.includes('💔') || content.includes('Unable to');
    const isInfo = content.includes('ℹ️') || content.includes('Crystal Shop') || (!isSuccess && !isError);
    const isWarning = content.includes('⚠️') || content.includes('timeout');
    
    return (
      <Animated.View 
        style={[
          styles.systemMessageContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={[
          styles.systemMessageBubble,
          isSuccess && styles.systemMessageSuccess,
          isError && styles.systemMessageError,
          isWarning && styles.systemMessageWarning,
          isInfo && styles.systemMessageInfo
        ]}>
          <Text style={[
            styles.systemMessageText,
            isSuccess && styles.systemMessageTextSuccess,
            isError && styles.systemMessageTextError,
            isWarning && styles.systemMessageTextWarning,
            isInfo && styles.systemMessageTextInfo
          ]}>
            {content}
          </Text>
          
          {/* Timestamp for system messages */}
          <Text style={styles.systemMessageTimestamp}>
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
          </Text>
        </View>
      </Animated.View>
    );
  };

  // 🔥 ENHANCED: Narrator message with better presentation
  const renderNarratorMessage = () => {
    return (
      <Animated.View 
        style={[
          styles.narratorContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={styles.narratorBubble}>
          <Text style={styles.narratorIcon}>📖</Text>
          <Text style={styles.narratorText}>{message.content || ''}</Text>
        </View>
      </Animated.View>
    );
  };

  // 🔥 ENHANCED: Image message with better loading states
  const renderImageMessage = () => {
    return (
      <Animated.View 
        style={[
          styles.imageContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: message.content || '' }}
            style={styles.messageImage}
            onLoadStart={() => setIsImageLoading(true)}
            onLoadEnd={() => setIsImageLoading(false)}
            onError={() => {
              setIsImageLoading(false);
              setImageError(true);
            }}
          />
          
          {/* Enhanced loading overlay */}
          {isImageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <Animated.Text style={styles.imageLoadingText}>
                🎨 Conjuring magical scene...
              </Animated.Text>
            </View>
          )}
          
          {/* Enhanced error overlay */}
          {imageError && (
            <View style={styles.imageErrorOverlay}>
              <Text style={styles.imageErrorText}>🎨 Magical scene unavailable</Text>
              <TouchableOpacity 
                style={styles.imageRetryButton}
                onPress={() => {
                  setImageError(false);
                  setIsImageLoading(true);
                }}
              >
                <Text style={styles.imageRetryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Image context */}
        {storyContext?.environment && (
          <Text style={styles.imageContext}>
            🌟 {storyContext.environment.location}
          </Text>
        )}
      </Animated.View>
    );
  };

  // 🔥 ENHANCED: Companion message with multi-companion features
  const renderCompanionMessage = () => {
    const isReaction = message.responseType === 'reaction';
    const isPrimary = message.responseType === 'primary';
    
    return (
      <Animated.View 
        style={[
          styles.companionContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        {/* Enhanced Companion Header */}
        <View style={styles.companionHeader}>
          <View style={styles.companionNameContainer}>
            <Text style={styles.companionName}>{companionInfo?.name || 'Unknown'}</Text>
          </View>
          
          {/* Message timestamp */}
          <Text style={styles.companionTimestamp}>
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
          </Text>
        </View>
        
        {/* Enhanced Message Bubble */}
        <View style={[
          styles.companionBubble, 
          { backgroundColor: (companionInfo?.color || '#8B5CF6') + '20' },
          isPrimary && styles.companionBubblePrimary,
          isReaction && styles.companionBubbleReaction
        ]}>
          <Text style={styles.companionText}>{message.content || ''}</Text>
        </View>
      </Animated.View>
    );
  };

  // 🔥 ENHANCED: Player message with better styling
  const renderPlayerMessage = () => {
    const hasHighEngagement = (message.engagementLevel || 0) > 4;
    const hasQuestions = (message.content || '').includes('?');
    
    return (
      <Animated.View 
        style={[
          styles.playerContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={[
          styles.playerBubble,
          hasHighEngagement && styles.playerBubbleHighEngagement
        ]}>
          <Text style={styles.playerText}>{message.content || ''}</Text>
        </View>
      </Animated.View>
    );
  };

  // Main render logic with null checks
  if (!message) {
    return null; // FIX: Return null if no message
  }

  if (isCrystalRequest) {
    return renderCrystalRequestBubble();
  }

  if (isSystem) {
    return renderSystemMessage();
  }

  if (isNarrator) {
    return renderNarratorMessage();
  }

  if (message.type === MESSAGE_TYPES.IMAGE) {
    return renderImageMessage();
  }

  if (isPlayer) {
    return renderPlayerMessage();
  }

  return renderCompanionMessage();
}

// Keep all the existing styles exactly the same...
const styles = StyleSheet.create({
  // Crystal Request Bubble Styles
  crystalRequestContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  crystalRequestBubble: {
    backgroundColor: '#2D1B69',
    borderRadius: 20,
    padding: 20,
    maxWidth: screenWidth * 0.9,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  crystalRequestUrgent: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    backgroundColor: '#451A03',
  },
  crystalRequestCompleted: {
    opacity: 0.8,
    borderStyle: 'dashed',
  },
  crystalRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  crystalIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  crystalIconSuccess: {
    fontSize: 32,
  },
  crystalRequestTitleContainer: {
    flex: 1,
  },
  crystalRequestTitle: {
    color: '#E0E7FF',
    fontSize: 18,
    fontWeight: '700',
  },
  crystalUrgencyBadge: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  crystalRequestText: {
    color: '#C7D2FE',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  crystalRequestExpandText: {
    color: '#A5B4FC',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  crystalInfoContainer: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  crystalInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  crystalInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  crystalInfoLabel: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  crystalInfoValue: {
    color: '#E0E7FF',
    fontSize: 16,
    fontWeight: '700',
  },
  crystalAffordable: {
    color: '#10B981',
  },
  crystalUnaffordable: {
    color: '#F87171',
  },
  crystalCompanionInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(165, 180, 252, 0.2)',
  },
  crystalCompanionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#312E81',
    borderRadius: 12,
    padding: 8,
    marginTop: 6,
  },
  crystalCompanionAvatar: {
    fontSize: 16,
    marginRight: 8,
  },
  crystalCompanionName: {
    color: '#DDD6FE',
    fontSize: 14,
    fontWeight: '600',
  },
  crystalStoryImpact: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  crystalStoryImpactText: {
    color: '#C7D2FE',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  crystalChoiceMade: {
    backgroundColor: '#059669',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  crystalChoiceSuccess: {
    backgroundColor: '#059669',
  },
  crystalChoiceDeclined: {
    backgroundColor: '#7C2D12',
  },
  crystalChoiceShop: {
    backgroundColor: '#B45309',
  },
  crystalChoiceText: {
    color: '#ECFDF5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  crystalChoiceTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
  crystalActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  crystalUseButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  crystalUseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  crystalDeclineButton: {
    flex: 1,
    backgroundColor: '#4B5563',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  crystalDeclineButtonText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
  },
  crystalShopButton: {
    flex: 1,
    backgroundColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  crystalShopButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  crystalAcknowledgeButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  crystalAcknowledgeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  crystalProcessingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  crystalProcessingText: {
    color: '#A5B4FC',
    fontSize: 14,
    fontStyle: 'italic',
  },
  crystalEnvironmentContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(165, 180, 252, 0.2)',
  },
  crystalEnvironmentText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Enhanced System Message Styles
  systemMessageContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  systemMessageBubble: {
    borderRadius: 16,
    padding: 16,
    maxWidth: screenWidth * 0.85,
  },
  systemMessageInfo: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  systemMessageSuccess: {
    backgroundColor: '#065F46',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  systemMessageError: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#F87171',
  },
  systemMessageWarning: {
    backgroundColor: '#78350F',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  systemMessageText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  systemMessageTextInfo: {
    color: '#E5E7EB',
  },
  systemMessageTextSuccess: {
    color: '#D1FAE5',
  },
  systemMessageTextError: {
    color: '#FEE2E2',
  },
  systemMessageTextWarning: {
    color: '#FEF3C7',
  },
  systemMessageTimestamp: {
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.7,
    color: '#9CA3AF',
  },

  // Enhanced Narrator Styles
  narratorContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  narratorBubble: {
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 16,
    maxWidth: screenWidth * 0.85,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  narratorIcon: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  narratorText: {
    color: '#E5E7EB',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  narratorBeatContext: {
    color: '#A5B4FC',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },

  // Enhanced Image Styles
  imageContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  imageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  messageImage: {
    width: screenWidth * 0.8,
    height: 200,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    width: screenWidth * 0.8,
    height: 200,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingText: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '600',
  },
  imageErrorOverlay: {
    position: 'absolute',
    width: screenWidth * 0.8,
    height: 200,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorText: {
    color: '#F87171',
    fontSize: 14,
    marginBottom: 8,
  },
  imageRetryButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  imageRetryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  imageContext: {
    color: '#A5B4FC',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Enhanced Companion Styles
  companionContainer: {
    marginVertical: 8,
    alignItems: 'flex-start',
  },
  companionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 8,
    width: screenWidth * 0.85,
  },
  companionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  companionAvatarPrimary: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  companionAvatarReaction: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  companionAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  companionNameContainer: {
    flex: 1,
  },
  companionName: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
  },
  responseTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  responseTypeIndicator: {
    fontSize: 10,
    fontWeight: '600',
    marginRight: 6,
  },
  responseTypePrimary: {
    color: '#10B981',
  },
  responseTypeReaction: {
    color: '#F59E0B',
  },
  responseTypeSupport: {
    color: '#8B5CF6',
  },
  qualityBadge: {
    color: '#FCD34D',
    fontSize: 9,
    fontWeight: '600',
  },
  companionTimestamp: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  companionBubble: {
    borderRadius: 16,
    padding: 16,
    maxWidth: screenWidth * 0.8,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  companionBubblePrimary: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  companionBubbleReaction: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  companionText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },
  companionMessageMeta: {
    marginTop: 12,
  },
  beatContextIndicator: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    marginBottom: 6,
  },
  beatContextText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  informationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  informationTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  informationTagText: {
    color: '#DDD6FE',
    fontSize: 10,
    fontWeight: '600',
  },
  reactionTarget: {
    color: 'rgba(245, 158, 11, 0.8)',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Enhanced Player Styles
  playerContainer: {
    marginVertical: 8,
    alignItems: 'flex-end',
  },
  playerBubble: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    padding: 16,
    maxWidth: screenWidth * 0.8,
    marginRight: 8,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  playerBubbleHighEngagement: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  playerText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
  },
  playerMessageMeta: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  playerQuestionIndicator: {
    color: '#DDD6FE',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  playerBeatRelevance: {
    color: '#C7D2FE',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  playerTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
});