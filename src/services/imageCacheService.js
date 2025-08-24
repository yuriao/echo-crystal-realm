// ===== src/services/imageCacheService.js - COMPLETE VERSION =====
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata } from 'firebase/storage';

class ImageCacheService {
  constructor() {
    this.cacheDir = `${FileSystem.documentDirectory}imageCache/`;
    this.cacheIndexKey = 'IMAGE_CACHE_INDEX';
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB local cache limit
    this.maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.initializeCache();
  }

  async initializeCache() {
    try {
      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
        console.log('Image cache directory created');
      }
      
      // Initialize cache index
      const index = await this.getCacheIndex();
      if (!index) {
        await this.saveCacheIndex({});
      }
    } catch (error) {
      console.error('Error initializing image cache:', error);
    }
  }

  // Generate cache key from URL
  getCacheKey(url) {
    // Create a unique key from URL
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1].split('?')[0];
    const timestamp = Date.now();
    return `img_${timestamp}_${filename}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  // Get cache index from AsyncStorage
  async getCacheIndex() {
    try {
      const indexJson = await AsyncStorage.getItem(this.cacheIndexKey);
      return indexJson ? JSON.parse(indexJson) : {};
    } catch (error) {
      console.error('Error getting cache index:', error);
      return {};
    }
  }

  // Save cache index to AsyncStorage
  async saveCacheIndex(index) {
    try {
      await AsyncStorage.setItem(this.cacheIndexKey, JSON.stringify(index));
    } catch (error) {
      console.error('Error saving cache index:', error);
    }
  }

  // Check if image is cached locally
  async isImageCached(url) {
    const index = await this.getCacheIndex();
    const cacheEntry = Object.values(index).find(entry => entry.originalUrl === url);
    
    if (cacheEntry) {
      const fileInfo = await FileSystem.getInfoAsync(cacheEntry.localUri);
      return fileInfo.exists;
    }
    
    return false;
  }

  // Get cached image URI
  async getCachedImage(url) {
    const index = await this.getCacheIndex();
    const cacheEntry = Object.values(index).find(entry => entry.originalUrl === url);
    
    if (cacheEntry) {
      const fileInfo = await FileSystem.getInfoAsync(cacheEntry.localUri);
      if (fileInfo.exists) {
        // Update last accessed time
        cacheEntry.lastAccessed = Date.now();
        await this.saveCacheIndex(index);
        return cacheEntry.localUri;
      }
    }
    
    return null;
  }

  // Cache image locally and to Firebase Storage
  async cacheImage(url, metadata = {}) {
    try {
      // Check if already cached
      const cachedUri = await this.getCachedImage(url);
      if (cachedUri) {
        console.log('Image already cached:', cachedUri);
        return cachedUri;
      }

      // Generate unique cache key
      const cacheKey = this.getCacheKey(url);
      const localUri = `${this.cacheDir}${cacheKey}`;
      
      console.log('Caching image:', url);
      
      // Download image to local cache
      const downloadResult = await FileSystem.downloadAsync(url, localUri);
      
      if (downloadResult.status === 200) {
        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        
        // Upload to Firebase Storage (async, don't wait)
        this.uploadToFirebaseStorage(localUri, cacheKey, {
          ...metadata,
          originalUrl: url,
        }).then(firebaseUrl => {
          // Update cache index with Firebase URL
          this.updateCacheEntry(url, localUri, firebaseUrl, fileInfo.size);
        }).catch(error => {
          console.error('Firebase upload error:', error);
        });
        
        // Update cache index
        await this.updateCacheEntry(url, localUri, null, fileInfo.size);
        
        // Check cache size and cleanup if needed
        await this.checkCacheSize();
        
        return localUri;
      }
      
      throw new Error('Failed to download image');
    } catch (error) {
      console.error('Error caching image:', error);
      return url; // Return original URL as fallback
    }
  }

  // Update cache entry in index
  async updateCacheEntry(originalUrl, localUri, firebaseUrl, size) {
    const index = await this.getCacheIndex();
    const cacheKey = localUri.split('/').pop();
    
    index[cacheKey] = {
      originalUrl,
      localUri,
      firebaseUrl: firebaseUrl || index[cacheKey]?.firebaseUrl,
      size,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
    };
    
    await this.saveCacheIndex(index);
  }

  // Upload image to Firebase Storage
  async uploadToFirebaseStorage(localUri, filename, metadata) {
    try {
      // Check if user is authenticated
      if (!metadata.userId) {
        console.warn('No userId provided for Firebase Storage upload');
        return null;
      }

      // Read file as blob
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function() {
          resolve(xhr.response);
        };
        xhr.onerror = function() {
          reject(new TypeError('Network request failed'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', localUri, true);
        xhr.send(null);
      });

      // Create storage reference with proper path
      const storageRef = ref(
        storage, 
        `storyImages/${metadata.userId}/${filename}`
      );
      
      // Upload file with metadata
      const uploadMetadata = {
        contentType: 'image/jpeg',
        customMetadata: {
          storyStage: metadata.storyStage?.toString() || '0',
          journeyId: metadata.journeyId || '',
          timestamp: new Date().toISOString(),
          originalUrl: metadata.originalUrl || '',
          type: metadata.type || 'scene',
        }
      };
      
      const snapshot = await uploadBytes(storageRef, blob, uploadMetadata);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Image uploaded to Firebase:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading to Firebase Storage:', error);
      return null;
    }
  }

  // Get image (from cache or download)
  async getImage(url, metadata = {}) {
    try {
      // Check local cache first
      const cachedUri = await this.getCachedImage(url);
      if (cachedUri) {
        console.log('Using cached image:', cachedUri);
        return cachedUri;
      }
      
      // Check if we have a Firebase URL for this image
      const index = await this.getCacheIndex();
      const cacheEntry = Object.values(index).find(
        entry => entry.originalUrl === url && entry.firebaseUrl
      );
      
      if (cacheEntry?.firebaseUrl) {
        // Try to download from Firebase Storage (might be faster/more reliable)
        console.log('Downloading from Firebase Storage:', cacheEntry.firebaseUrl);
        return await this.cacheImage(cacheEntry.firebaseUrl, metadata);
      }
      
      // Cache new image
      console.log('Caching new image:', url);
      return await this.cacheImage(url, metadata);
      
    } catch (error) {
      console.error('Error getting image:', error);
      return url; // Return original URL as fallback
    }
  }

  // Check cache size and cleanup if needed
  async checkCacheSize() {
    try {
      const index = await this.getCacheIndex();
      let totalSize = 0;
      const entries = Object.entries(index);
      
      // Calculate total cache size
      for (const [key, entry] of entries) {
        totalSize += entry.size || 0;
      }
      
      console.log(`Cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      
      // If cache is too large, remove oldest entries
      if (totalSize > this.maxCacheSize) {
        console.log('Cache size exceeded, cleaning up...');
        
        // Sort by last accessed time
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        // Remove oldest entries until under limit
        let removed = 0;
        for (const [key, entry] of entries) {
          if (totalSize <= this.maxCacheSize * 0.8) break; // Keep 20% buffer
          
          await this.removeCacheEntry(key);
          totalSize -= entry.size || 0;
          removed++;
        }
        
        console.log(`Removed ${removed} cached images`);
      }
    } catch (error) {
      console.error('Error checking cache size:', error);
    }
  }

  // Remove a single cache entry
  async removeCacheEntry(cacheKey) {
    try {
      const index = await this.getCacheIndex();
      const entry = index[cacheKey];
      
      if (entry) {
        // Delete local file
        await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
        
        // Remove from index
        delete index[cacheKey];
        await this.saveCacheIndex(index);
        
        console.log('Removed cache entry:', cacheKey);
      }
    } catch (error) {
      console.error('Error removing cache entry:', error);
    }
  }

  // Clear old cache entries
  async clearOldCache() {
    try {
      const index = await this.getCacheIndex();
      const now = Date.now();
      let removed = 0;
      
      for (const [key, entry] of Object.entries(index)) {
        const age = now - entry.cachedAt;
        
        if (age > this.maxCacheAge) {
          await this.removeCacheEntry(key);
          removed++;
        }
      }
      
      if (removed > 0) {
        console.log(`Cleared ${removed} old cache entries`);
      }
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }

  // Clear entire cache
  async clearAllCache() {
    try {
      // Delete cache directory
      await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
      
      // Recreate cache directory
      await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      
      // Clear cache index
      await this.saveCacheIndex({});
      
      console.log('All cache cleared');
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const index = await this.getCacheIndex();
      const entries = Object.values(index);
      
      let totalSize = 0;
      let localOnly = 0;
      let withFirebase = 0;
      
      for (const entry of entries) {
        totalSize += entry.size || 0;
        if (entry.firebaseUrl) {
          withFirebase++;
        } else {
          localOnly++;
        }
      }
      
      return {
        totalImages: entries.length,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        localOnly,
        withFirebase,
        oldestCache: entries.length > 0 
          ? new Date(Math.min(...entries.map(e => e.cachedAt)))
          : null,
        newestCache: entries.length > 0
          ? new Date(Math.max(...entries.map(e => e.cachedAt)))
          : null,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalImages: 0,
        totalSizeMB: 0,
        localOnly: 0,
        withFirebase: 0,
      };
    }
  }

  // Preload images for better performance
  async preloadImages(urls, metadata = {}) {
    console.log(`Preloading ${urls.length} images...`);
    
    const results = await Promise.allSettled(
      urls.map(url => this.getImage(url, metadata))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Preloaded ${successful}/${urls.length} images successfully`);
    
    return results;
  }
}

// Create singleton instance
const imageCacheService = new ImageCacheService();

// Export service and useful functions
export default imageCacheService;