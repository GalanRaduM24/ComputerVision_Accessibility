import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, SafeAreaView, StatusBar, ActivityIndicator, Platform, Alert, Animated } from 'react-native';
import * as Speech from 'expo-speech';
import OpenAI from 'openai';
import { config } from '@/config';
import Voice, { SpeechErrorEvent, SpeechResultsEvent } from '@react-native-voice/voice';
import { PermissionsAndroid } from 'react-native';

export default function Camera() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const isActiveRef = useRef(false);
  const isProcessingVoiceRef = useRef(false);
  const [showVoiceDebug, setShowVoiceDebug] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceCommandEnabled, setVoiceCommandEnabled] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [micPermissionStatus, setMicPermissionStatus] = useState<string | null>(null);
  const animatedMicVolume = useRef(new Animated.Value(0)).current;
  const [heardWakeWord, setHeardWakeWord] = useState(false);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showNoMatchFeedback, setShowNoMatchFeedback] = useState(false);
  const noMatchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SINGLE SOURCE OF TRUTH FOR VOICE RECOGNITION
  useEffect(() => {
    // Track if component is mounted
    let isMounted = true;
    console.log('======= INITIALIZING VOICE RECOGNITION (SINGLE SOURCE) =======');
    
    const setupVoiceRecognition = async () => {
      try {
        // Properly clean up any existing instances first
        try {
          console.log('Cleaning up existing Voice instance on startup');
          // First stop any ongoing recognition
          if (Voice.isRecognizing && typeof Voice.isRecognizing === 'function') {
            const isActive = await Voice.isRecognizing();
            if (isActive) {
              await Voice.stop();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          // Destroy and recreate Voice instance to reset everything
          // This is needed to prevent issues when the app is restarted
          await Voice.destroy();
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('Voice instance destroyed successfully on startup');
        } catch (e) {
          console.error('Error cleaning up Voice on startup:', e);
        }
        
        // Check permissions
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          
          if (!granted) {
            const result = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: "Microphone Permission",
                message: "This app needs access to your microphone for voice commands",
                buttonNeutral: "Ask Me Later",
                buttonNegative: "Cancel",
                buttonPositive: "OK"
              }
            );
            
            if (result !== 'granted') {
              console.log('Microphone permission denied');
              setMicPermissionStatus('denied');
              return;
            }
          }
          setMicPermissionStatus('granted');
        }

        // Check if Voice is available
        if (typeof Voice.isAvailable === 'function') {
          await Voice.isAvailable();
          if (!isMounted) return;
          
          console.log('Voice recognition is available');
          setVoiceAvailable(true);
          setVoiceCommandEnabled(true);
          
          // IMPORTANT: We're using standard function assignment instead of property assignment
          // to avoid NativeEventEmitter warnings
          
          // Set up listeners - ONLY PLACE where listeners are attached
          try {
            Voice.onSpeechStart = (e) => {
              // Minimal logging - just set state
              setIsListening(true);
            };
            
            Voice.onSpeechEnd = (e) => {
              // Log speech end for debugging
              console.log('VOICE EVENT: Speech ended');
              
              // Always try to restart after a small delay
              // This ensures continuous operation
              setTimeout(() => {
                if (voiceCommandEnabled) {
                  try {
                    console.log('Restarting voice recognition after speech end');
                    Voice.start('en-US');
                  } catch (err) {
                    console.log('Error restarting after speech end:', err);
                  }
                }
              }, 300);
            };
          } catch (err) {
            console.log('Error setting speech handlers:', err);
          }
          
          // Set up results handler
          try {
            Voice.onSpeechResults = (e: SpeechResultsEvent) => {
              try {
                console.log('VOICE EVENT: Speech results', e);
                
                if (!e?.value || !Array.isArray(e.value) || e.value.length === 0) {
                  return;
                }
                
                // Log all recognized options
                const recognizedText = e.value.map(text => text?.toLowerCase().trim()).filter(Boolean);
                console.log('ALL HEARD OPTIONS:', recognizedText.join(', '));
                
                // Save the first recognized text
                if (recognizedText.length > 0) {
                  setRecognizedText(recognizedText[0]);
                  
                  // IMPROVED WAKE WORD DETECTION - more sensitive
                  // Log each word for debugging
                  const allWords = recognizedText.flatMap(text => text.split(/\s+/));
                  console.log('ALL INDIVIDUAL WORDS:', allWords.join(', '));
                  
                  // Look for wake word in any text option or individual word
                  const hasWakeWord = recognizedText.some(text => {
                    // Check for full matches
                    if (text.includes('hey') || 
                        text.includes('hi') || 
                        text.includes('he') ||
                        text.includes('hay') ||
                        text.includes('a') ||
                        text.includes('8') ||
                        text === 'e' ||
                        text === 'eh' ||
                        text === 'ay') {
                      console.log('WAKE WORD FOUND IN PHRASE:', text);
                      return true;
                    }
                    
                    // Check for individual words
                    const words = text.split(/\s+/);
                    const wordMatch = words.some(word => {
                      const isMatch = word === 'hey' || 
                                     word === 'hi' || 
                                     word === 'he' ||
                                     word === 'hay' ||
                                     word === 'a' ||
                                     word === 'e' ||
                                     word === 'eh' ||
                                     word === 'ay' ||
                                     word === '8' ||
                                     word.length <= 2;
                      if (isMatch) {
                        console.log('WAKE WORD FOUND AS INDIVIDUAL WORD:', word);
                      }
                      return isMatch;
                    });
                    
                    return wordMatch;
                  });
                  
                  if (hasWakeWord) {
                    console.log('WAKE WORD DETECTED!');
                    setHeardWakeWord(true);
                    if (wakeWordTimeoutRef.current) {
                      clearTimeout(wakeWordTimeoutRef.current);
                    }
                    wakeWordTimeoutRef.current = setTimeout(() => {
                      setHeardWakeWord(false);
                    }, 3000);
                    
                    // Check if we're in analysis mode and interrupt it
                    if (isActiveRef.current) {
                      console.log('Analysis mode is active, interrupting for voice command');
                      // Stop ongoing analysis
                      setIsActive(false);
                      isActiveRef.current = false;
                      
                      // Stop any ongoing speech
                      Speech.stop();
                      
                      // Provide feedback
                      Speech.speak("Yes? How can I help?", { rate: 1.0, pitch: 1.0 });
                    } else {
                      // Regular voice command flow (not in analysis mode)
                      Speech.stop();
                      Speech.speak("Yes?", { rate: 1.0, pitch: 1.0 });
                    }
                    
                    // Process command
                    setTimeout(() => {
                      handleVoiceCommand(recognizedText[0]);
                    }, 500);
                  } else {
                    console.log('No wake word detected in:', recognizedText.join(', '));
                  }
                }
              } catch (error) {
                console.error('Error processing speech results:', error);
              }
            };
          } catch (err) {
            console.log('Error setting speech results handler:', err);
          }
          
          try {
            Voice.onSpeechError = (e: SpeechErrorEvent) => {
              // Log all errors but don't respond to most of them
              console.log('VOICE EVENT: Speech error', e);
              
              // IGNORE MOST COMMON ERRORS that don't require restart
              // Code 7: "No match" - No speech detected
              // Code 5: "Client side error" - Often recovers on its own
              // Code 6: "Speech timeout" - Nothing detected in time frame
              // Code 4: "Recognizer busy" - System already recognizing
              if (e?.error?.code === "7" || 
                  e?.error?.code === "5" || 
                  e?.error?.code === "6" ||
                  e?.error?.code === "4") {
                console.log(`Ignoring error code ${e?.error?.code} - continuing without restart`);
                
                // Show visual feedback that an error occurred but we're continuing
                setVoiceError(`Error ${e?.error?.code} ignored, still listening`);
                setTimeout(() => {
                  if (voiceCommandEnabled) {
                    setVoiceError(null);
                  }
                }, 3000);
                
                return;
              }
              
              // Only restart for critical error types
              console.log('Critical error occurred, restarting voice recognition');
              if (voiceCommandEnabled) {
                setTimeout(() => {
                  Voice.start('en-US');
                  console.log('Voice recognition restarted after critical error');
                }, 500);
              }
            };
          } catch (err) {
            console.log('Error setting speech error handler:', err);
          }
          
          try {
            Voice.onSpeechVolumeChanged = (e: any) => {
              if (e && typeof e.value === 'number') {
                // Original value is in dB, convert to percentage
                const normalizedVolume = Math.max(0, Math.min(1, (e.value + 100) / 100));
                setMicVolume(normalizedVolume);
                
                Animated.timing(animatedMicVolume, {
                  toValue: normalizedVolume,
                  duration: 100,
                  useNativeDriver: false
                }).start();
                
                // Log volume periodically
                if (Math.random() < 0.1) {
                  console.log(`VOICE VOLUME: ${Math.round(normalizedVolume * 100)}% (${e.value}dB)`);
                }
              }
            };
          } catch (err) {
            console.log('Error setting speech volume handler:', err);
          }
          
          // Start listening with minimal settings
          await Voice.start('en-US');
          console.log('Voice recognition started');
          
          // Announce that voice is ready
          Speech.speak("Voice assistant ready. Say 'Hey' clearly for voice commands.", {
            rate: 0.9,
            pitch: 1.0,
            volume: 1.0
          });
        }
      } catch (error: unknown) {
        console.error('Error setting up voice recognition:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setVoiceError(`Error: ${errorMessage}`);
      }
    };
    
    // Add a minimal watchdog timer that only runs every 60 seconds
    const watchdogInterval = setInterval(async () => {
      try {
        if (isMounted && voiceCommandEnabled) {
          // Only log at debug level - not visible to user
          
          // Only check and restart if not already listening
          if (Voice.isRecognizing && typeof Voice.isRecognizing === 'function') {
            const isActive = await Voice.isRecognizing();
            
            if (!isActive) {
              console.log('WATCHDOG: Voice recognition not running, restarting it');
              await Voice.start('en-US');
            }
          }
        }
      } catch (err) {
        // Silent error handling - don't log
      }
    }, 60000); // Check only once per minute
    
    // Start the setup
    setupVoiceRecognition();
    
    // Cleanup on unmount
    return () => {
      isMounted = false;
      clearInterval(watchdogInterval);
      
      // Proper cleanup with better error handling
      console.log('Cleaning up Voice on component unmount');
      try {
        // First try to stop
        Voice.stop().catch(e => console.log('Error stopping Voice on unmount:', e));
        
        // Then try to destroy after a short delay
        setTimeout(() => {
          if (Voice) {
            Voice.destroy().catch(e => console.log('Error destroying Voice on unmount:', e));
          }
        }, 300);
      } catch (e) {
        console.error('Error cleaning up Voice on unmount:', e);
      }
    };
  }, []); // Only run once when component mounts

  // Check for speech to interrupt - run in separate effect
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;
    
    if (voiceAvailable) {
      // Start periodic check for interruption
      checkInterval = setInterval(async () => {
        const isSpeaking = await Speech.isSpeakingAsync();
        if (isActiveRef.current && isSpeaking) {
          // If there's recognized text with a wake word, interrupt
          if (recognizedText.includes('hey') || 
              recognizedText.includes('hay') || 
              recognizedText.includes('hi')) {
            console.log('Interrupting speech due to wake word detection');
            Speech.stop();
            // After stopping speech, process the command
            if (!isProcessingVoiceRef.current) {
              handleVoiceCommand(recognizedText);
            }
          }
        }
      }, 500);
    }
    
    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [voiceAvailable, recognizedText]);

  // Modify the useEffect that sets up voice recognition to auto-start listening
  useEffect(() => {
    // This duplicate voice setup is causing conflicts - removing it
    console.log('Secondary voice setup disabled to prevent conflicts');
  }, []);

  // Add log for app initialization
  useEffect(() => {
    console.log('======= APP INITIALIZING =======');
    // This duplicate voice restart is causing conflicts - removing it
    console.log('Force restart disabled to prevent conflicts with main voice initialization');
    
    // No cleanup needed here - it's all handled in the main voice useEffect
  }, []);

  // Modify startListening to auto-restart when it ends
  const startListening = async () => {
    if (!voiceAvailable || isListening) {
      return;
    }
    
    try {
      await Voice.start('en-US');
      console.log('Voice recognition started manually');
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      setVoiceError('Failed to start voice recognition');
    }
  };

  const stopListening = async () => {
    if (!voiceAvailable || !isListening) {
      return;
    }
    
    try {
      await Voice.stop();
      console.log('Voice recognition stopped manually');
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const handleVoiceCommand = async (text: string) => {
    try {
      // Set processing flag to prevent duplicate handling
      isProcessingVoiceRef.current = true;
      
      // Always make sure we're not actively analyzing if we're processing a voice command
      if (isActiveRef.current) {
        console.log('Stopping ongoing analysis to handle voice command');
        setIsActive(false);
        isActiveRef.current = false;
      }
      
      // Stop current speech and analysis
      Speech.stop();
      
      // Stop listening during processing
      await stopListening();
      
      // Extract the command (remove wake words with more flexibility)
      let command = text.toLowerCase();
      const wakeWords = ['hey', 'hay', 'hi', 'he', 'they', 'a', 'help'];
      
      // Enhanced command extraction with special handling
      // First try to find the index of any wake word
      let commandStart = 0;
      
      for (const word of wakeWords) {
        const index = command.indexOf(word);
        if (index !== -1) {
          // Find the end of the wake word (add word length)
          const potentialStart = index + word.length;
          // Update command start position if this is further along
          if (potentialStart > commandStart) {
            commandStart = potentialStart;
          }
        }
      }
      
      // Extract everything after the wake word
      if (commandStart > 0 && commandStart < command.length) {
        command = command.substring(commandStart).trim();
      }
      
      // Special fixes for common misrecognitions
      if (command.startsWith("ts")) command = "what's" + command.substring(2);
      if (command.startsWith("s")) command = "what's" + command.substring(1);
      if (command.startsWith("at")) command = "what" + command.substring(2);
      if (command === "t's in front of me") command = "what's in front of me";
      
      console.log('Extracted command:', command);
      
      // Handle task-specific requests
      if (command.length > 0) {
        // Check if it's a task-specific request with words like "find" or "where is"
        const isTaskSpecific = 
          command.includes('find') || 
          command.includes('where') || 
          command.includes('is there') || 
          command.includes('can you see') || 
          command.includes('looking for') ||
          command.includes('help me');
        
        // Provide confirmation feedback
        await Speech.speak("Processing your task request", {
          rate: 1.1,
          pitch: 1.0,
        });
        
        // Take a picture and process with the command
        await processCustomRequest(command);
        
        // After completing the request, if user was in analysis mode before, 
        // ask if they want to resume it
        if (isTaskSpecific) {
          setTimeout(async () => {
            if (!isActiveRef.current && !isProcessingVoiceRef.current) {
              await Speech.speak("Task completed. Say 'hey resume' to continue analysis mode.", {
                rate: 1.0,
                pitch: 1.0,
              });
            }
          }, 1000);
        }
      } else {
        // If command is empty, ask for clarification
        await Speech.speak("I heard you, but I didn't catch what you're looking for. Please try again with 'hey, find...'", {
          rate: 1.0,
          pitch: 1.0,
        });
        
        // Resume listening after speaking
        startListening();
      }
      
      // Special case for "resume" command to go back to analysis mode
      if (command.includes('resume') || command.includes('continue') || command.includes('start analysis')) {
        console.log('Resume command detected, restarting analysis mode');
        setTimeout(() => {
          toggleAnalysis(); // Turn analysis mode back on
        }, 1000);
      }
    } catch (error) {
      console.error('Error handling voice command:', error);
      await Speech.speak("Sorry, I had trouble processing your request.", {
        rate: 1.0,
        pitch: 1.0,
      });
    } finally {
      // Reset processing flag
      setTimeout(() => {
        isProcessingVoiceRef.current = false;
        
        // Resume voice listening
        startListening();
      }, 500);
    }
  };

  const processCustomRequest = async (command: string) => {
    console.log('Processing custom request:', command);
    
    if (!cameraRef.current) {
      await Speech.speak("Camera is not available", {
        rate: 1.0,
        pitch: 1.0,
      });
      return;
    }
    
    try {
      setIsAnalyzing(true);
      
      // Take picture
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      
      if (!photo?.base64) {
        throw new Error('Failed to capture photo');
      }
      
      // Initialize OpenAI
      const openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
      
      // Convert base64 to URL
      const base64Image = `data:image/jpeg;base64,${photo.base64}`;
      
      // Send to OpenAI with the custom command for task-specific help
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Help with this task: ${command}. Analyze this image to help the user specifically with their request. Focus on identifying and providing information relevant to "${command}". Be concise but helpful (25-35 words).` },
              {
                type: "image_url",
                image_url: {
                  url: base64Image
                }
              },
            ],
          },
        ],
        max_tokens: 150,
      });
      
      const analysis = response.choices[0]?.message?.content;
      
      if (analysis) {
        // Speak the analysis
        await Speech.speak(analysis, {
          language: 'en',
          pitch: 1.0,
          rate: 0.9,
        });
        
        // Wait for speech to complete
        while (await Speech.isSpeakingAsync()) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error processing custom request:', error);
      await Speech.speak('Sorry, I encountered an error processing your request.', {
        rate: 1.0,
        pitch: 1.0,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const takePictureAndAnalyze = async () => {
    console.log('takePictureAndAnalyze called, isActiveRef.current:', isActiveRef.current, 'cameraRef.current:', !!cameraRef.current);
    if (!cameraRef.current || !isActiveRef.current || isProcessingVoiceRef.current) return;

    try {
      console.log('Starting analysis...');
      setIsAnalyzing(true);
      
      // Take picture
      console.log('Taking picture...');
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      console.log('Picture taken, base64 available:', !!photo?.base64);

      if (!photo?.base64) {
        throw new Error('Failed to capture photo');
      }

      // Initialize OpenAI
      console.log('Initializing OpenAI with API key:', config.openaiApiKey ? 'API key exists' : 'No API key');
      const openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });

      // Convert base64 to URL
      const base64Image = `data:image/jpeg;base64,${photo.base64}`;
      console.log('Base64 image prepared, length:', base64Image.length);

      // Get analysis from OpenAI with a more focused prompt for general description
      console.log('Sending request to OpenAI...');
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Provide a general description of this image for a blind person. Describe what's in the scene without focusing on specific tasks. Be concise but informative - 25-35 words." },
              {
                type: "image_url",
                image_url: {
                  url: base64Image
                }
              },
            ],
          },
        ],
        max_tokens: 150,
      });
      console.log('Response received from OpenAI');

      const analysis = response.choices[0]?.message?.content;
      console.log('Analysis:', analysis);
      
      if (analysis) {
        // Speak the analysis
        console.log('Speaking analysis...');
        await Speech.speak(analysis, {
          language: 'en',
          pitch: 1,
          rate: 0.9,
        });
        console.log('Speech started');

        // Wait for speech to complete with interrupt checks
        console.log('Waiting for speech to complete...');
        await waitForSpeechWithInterruptCheck();
        console.log('Speech completed or interrupted');

        // If still active, take next picture
        if (isActiveRef.current && !isProcessingVoiceRef.current) {
          console.log('Still active, taking next picture...');
          takePictureAndAnalyze();
        } else {
          console.log('No longer active, stopping analysis');
        }
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      console.log('Error details:', JSON.stringify(error));
      await Speech.speak('Sorry, I encountered an error analyzing the image.');
      
      // Wait a moment before retrying
      if (isActiveRef.current && !isProcessingVoiceRef.current) {
        console.log('Retrying in 2 seconds...');
        setTimeout(takePictureAndAnalyze, 2000);
      }
    } finally {
      console.log('Analysis completed, setting isAnalyzing to false');
      setIsAnalyzing(false);
    }
  };

  // Modify how we wait for speech to complete to allow interrupts
  const waitForSpeechWithInterruptCheck = async () => {
    while (await Speech.isSpeakingAsync()) {
      // Check for interrupts every 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if a wake word has been detected and exit early if it has
      if (heardWakeWord || recognizedText.includes('hey') || recognizedText.includes('hay') || recognizedText.includes('hi')) {
        console.log('Wake word detected, interrupting speech wait and stopping analysis');
        // Stop the ongoing speech
        Speech.stop();
        // Stop the ongoing analysis immediately
        setIsActive(false);
        isActiveRef.current = false;
        return;
      }
    }
  };

  // Add a manual voice command simulator for testing (when voice recognition isn't available)
  const simulateVoiceCommand = (command: string) => {
    const fullCommand = `hey ${command}`;
    setRecognizedText(fullCommand);
    handleVoiceCommand(fullCommand);
  };

  // Add a function to provide voice guidance for better recognition
  const provideVoiceGuidance = async () => {
    if (isActive && voiceAvailable) {
      await Speech.speak(
        "If you want to ask me something, say 'Hey' followed by your question. Speak clearly and wait for me to respond.",
        { rate: 0.9, pitch: 1.0 }
      );
    }
  };

  // Modify toggleAnalysis to include voice guidance
  const toggleAnalysis = () => {
    if (isActive) {
      // Stop ongoing analysis
      console.log('Stopping analysis...');
      setIsActive(false);
      isActiveRef.current = false;
      Speech.stop();
      
      // Provide feedback
      Speech.speak('Analysis stopped.', { rate: 1.1, pitch: 1.0 });
    } else {
      // Start analysis
      console.log('Starting analysis...');
      setIsActive(true);
      isActiveRef.current = true;
      
      // Provide feedback
      Speech.speak('Starting general scene description.', { rate: 1.1, pitch: 1.0 });
      
      setTimeout(() => {
        if (isActiveRef.current) {
          takePictureAndAnalyze();
        }
      }, 1500);
    }
  };

  // Add a toggle for voice commands separately
  const toggleVoiceCommands = () => {
    if (voiceCommandEnabled) {
      // Disable voice commands
      stopListening();
      setVoiceCommandEnabled(false);
      Speech.speak("Voice commands disabled.", {
        rate: 1.0,
        pitch: 1.0
      });
    } else {
      // Enable voice commands
      setVoiceCommandEnabled(true);
      setTimeout(() => {
        startListening(); // Ensure listening starts after state is updated
      }, 500);
      Speech.speak("Voice commands enabled. Say 'Hey' followed by your question.", {
        rate: 1.0,
        pitch: 1.0
      });
    }
  };

  // Add a debug button to test voice commands in the UI
  const testHeyCommand = async () => {
    console.log("TESTING: Simulating 'hey' wake word");
    
    // If voice commands are not enabled, temporarily enable them
    if (!voiceCommandEnabled) {
      // Check permission first
      const checkPermission = async () => {
        try {
          if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
            );
            
            if (!granted) {
              const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                {
                  title: "Microphone Permission",
                  message: "Voice commands require microphone access",
                  buttonNeutral: "Ask Me Later",
                  buttonNegative: "Cancel",
                  buttonPositive: "OK"
                }
              );
              
              if (result !== 'granted') {
                console.log('Microphone permission denied');
                Speech.speak("Microphone permission is required for voice commands.", {
                  rate: 1.0,
                  pitch: 1.0
                });
                return false;
              }
            }
            return true;
          }
          return true;  // Non-Android platforms
        } catch (err) {
          console.error('Error checking permissions:', err);
          return false;
        }
      };
      
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        return;  // Exit if no permission
      }
      
      // Permission granted, proceed with enabling
      try {
        if (Voice && !isListening) {
          // Ensure Voice module is initialized
          if (typeof Voice.isAvailable === 'function') {
            await Voice.isAvailable();
            // We successfully initialized, proceed with processing the test command
          } else {
            Speech.speak("Voice recognition is not available on this device.", {
              rate: 1.0,
              pitch: 1.0
            });
            return;
          }
        }
      } catch (error) {
        console.error("Error initializing Voice module for test:", error);
        Speech.speak("Voice recognition system is not ready. Please try again.", {
          rate: 1.0,
          pitch: 1.0
        });
        return;
      }
    }
    
    // Process the test command
    Speech.speak("Processing your request", { rate: 1.0, pitch: 1.0 });
    setTimeout(() => {
      handleVoiceCommand("hey what's in front of me");
    }, 500);
  };

  // Also modify the initial announcement to be clearer
  useEffect(() => {
    // Add a debug speech announcement when app starts
    const announceReady = async () => {
      // Wait a moment for everything to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Don't force restart here - use existing one
      console.log('Making voice assistant ready announcement');
      
      Speech.speak("Voice assistant ready. Say 'Hey' clearly for voice commands.", {
        rate: 0.9, // Slower rate for better clarity
        pitch: 1.0,
        volume: 1.0 // Full volume for initial instruction
      });
      
      // After announcement completes, check if it's listening
      setTimeout(async () => {
        try {
          if (Voice && typeof Voice.isRecognizing === 'function') {
            const active = await Voice.isRecognizing();
            if (!active) {
              console.log('Not listening after announcement, starting recognition');
              Voice.start('en-US');
            } else {
              console.log('Voice recognition active after announcement');
            }
          }
        } catch (e) {
          console.error('Error checking recognition after announcement:', e);
        }
      }, 5000);
    };
    
    announceReady();
  }, []);

  // Stronger force reset function that fully destroys and recreates Voice
  const forceResetVoiceRecognition = async () => {
    try {
      console.log('FULL RESET: Completely rebuilding voice recognition...');
      setVoiceError("Performing full reset...");
      
      // First stop any ongoing recognition
      try {
        console.log('Stopping and destroying active recognition...');
        await Voice.stop();
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Then completely destroy
        await Voice.destroy();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error('Error stopping/destroying recognition during reset:', e);
      }
      
      // Start fresh voice recognition with a completely new instance
      try {
        console.log('Starting fresh voice recognition...');
        
        // Explicitly set new listeners
        Voice.onSpeechStart = (e) => {
          setIsListening(true);
        };
        
        Voice.onSpeechEnd = (e) => {
          console.log('VOICE EVENT: Speech ended');
          setTimeout(() => {
            if (voiceCommandEnabled) {
              try {
                console.log('Restarting voice recognition after speech end');
                Voice.start('en-US');
              } catch (err) {
                console.log('Error restarting after speech end:', err);
              }
            }
          }, 300);
        };
        
        Voice.onSpeechError = (e: SpeechErrorEvent) => {
          // Log all errors but don't respond to most of them
          console.log('VOICE EVENT: Speech error', e);
          
          // IGNORE MOST COMMON ERRORS that don't require restart
          if (e?.error?.code === "7" || 
              e?.error?.code === "5" || 
              e?.error?.code === "6" ||
              e?.error?.code === "4") {
            console.log(`Ignoring error code ${e?.error?.code} - continuing without restart`);
            return;
          }
          
          // Only restart for critical error types
          console.log('Critical error occurred, restarting voice recognition');
          if (voiceCommandEnabled) {
            setTimeout(() => {
              Voice.start('en-US');
            }, 500);
          }
        };
        
        // Start with minimal settings to avoid initialization errors
        await Voice.start('en-US');
        console.log('Voice recognition restarted successfully after full reset');
        
        // Provide user feedback
        setVoiceError('Voice reset successful');
        setTimeout(() => setVoiceError(null), 3000);
        
        // Update state
        setIsListening(true);
      } catch (e) {
        console.error('Error starting voice recognition during reset:', e);
        setVoiceError('Failed to restart voice recognition');
      }
    } catch (error) {
      console.error('Error in force reset:', error);
      setVoiceError('Error during voice reset');
    }
  };
  
  if (!permission) {
    console.log('Camera permission is still loading');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    console.log('Camera permission not granted');
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.titleText}>Camera Access Needed</Text>
        <Text style={styles.descriptionText}>
          This app uses your camera to analyze your surroundings and provide audio descriptions.
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestPermission}
          accessibilityLabel="Grant camera permission"
          accessibilityHint="Allows the app to use your camera to analyze surroundings"
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  console.log('Rendering camera view, isActive:', isActive, 'isAnalyzing:', isAnalyzing);
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.cameraContainer}>
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing={facing}
        />
        
        {/* Status overlay */}
        <View style={styles.statusOverlay}>
          {/* Title and status bar */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>Vision Assistant</Text>
            <View style={styles.statusBar}>
              <View style={[styles.statusIndicator, voiceCommandEnabled ? styles.statusActive : styles.statusInactive]} />
              <Text style={styles.statusText}>Voice Commands: {voiceCommandEnabled ? 'ON' : 'OFF'}</Text>
            </View>
          </View>
          
          {/* Active analysis indicator */}
          {isActive && (
            <View style={styles.analysisContainer}>
              <View style={styles.analysisIndicator}>
                <Text style={styles.analysisText}>
                  {isAnalyzing ? 'Analyzing...' : 'Waiting for next analysis'}
                </Text>
                {isAnalyzing && <ActivityIndicator size="small" color="#FFFFFF" />}
              </View>
            </View>
          )}
          
          {/* Error display */}
          {voiceError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{voiceError}</Text>
            </View>
          )}

          {/* Listening indicator with volume bar */}
          {isListening && (
            <View style={styles.listeningContainer}>
              <View style={styles.listeningIndicator}>
                <Text style={styles.listeningText}>Listening</Text>
                <View style={styles.volumeContainer}>
                  <Animated.View 
                    style={[
                      styles.volumeBar, 
                      { 
                        width: animatedMicVolume.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        }) 
                      }
                    ]} 
                  />
                </View>
              </View>
            </View>
          )}
          
          {/* Status indicator to show voice recognition is active */}
          {voiceCommandEnabled && !isListening && (
            <TouchableOpacity 
              style={styles.voiceInactiveContainer}
              onPress={forceResetVoiceRecognition}
            >
              <Text style={styles.voiceInactiveText}>
                Voice recognition inactive - Tap to reset
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Wake word visual indicator */}
          {heardWakeWord && (
            <View style={styles.wakeWordContainer}>
              <Text style={styles.wakeWordText}>Wake word detected!</Text>
            </View>
          )}

          {/* Show no-match indicator */}
          {showNoMatchFeedback && (
            <View style={styles.noMatchContainer}>
              <Text style={styles.noMatchText}>Silence detected (still listening)</Text>
            </View>
          )}
        </View>

        {/* Control buttons - positioned absolutely */}
        <View style={styles.controlsContainer}>
          {/* Main controls row */}
          <View style={styles.mainControlsRow}>
            {/* Main action button */}
            <TouchableOpacity 
              style={[
                styles.mainButton, 
                isActive ? styles.stopButton : styles.startButton
              ]} 
              onPress={toggleAnalysis}
              disabled={isAnalyzing && !isActive}
              accessibilityLabel={isActive ? "Stop analysis" : "Start analysis"}
              accessibilityHint={isActive ? "Stops analyzing your surroundings" : "Starts analyzing and describing your surroundings"}
            >
              <Text style={[
                styles.mainButtonText,
                isActive && styles.stopButtonText
              ]}>
                {isActive ? 'Stop Analysis' : 'Start Analysis'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Secondary controls row */}
          <View style={styles.secondaryControlsRow}>
            {/* Voice command toggle button */}
            {voiceAvailable && (
              <TouchableOpacity 
                style={[
                  styles.voiceToggleButton,
                  voiceCommandEnabled ? styles.voiceEnabledButton : styles.voiceDisabledButton
                ]} 
                onPress={toggleVoiceCommands}
              >
                <Text style={styles.buttonText}>
                  Voice: {voiceCommandEnabled ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Force restart button */}
            <TouchableOpacity 
              style={styles.forceRestartButton} 
              onPress={forceResetVoiceRecognition}
            >
              <Text style={styles.buttonText}>Reset Voice</Text>
            </TouchableOpacity>
          </View>
          
          {/* Recognized text display */}
          {recognizedText && (
            <View style={styles.recognizedTextContainer}>
              <Text style={styles.recognizedTextLabel}>Last heard:</Text>
              <Text style={styles.recognizedTextContent}>{recognizedText}</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 24,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    elevation: 2,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  statusOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    padding: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  headerContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#3B5998',
  },
  statusInactive: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  analysisContainer: {
    width: '100%',
    marginBottom: 12,
    alignItems: 'center',
  },
  analysisIndicator: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 89, 152, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  errorContainer: {
    width: '100%',
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listeningContainer: {
    width: '100%',
    marginBottom: 12,
    alignItems: 'center',
  },
  listeningIndicator: {
    backgroundColor: 'rgba(59, 89, 152, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    width: '90%',
    alignItems: 'center',
  },
  listeningText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  volumeContainer: {
    height: 12,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  volumeBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  volumeText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  voiceInactiveContainer: {
    backgroundColor: 'rgba(158, 158, 158, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    width: '90%',
    alignItems: 'center',
  },
  voiceInactiveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wakeWordContainer: {
    backgroundColor: 'rgba(59, 89, 152, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
    width: '90%',
    alignItems: 'center',
  },
  wakeWordText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noMatchContainer: {
    backgroundColor: 'rgba(158, 158, 158, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
    width: '90%',
    alignItems: 'center',
  },
  noMatchText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  mainControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mainButton: {
    width: '85%',
    paddingVertical: 16,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#3B5998',
  },
  stopButton: {
    backgroundColor: '#9E9E9E',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stopButtonText: {
    color: '#FFFFFF',
  },
  voiceToggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    elevation: 3,
  },
  voiceEnabledButton: {
    backgroundColor: '#3B5998',
  },
  voiceDisabledButton: {
    backgroundColor: '#9E9E9E',
  },
  forceRestartButton: {
    flex: 1,
    backgroundColor: '#3B5998',
    paddingVertical: 12,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  recognizedTextContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  recognizedTextLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recognizedTextContent: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});

