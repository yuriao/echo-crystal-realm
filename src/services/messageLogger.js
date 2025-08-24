// ===== src/services/messageLogger.js (UPDATED) =====
// Enhanced message logger with Firebase integration
import { collection, addDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

class MessageLogger {
  constructor() {
    this.userId = null;
    this.logQueue = [];
    this.isProcessingQueue = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Set user ID for logging context
  setUserId(userId) {
    this.userId = userId;
    console.log('📝 MessageLogger initialized for user:', userId);
  }

  // Sanitize data to remove undefined values and handle edge cases
  sanitizeLogData(data, path = '') {
    if (data === null) {
      return null;
    }

    if (data === undefined) {
      console.warn(`🚫 Undefined value found at path: ${path}`);
      return null;
    }

    if (Array.isArray(data)) {
      return data
        .map((item, index) => this.sanitizeLogData(item, `${path}[${index}]`))
        .filter(item => item !== null && item !== undefined);
    }

    if (typeof data === 'object') {
      const sanitized = {};
      
      Object.entries(data).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        const sanitizedValue = this.sanitizeLogData(value, currentPath);
        
        // Only include non-undefined values
        if (sanitizedValue !== undefined) {
          sanitized[key] = sanitizedValue;
        }
      });
      
      return sanitized;
    }

    // Handle primitive values
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    // Handle functions (should not be logged)
    if (typeof data === 'function') {
      console.warn(`🚫 Function found at path ${path}, converting to string`);
      return '[Function]';
    }

    // Handle other types
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      console.warn(`🚫 Unserializable data at path ${path}:`, error);
      return '[Unserializable]';
    }
  }

  // Validate required fields and add defaults
  validateAndEnhanceLogData(messageData) {
    const enhanced = {
      // Required fields with defaults
      timestamp: messageData.timestamp || new Date().toISOString(),
      userId: this.userId || 'anonymous',
      type: messageData.type || 'unknown',
      sender: messageData.sender || 'unknown',
      content: messageData.content || '',
      stage: messageData.stage ?? 0,
      
      // Optional fields with safe defaults
      journeyId: messageData.journeyId || null,
      beatContext: messageData.beatContext || null,
      qualityScore: messageData.qualityScore ?? 0,
      tokensUsed: messageData.tokensUsed ?? 0,
      totalTokens: messageData.totalTokens ?? 0,
      isReaction: messageData.isReaction ?? false,
      
      // Copy any additional fields
      ...messageData,
    };

    // Remove the original fields to avoid duplication
    delete enhanced.undefined;
    
    return enhanced;
  }

  // Main logging method with comprehensive error handling
  async logMessage(messageData, retryCount = 0) {
    try {
      if (!this.userId) {
        console.warn('📝 MessageLogger: No user ID set, using anonymous');
      }

      // Validate and enhance the data
      const enhancedData = this.validateAndEnhanceLogData(messageData);
      
      // Sanitize the data
      const sanitizedData = this.sanitizeLogData(enhancedData);

      // Additional validation
      if (!sanitizedData.content && !sanitizedData.type) {
        console.warn('📝 MessageLogger: Skipping log entry with no content or type');
        return false;
      }

      // Log to Firestore
      const docRef = await addDoc(collection(db, 'chatLogs'), sanitizedData);
      
      console.log('✅ Message logged successfully:', {
        docId: docRef.id,
        type: sanitizedData.type,
        sender: sanitizedData.sender,
        contentLength: sanitizedData.content?.length || 0,
        stage: sanitizedData.stage,
        beatContext: sanitizedData.beatContext,
      });

      return true;

    } catch (error) {
      console.error('❌ Error logging message to Firebase:', error);
      
      // Log detailed error information
      this.logErrorDetails(error, messageData, retryCount);
      
      // Retry logic
      if (retryCount < this.maxRetries) {
        console.log(`🔄 Retrying log operation (${retryCount + 1}/${this.maxRetries})`);
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.logMessage(messageData, retryCount + 1);
      }

      // If all retries failed, add to queue for later processing
      this.addToQueue(messageData);
      
      return false;
    }
  }

  // Log detailed error information for debugging
  logErrorDetails(error, messageData, retryCount) {
    console.log('🔍 Error Details:', {
      errorMessage: error.message,
      errorCode: error.code,
      retryCount: retryCount,
      dataKeys: Object.keys(messageData || {}),
      undefinedFields: Object.keys(messageData || {}).filter(key => messageData[key] === undefined),
      nullFields: Object.keys(messageData || {}).filter(key => messageData[key] === null),
      dataSnapshot: {
        type: messageData?.type,
        sender: messageData?.sender,
        hasContent: !!messageData?.content,
        contentType: typeof messageData?.content,
        stage: messageData?.stage,
        qualityScore: messageData?.qualityScore,
        journeyId: messageData?.journeyId,
      }
    });

    // Check for specific Firebase errors
    if (error.code === 'invalid-argument') {
      console.log('📊 Data validation failed. Raw data structure:');
      this.debugDataStructure(messageData);
    }
  }

  // Debug data structure to identify problematic fields
  debugDataStructure(data, indent = 0) {
    const spaces = '  '.repeat(indent);
    
    Object.entries(data || {}).forEach(([key, value]) => {
      const valueType = typeof value;
      const isUndefined = value === undefined;
      const isNull = value === null;
      const isFunction = typeof value === 'function';
      
      console.log(`${spaces}${key}: ${valueType}${isUndefined ? ' (UNDEFINED!)' : ''}${isNull ? ' (null)' : ''}${isFunction ? ' (FUNCTION!)' : ''}`);
      
      if (valueType === 'object' && !isNull && !Array.isArray(value)) {
        this.debugDataStructure(value, indent + 1);
      }
    });
  }

  // Add failed logs to queue for retry
  addToQueue(messageData) {
    this.logQueue.push({
      data: messageData,
      timestamp: Date.now(),
      attempts: 0,
    });
    
    console.log(`📥 Added message to retry queue. Queue size: ${this.logQueue.length}`);
    
    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  // Process queued log entries
  async processQueue() {
    if (this.isProcessingQueue || this.logQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`🔄 Processing log queue with ${this.logQueue.length} entries`);

    while (this.logQueue.length > 0) {
      const queueItem = this.logQueue.shift();
      queueItem.attempts++;

      try {
        const success = await this.logMessage(queueItem.data);
        if (success) {
          console.log('✅ Successfully processed queued log entry');
        } else if (queueItem.attempts < this.maxRetries) {
          // Re-add to queue if under retry limit
          this.logQueue.push(queueItem);
        } else {
          console.warn('❌ Discarding log entry after max retries');
        }
      } catch (error) {
        console.error('❌ Error processing queued log entry:', error);
        
        if (queueItem.attempts < this.maxRetries) {
          this.logQueue.push(queueItem);
        }
      }

      // Small delay between queue items
      await this.delay(100);
    }

    this.isProcessingQueue = false;
    console.log('✅ Queue processing completed');
  }

  // Utility method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Batch logging for multiple messages
  async logMessages(messagesArray) {
    console.log(`📝 Batch logging ${messagesArray.length} messages`);
    
    const results = await Promise.allSettled(
      messagesArray.map(messageData => this.logMessage(messageData))
    );

    const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
    const failed = results.length - successful;

    console.log(`📊 Batch logging results: ${successful} successful, ${failed} failed`);
    
    return { successful, failed, total: results.length };
  }

  // Retrieve user's message history
  async getMessageHistory(userId, limit = 50) {
    try {
      const q = query(
        collection(db, 'chatLogs'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limit)
      );

      const querySnapshot = await getDocs(q);
      const messages = [];

      querySnapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log(`📖 Retrieved ${messages.length} messages for user ${userId}`);
      return messages.reverse(); // Return in chronological order

    } catch (error) {
      console.error('❌ Error retrieving message history:', error);
      return [];
    }
  }

  // Get logging statistics
  getStats() {
    return {
      queueSize: this.logQueue.length,
      isProcessingQueue: this.isProcessingQueue,
      currentUserId: this.userId,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
    };
  }

  // Clear the retry queue
  clearQueue() {
    const queueSize = this.logQueue.length;
    this.logQueue = [];
    console.log(`🗑️ Cleared log queue of ${queueSize} entries`);
  }

  // Force process queue manually
  async forceProcessQueue() {
    console.log('🔧 Manually triggering queue processing');
    return this.processQueue();
  }
}

export default new MessageLogger();