import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function IntroScreen({ navigation }) {
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://picsum.photos/800/1200' }} // Placeholder image
        style={styles.backgroundImage}
      />
      <View style={styles.overlay} />
      
      <Animated.View style={[
        styles.content,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}>
        <Text style={styles.title}>The Crystal Realm Awakens</Text>
        <Text style={styles.narration}>
          You find yourself in a mystical realm where crystals hold ancient power. 
          Three companions await to guide you through your journey...
        </Text>
        
        <TouchableOpacity
          style={styles.enterButton}
          onPress={() => navigation.navigate('Chat')}
        >
          <Text style={styles.enterButtonText}>Enter the Realm</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    width: width,
    height: height,
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    width: width,
    height: height,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  narration: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 50,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  enterButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  enterButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});