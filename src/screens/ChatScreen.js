import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '../context/UserContext';
import MessageBubble from '../components/MessageBubble';
import CompanionHeader from '../components/CompanionHeader';
import CrystalRequestModal from '../components/CrystalRequestModal';
import { CHARACTERS,CHARACTER_INFO } from '../constants/story';
import { createMessage, MESSAGE_TYPES } from '../utils/messageTypes';
import storyEngine from '../services/storyEngine';
import crystalTokenManager from '../services/CrystalTokenManage';
import messageLogger from '../services/messageLogger';
import journeyService from '../services/journeyService';
import imageCacheService from '../services/imageCacheService';
import openAIService from '../services/openaiService';
import { 
  WORLD_CONFIG, 
  RESPONSE_CONFIG,
} from '../constants/story';

export default function ChatScreen({ navigation, route }) {
  const { user, crystals } = useUser();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentStage, setCurrentStage] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showCrystalRequest, setShowCrystalRequest] = useState(false);
  const [crystalRequestData, setCrystalRequestData] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [tokenProgress, setTokenProgress] = useState(0);
  const [journeyId, setJourneyId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storyContext, setStoryContext] = useState(null);
  
  const currentBeat={id:'location_introduction'}

  // Multi-companion response state
  const [activeCompanions, setActiveCompanions] = useState([]);
  const [currentlyTypingCompanion, setCurrentlyTypingCompanion] = useState(null);
  const [isProcessingResponses, setIsProcessingResponses] = useState(false);
  
  
  const flatListRef = useRef(null);
  const saveCounter = useRef(0);

  // Initialize processes upon start
  useEffect(() => {
    const { resumeJourney } = route.params || {};
    
    // Initialize message logger with user ID
    messageLogger.setUserId(user.uid);
    
    if (resumeJourney) {
      resumeExistingJourney();
    } else {
      initializeNewChat();
    }
    
    // Clean old image cache periodically
    imageCacheService.clearOldCache();
    
    return () => {
      // Save state when component unmounts
      if (messages.length > 0) {
        saveJourneyState();
      }
    };
  }, []);

  // Auto-save journey progress
  useEffect(() => {
    if (messages.length > 0) {
      saveCounter.current++;
      
      // Save every 5 messages or when important events happen
      if (saveCounter.current >= 5) {
        saveJourneyState();
        saveCounter.current = 0;
      }
    }
  }, [messages]);

  const initializeNewChat = async () => {
    setIsLoading(true);
    
    try {
      // Generate new journey ID
      const newJourneyId = `journey_${Date.now()}`;
      setJourneyId(newJourneyId);
      
      // Initialize crystal token manager
      await crystalTokenManager.initializeUser(user.uid);
      
      // Reset story engine for new session
      storyEngine.reset();
      
      // Initialize story-progressive context
      const initialContext = await storyEngine.initializeWorldContext();
      setStoryContext(initialContext);
      
      console.log('🎭 Multi-Companion Story Context Initialized:', {
        environment: initialContext.environment?.location,
        storyContext: initialContext.storyContext?.setting,
        beats: initialContext.storyBeats?.length || 0,
      });
      
      // Load initial scene with all companions
      await loadInitialSceneMultiCompanion(initialContext);
      
      // Update token progress
      updateTokenProgress();
      
      // Initial save
      await saveJourneyState();
    } catch (error) {
      console.error('Error initializing multi-companion chat:', error);
      Alert.alert('Error', 'Failed to initialize chat. Please try again.');
    }
    
    setIsLoading(false);
  };

  const resumeExistingJourney = async () => {
    setIsLoading(true);
    
    try {
      // Load journey state
      const journeyState = await journeyService.loadJourneyState(user.uid);
      
      if (journeyState) {
        // Set journey ID
        setJourneyId(journeyState.journeyId);
        
        // Restore story engine state
        storyEngine.currentStage = journeyState.storyStage;
        storyEngine.storyState = journeyState.storyState;
        
        // Initialize story context for current stage
        const restoredContext = await storyEngine.initializeWorldContext();
        setStoryContext(restoredContext);
        
        // Initialize crystal token manager with saved state
        await crystalTokenManager.initializeUser(user.uid);
        
        // Load previous messages
        const previousMessages = await journeyService.loadJourneyMessages(
          user.uid,
          journeyState.journeyId
        );
        
        // Process images through cache
        const cachedMessages = await Promise.all(
          previousMessages.map(async (msg) => {
            if (msg.type === MESSAGE_TYPES.IMAGE) {
              const cachedUri = await imageCacheService.getImage(msg.content, {
                userId: user.uid,
                storyStage: msg.stage,
                journeyId: journeyState.journeyId,
              });
              return { ...msg, content: cachedUri };
            }
            return msg;
          })
        );
        
        setMessages(cachedMessages);
        setCurrentStage(journeyState.storyStage);
        
        // Update token progress
        updateTokenProgress();
        
        // Add a system message about resuming with story context
        const resumeMessage = createMessage(
          MESSAGE_TYPES.TEXT,
          CHARACTERS.SYSTEM,
          `Welcome back to ${restoredContext.environment?.location || 'the Crystal Realm'}! Your companions are ready to continue.`,
          journeyState.storyStage
        );
        
        setMessages(prev => [...prev, resumeMessage]);
        
        // Log the resume event
        messageLogger.logMessage({
          ...resumeMessage,
          journeyId: journeyState.journeyId,
        });
      } else {
        // No saved journey found, start new
        Alert.alert('Info', 'No saved journey found. Starting a new adventure!');
        initializeNewChat();
      }
    } catch (error) {
      console.error('Error resuming journey:', error);
      Alert.alert('Error', 'Failed to resume journey. Starting fresh.');
      initializeNewChat();
    }
    
    setIsLoading(false);
  };

  // Load initial scene with all three companions
  const loadInitialSceneMultiCompanion = async (context) => {
    setIsTyping(true);
    setIsProcessingResponses(true);
    
    try {
      // Use environment description from story context
      const environment = context?.environment || {
        location: "The Crystal Realm",
        description: "A mystical realm filled with glowing crystals and magical energy.",
        atmosphere: "mystical and welcoming",
        keyFeatures: [
          "Glowing crystal formations",
          "Shimmering magical energy",
          "Ancient mystical portals"
        ]
      };

      // Enhanced opening narration
      const openingNarration = [
        `You find yourself standing within ${environment.location}. ${environment.description}`,
      ];

      // Add narrator messages with delays
      for (let i = 0; i < openingNarration.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const narratorMessage = createMessage(
          MESSAGE_TYPES.TEXT,
          CHARACTERS.NARRATOR,
          openingNarration[i],
          storyEngine.currentStage
        );
        
        setMessages(prev => [...prev, narratorMessage]);
        messageLogger.logMessage({ ...narratorMessage, journeyId });
      }

      // Pause before companion introductions
      await new Promise(resolve => setTimeout(resolve, 1500));

      // All three companions introduce themselves in order
      const keyFeatures = environment.keyFeatures || ["magical surroundings", "crystal formations", "ancient structures"];
      
      // Set all companions as active
      setActiveCompanions(['elara', 'bramble', 'kael']);
      
    } catch (error) {
      console.error('Error loading multi-companion initial scene:', error);
      await loadBasicInitialScene();
    }
    
    setIsTyping(false);
    setCurrentlyTypingCompanion(null);
    setIsProcessingResponses(false);
  };

  const loadBasicInitialScene = async () => {
    // Fallback basic scene loader
    const openingNarration = [
      "You find yourself standing at the threshold of an ancient realm.",
      "Three companions approach you with warm smiles..."
    ];

    const narratorMessages = openingNarration.map((text, index) => 
      createMessage(
        MESSAGE_TYPES.TEXT,
        CHARACTERS.NARRATOR,
        text,
        storyEngine.currentStage
      )
    );

    for (let i = 0; i < narratorMessages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setMessages(prev => [...prev, narratorMessages[i]]);
      messageLogger.logMessage({ ...narratorMessages[i], journeyId });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const introMessages = [
      { sender: CHARACTERS.ELARA, content: "Greetings, traveler. I am Elara, Sage of the Ethereal Winds." },
      { sender: CHARACTERS.BRAMBLE, content: "Hey there! Name's Bramble, Guardian of the Living Wood!" },
      { sender: CHARACTERS.KAEL, content: "Welcome. I am Kael, Keeper of Ancient Runes." }
    ];

    for (const msg of introMessages) {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const companionMessage = createMessage(
        MESSAGE_TYPES.TEXT, 
        msg.sender, 
        msg.content, 
        storyEngine.currentStage
      );
      
      setMessages(prev => [...prev, companionMessage]);
      messageLogger.logMessage({ ...companionMessage, journeyId });
    }
    
    setActiveCompanions(['elara', 'bramble', 'kael']);
  };

  // Multi-companion message processing
  const sendMessage = async () => {
    if (!inputText.trim() || isLocked || isProcessingResponses) {
      console.log('BLOCKED');
      return;
    }

    const playerMessage = createMessage(
      MESSAGE_TYPES.TEXT,
      CHARACTERS.PLAYER,
      inputText.trim(),
      storyEngine.currentStage
    );

    setMessages(prev => [...prev, playerMessage]);
    setInputText('');
    setIsTyping(true);
    setIsProcessingResponses(true);

    // Log player message
    messageLogger.logMessage({ ...playerMessage, journeyId });

    try {
      // Process with multi-companion system
      const allResponses = await processPlayerMessage(inputText.trim());

      // Update current stage
      setCurrentStage(storyEngine.currentStage);

      // Force save after important interactions
      if (storyEngine.currentStage !== currentStage || 
          allResponses.some(r => r.beatContext)) {
        await saveJourneyState();
      }

    } catch (error) {
      console.error('Error processing multi-companion message:', error);
      Alert.alert('Error', 'Failed to process your message. Please try again.');
    }

    setIsTyping(false);
    setCurrentlyTypingCompanion(null);
    setIsProcessingResponses(false);
  };

  // Process player message
  const processPlayerMessage= async (playerMessage) =>{
    // update message count
    storyEngine.messageCount++;
    // Update memory
    openAIService.updateMemory(playerMessage, 'player');
    storyEngine.conversationMemory.recentMessages.push({
      sender: 'player',
      content: playerMessage,
      timestamp: Date.now()
    });

    // Keep memory size limited
    if (storyEngine.conversationMemory.recentMessages.length > RESPONSE_CONFIG.memory.recent_messages) {
      storyEngine.conversationMemory.recentMessages.shift();
    }

    // Log player message
    messageLogger.logMessage({
      type: MESSAGE_TYPES.TEXT,
      sender: 'player',
      content: playerMessage,
      landmark: storyEngine.currentLandmark,
      timestamp: new Date().toISOString(),
    });

    // Analyze message
    const playerAnalysis = storyEngine.analyzePlayerMessage(playerMessage);
    console.log('🔍 Player Analysis:', playerAnalysis);

    // Update conversation memory
    storyEngine.conversationMemory.currentThemes = playerAnalysis.topics;
    storyEngine.conversationMemory.emotionalTone = playerAnalysis.emotionalTone;
    storyEngine.conversationMemory.playerInterests = [...new Set([
      ...storyEngine.conversationMemory.playerInterests,
      ...playerAnalysis.expertiseNeeded
    ])];

    // Check for landmark changes
    if (playerAnalysis.mentionedLandmarks.length > 0) {
      const newLandmark = playerAnalysis.mentionedLandmarks[0];
      if (newLandmark !== storyEngine.currentLandmark) {
        console.log(`📍 Moving to ${WORLD_CONFIG.landmarks[newLandmark].name}`);
        storyEngine.currentLandmark = newLandmark;
      }
    }

    // Determine responding companions
    const respondingCompanions = storyEngine.determineRespondingCompanions(playerAnalysis);
    console.log('👥 Responding companions:', respondingCompanions);

    const responses = [];

    // Generate primary responses
    for (const companion of respondingCompanions) {
      try {
        const context = {
          currentLandmark: storyEngine.currentLandmark,
          emotionalTone: playerAnalysis.emotionalTone,
          topics: playerAnalysis.topics,
          responseType: 'primary'
        };

        const response = await openAIService.generateCompanionResponse(
          companion,
          playerMessage,
          context
        );

        // Update companion state
        storyEngine.companionStates[companion].lastSpoke = storyEngine.messageCount;
        storyEngine.companionStates[companion].recentTopics = playerAnalysis.topics;

        // Show typing indicator for current companion
        setCurrentlyTypingCompanion(response.sender);
        
        // Create and add companion message
        const companionMessage = createMessage(
          MESSAGE_TYPES.TEXT,
          response.sender,
          response.text,
          'stage'
        );
        
        setMessages(prev => [...prev, companionMessage]);
        // Log companion message
        messageLogger.logMessage({
          type: MESSAGE_TYPES.TEXT,
          sender: companion,
          content: response.text,
          landmark: storyEngine.currentLandmark,
          timestamp: new Date().toISOString(),
        });

        responses.push({
          type: 'companion',
          sender: companion,
          text: response.text,
          tokensUsed: response.tokensUsed,
          totalTokens: response.totalTokens
        });

      } catch (error) {
        console.error(`Error generating response for ${companion}:`, error);
      }
    }

    // Check if companions should discuss
    if (storyEngine.shouldCompanionsDiscuss(playerAnalysis, respondingCompanions) && respondingCompanions.length >= 2) {
      console.log('💬 Companions are discussing...');
      
      const [companion1, companion2] = respondingCompanions;
      const discussionTopic = playerAnalysis.topics[0] || playerMessage;
      
      try {
        // Companion 1 responds to Companion 2's perspective
        const discussion1 = await openAIService.generateCompanionDiscussion(
          companion1,
          companion2,
          discussionTopic,
          { currentLandmark: this.currentLandmark }
        );

        // Show typing indicator for current companion
        setCurrentlyTypingCompanion(companion1);
        
        // Create and add companion message
        const companionMessage = createMessage(
          MESSAGE_TYPES.TEXT,
          companion1,
          discussion1.text,
          'stage'
        );
        
        setMessages(prev => [...prev, companionMessage]);

        responses.push({
          type: 'discussion',
          sender: companion1,
          text: discussion1.text,
          discussingWith: companion2,
          tokensUsed: discussion1.tokensUsed
        });

        // Companion 2 might respond back
        if (Math.random() < 0.4) {
          const discussion2 = await openAIService.generateCompanionDiscussion(
            companion2,
            companion1,
            discussionTopic,
            { currentLandmark: this.currentLandmark }
          );
          
          // Show typing indicator for current companion
        setCurrentlyTypingCompanion(companion2);
        
        // Create and add companion message
        const companionMessage = createMessage(
          MESSAGE_TYPES.TEXT,
          companion2,
          discussion2.text,
          'stage'
        );
        
        setMessages(prev => [...prev, companionMessage]);

          responses.push({
            type: 'discussion',
            sender: companion2,
            text: discussion2.text,
            discussingWith: companion1,
            tokensUsed: discussion2.tokensUsed
          });
        }

        // Possible synthesis from third companion
        // if (respondingCompanions.length === 3 && Math.random() < 0.2) {
        //   const companion3 = respondingCompanions[2];
        //   const synthesis = await openAIService.generateCompanionResponse(
        //     companion3,
        //     `Synthesize the perspectives on: ${discussionTopic}`,
        //     {
        //       currentLandmark: this.currentLandmark,
        //       responseType: 'synthesis',
        //       shouldSynthesize: true
        //     }
        //   );

        //   responses.push({
        //     type: 'synthesis',
        //     sender: companion3,
        //     text: synthesis.text,
        //     tokensUsed: synthesis.tokensUsed
        //   });
        // }
      } catch (error) {
        console.error('Error generating discussion:', error);
      }
    }

    return responses;
  }

  // 🔥 NEW: Handle crystal choice from message bubble
  const handleCrystalChoice = async (crystalRequestId, choice) => {
    console.log('💎 Crystal choice made:', choice, 'for request:', crystalRequestId);
    
    // Find the crystal request message
    // const requestMessage = messages.find(msg => msg.crystalRequestId === crystalRequestId);
    // if (!requestMessage) {
    //   console.error('Crystal request message not found');
    //   return;
    // }
    
    // Update the message to show the choice was made
    setMessages(prev => 
      prev.map(msg => 
        msg.crystalRequestId === crystalRequestId 
          ? { ...msg, crystalChoice: choice, crystalChoiceTime: Date.now() }
          : msg
      )
    );
    
    if (choice === 'use_crystal') {
      try {
        // Deduct crystal and continue
        const result = await crystalTokenManager.forceCrystalUse();
        
        if (result.success) {
          // Add success message
          const successMessage = createMessage(
            MESSAGE_TYPES.SYSTEM,
            CHARACTERS.SYSTEM,
            `✨ Crystal energy flows!`,
            storyEngine.currentStage
          );
          
          setMessages(prev => [...prev, successMessage]);
          updateTokenProgress();
          setIsLocked(false);
          
        } else {
          // Show error if crystal use failed
          const errorMessage = createMessage(
            MESSAGE_TYPES.SYSTEM,
            CHARACTERS.SYSTEM,
            `💔 Unable to use crystal. Please visit the Crystal Shop to gather more magical energy.`,
            storyEngine.currentStage
          );
          
          setMessages(prev => [...prev, errorMessage]);
        }
        
      } catch (error) {
        console.error('Error using crystal:', error);
        
        const errorMessage = createMessage(
          MESSAGE_TYPES.SYSTEM,
          CHARACTERS.SYSTEM,
          `💔 Something went wrong with the crystal magic. Please try again.`,
          storyEngine.currentStage
        );
        
        setMessages(prev => [...prev, errorMessage]);
      }
      
    } else if (choice === 'shop') {
      // Navigate to crystal shop
      setIsLocked(false);
      navigation.navigate('CrystalShop');
      
    } else if (choice === 'not_now') {
      // Player chose not to use crystal
      const declineMessage = createMessage(
        MESSAGE_TYPES.SYSTEM,
        CHARACTERS.SYSTEM,
        `The magical energies understand your choice. Your companions will wait patiently for when you're ready to continue with crystal magic.`,
        storyEngine.currentStage
      );
      
      setMessages(prev => [...prev, declineMessage]);
      setIsLocked(false);
      
    } else if (choice === 'acknowledge') {
      // Just acknowledge the info message (for auto-deducted crystals)
      setIsLocked(false);
    }
    
    // Log the choice
    messageLogger.logMessage({
      type: MESSAGE_TYPES.CRYSTAL_CHOICE,
      crystalRequestId: crystalRequestId,
      choice: choice,
      timestamp: new Date().toISOString(),
      journeyId: journeyId || 'unknown',
    });
  };

  const handleCrystalPurchase = () => {
    setShowCrystalRequest(false);
    setIsLocked(false);
    navigation.navigate('CrystalShop');
  };

  const exportStory = async () => {
    const summary = storyEngine.getStorySummary();
    Alert.alert(
      'Beautiful Memories', 
      `Location: ${summary.environment?.location}
      Story Moments: ${summary.conversationHighlights.storyMoments}
      Total Conversations: ${summary.conversationHighlights.totalMessages}
      Engagement Score: ${summary.conversationHighlights.engagementScore}

      Full memory export coming soon!`
    );
  };

  const updateTokenProgress = () => {
    const progress = crystalTokenManager.getProgress();
    setTokenProgress(progress.progressPercentage);
  };

  const saveJourneyState = async () => {
    if (!journeyId) return;
    
    try {
      const journeyData = {
        journeyId,
        storyStage: storyEngine.currentStage,
        storyState: storyEngine.storyState,
        tokenCount: openAIService.getTotalTokens(),
        conversationHistory: openAIService.getConversationHistory(),
        storyContext: storyContext,
        // Story-progressive additions
        beatProgress: '',
        currentBeat: '',
        companionCoordination: storyEngine.companionCoordinator,
        playerProfile: storyEngine.playerProfile,
        // Multi-companion additions
        activeCompanions: activeCompanions,
      };
      
      await journeyService.saveJourneyState(user.uid, journeyData);
      console.log('💾 Multi-companion journey state saved');
    } catch (error) {
      console.error('Error saving journey state:', error);
    }
  };

  const renderMessage = ({ item }) => (
    <MessageBubble 
      message={item} 
      storyContext={storyContext}
      currentBeat={currentBeat}
      beatProgress={''}
      activeCompanions={activeCompanions}
      isMultiCompanionMode={true}
      onCrystalChoice={handleCrystalChoice}
    />
  );

  // Get dynamic placeholder for multi-companion mode
  const getInputPlaceholder = () => {
    if (isLocked) return "Waiting for your crystal choice...";
    if (isProcessingResponses) return "Companions are discussing...";
    
    if (currentBeat) {
      const beatPlaceholders = {
        'arrival_wonder': "Share your feeling...",
        'location_introduction': "Say hello and meet your companions...",
        'companion_introductions': "Talk with Elara, Bramble, and Kael...",
        'first_interaction': "Share your feelings with your companions...",
        'mystery_hint': "Share your feelings with your companions...",
        
        'council_arrival': "Express your amazement to your companions...",
        'nature_interaction': "Share your feelings with your companions...",
        'hidden_discovery': "Share your feelings with your companions...",
        'path_selection': "Discuss the paths with your companions...",
        'heart_arrival': "Share your feelings with your companions...",
        'memory_sharing': "Share your feelings with your companions...",
      };
      
      return beatPlaceholders[currentBeat.id] || "Share your thoughts with your companions...";
    }
    
    return "What would you like to ask your companions?";
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>
            {route.params?.resumeJourney ? 'Resuming your adventure...' : 'Preparing your adventure...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CompanionHeader 
        onBack={() => {
          saveJourneyState();
          navigation.navigate('Home');
        }}
        crystals={crystals}
        stage={currentStage}
        tokenProgress={tokenProgress}
        storyContext={storyContext}
        activeCompanions={activeCompanions}
        isMultiCompanionMode={true}
      />
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={false}
      />

      {/* Enhanced Multi-companion typing indicator */}
      {(isTyping || isProcessingResponses) && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#8B5CF6" />
          <Text style={styles.typingText}>
            {currentlyTypingCompanion ? 
              `${CHARACTER_INFO[currentlyTypingCompanion]?.name || 'Companion'} is responding...` : 
              isProcessingResponses ? 'Companions are discussing...' : 'Thinking...'
            }
          </Text>
          {isProcessingResponses && (
            <Text style={styles.processingText}>
              Multiple responses incoming
            </Text>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.textInput, (isLocked || isProcessingResponses) && styles.textInputLocked]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={getInputPlaceholder()}
            placeholderTextColor="#666"
            multiline
            maxLength={200}
            editable={!isLocked && !isProcessingResponses}
            autoFocus={!isLocked && !isProcessingResponses}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLocked || isProcessingResponses) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLocked || isProcessingResponses}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CrystalRequestModal
        visible={showCrystalRequest}
        crystalRequest={crystalRequestData}
        onPurchase={handleCrystalPurchase}
        onClose={() => {
          setShowCrystalRequest(false);
          setIsLocked(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    color: '#A78BFA',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 10,
    color: '#8B5CF6',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loadingBeat: {
    marginTop: 8,
    color: '#F59E0B',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingCompanions: {
    marginTop: 12,
    color: '#10B981',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  progressContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#0f0f23',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageNameText: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  companionCountText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  beatProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  beatProgressText: {
    color: '#E5E7EB',
    fontSize: 12,
    flex: 1,
  },
  beatCount: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  beatProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  beatProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  progressPercentage: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 35,
  },
  infoFocusText: {
    color: '#8B5CF6',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  activeCompanionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  activeCompanionsLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    marginRight: 4,
  },
  activeCompanionChip: {
    backgroundColor: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 2,
  },
  activeCompanionText: {
    color: '#D1D5DB',
    fontSize: 9,
    fontWeight: '500',
  },
  messagesList: {
    padding: 15,
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#0f0f23',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  textInputLocked: {
    backgroundColor: '#1a1a2e',
    opacity: 0.7,
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#4C1D95',
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  typingIndicator: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  typingText: {
    marginLeft: 10,
    color: '#A78BFA',
    fontSize: 14,
    flex: 1,
  },
  processingText: {
    marginLeft: 10,
    marginTop: 2,
    color: '#10B981',
    fontSize: 12,
    fontStyle: 'italic',
  },
});