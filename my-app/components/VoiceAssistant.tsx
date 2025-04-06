import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import OpenAI from 'openai';
import { config } from '../config';

export function VoiceAssistant() {
  const [isProcessing, setIsProcessing] = useState(false);

  const processWithAI = async () => {
    setIsProcessing(true);
    try {
      // Initialize OpenAI
      const openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });

      // Get response from OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant for a blind person. Provide clear, concise guidance based on their requests."
          },
          {
            role: "user",
            content: "What do you see in front of me?"
          }
        ],
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        // Speak the response
        await Speech.speak(aiResponse, {
          language: 'en',
          pitch: 1,
          rate: 0.9,
        });
      }
    } catch (error) {
      console.error('Error processing with AI:', error);
      await Speech.speak('Sorry, I encountered an error processing your request.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isProcessing ? styles.buttonProcessing : null]}
        onPress={processWithAI}
        disabled={isProcessing}
      >
        <Text style={styles.buttonText}>
          {isProcessing ? 'Processing...' : 'Start Conversation'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonProcessing: {
    backgroundColor: '#FFB100',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 