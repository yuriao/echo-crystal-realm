// ===== src/components/CompanionHeader.js (UPDATED) =====
// Updated header with token progress bar
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ===== src/components/CompanionHeader.js - COMPLETE GOAL-FREE VERSION =====

const CompanionHeader = ({ 
  onBack, 
  crystals, 
  stage, 
  storyContext 
}) => {
  const getStageDisplayName = () => {
    if (storyContext?.stageName) {
      //return storyContext.stageName;
      return 'Echo in Crystal Realm';
    }
    
    const stageNames = [
      'Awakening',
      'Crystal Council', 
      'Crystal Gardens',
      'Nexus of Paths',
      'Heart of Realm',
      'Farewell'
    ];
    //return stageNames[stage] || 'Crystal Realm';
    return 'Echo in Crystal Realm';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#A78BFA" />
        </TouchableOpacity>

        {/* Stage Name */}
        <View style={styles.stageContainer}>
          <Text style={styles.stageText}>
            {getStageDisplayName()}
          </Text>
        </View>

        {/* Crystal Count */}
        <View style={styles.crystalContainer}>
          <Ionicons name="diamond" size={18} color="#F59E0B" />
          <Text style={styles.crystalText}>
            {crystals}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f0f23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    padding: 5,
  },
  stageContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stageText: {
    color: '#A78BFA',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  crystalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
  },
  crystalText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});

export default CompanionHeader;