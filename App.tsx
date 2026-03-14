import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Vibration,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Tts from 'react-native-tts';

// ─────────────────────────────────────────────
// NATIVE SPEECH MODULE SETUP
// Connects to our custom SpeechModule.kt bridge
// ─────────────────────────────────────────────
const { SpeechModule } = NativeModules;
const speechEmitter = SpeechModule ? new NativeEventEmitter(SpeechModule) : null;

// ─────────────────────────────────────────────
// PERMISSION HELPER
// Requests microphone access on Android devices
// ─────────────────────────────────────────────
async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission',
      message: 'Clairvoyance needs microphone access to hear your voice.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

// ─────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────
function App() {
  // ── State ──────────────────────────────────
  const [isListening, setIsListening]       = useState(false);
  const [recognizedText, setRecognizedText] = useState('');

  // ── Initialization ─────────────────────────
  // Runs once on app launch:
  // - Sets up TTS voice settings
  // - Plays a welcome greeting
  // - Subscribes to speech recognition events
  useEffect(() => {

    // Configure Claire's voice after TTS is ready
    Tts.getInitStatus().then(() => {
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultRate(0.5);
      Tts.setDefaultPitch(1.1);

      // Greet the user on startup
      setTimeout(() => {
        Tts.speak("Hello, I'm Claire. Tap the button and talk to me.");
      }, 1000);
    }).catch(() => {
      console.warn('TTS not available on this device');
    });

    // Guard: if speech module isn't available, stop here
    if (!speechEmitter) return;

    // Listen for successful speech recognition results
    const resultSub = speechEmitter.addListener(
      'onSpeechResult',
      (text: string) => {
        setRecognizedText(text);
        setIsListening(false);
        handleVoiceCommand(text); // process and respond
      },
    );

    // Listen for speech recognition errors
    const errorSub = speechEmitter.addListener(
      'onSpeechError',
      (error: string) => {
        console.warn('Speech error:', error);
        setIsListening(false);
        setRecognizedText('');
      },
    );

    // Cleanup on unmount
    return () => {
      resultSub.remove();
      errorSub.remove();
      Tts.stop();
    };
  }, []);

  // ── Voice Command Handler ───────────────────
  // Processes what the user said and makes
  // Claire respond with an appropriate reply
  const handleVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();

   if (lower.includes('hello') || lower.includes('hi') ||
        lower.includes('hey') || lower.includes('good morning') ||
        lower.includes('good afternoon') || lower.includes('good evening') ||
        lower.includes('claire')) {
      Tts.speak("Hello! How can I help you today?");

    } else if (lower.includes('your name') || lower.includes('who are you')) {
      Tts.speak("I'm Claire, your AI assistant. I'm here to help you navigate the world.");

    } else if (lower.includes('help')) {
      Tts.speak("I can help you navigate, read signs, and describe your surroundings.");

    } else if (lower.includes('thank')) {
      Tts.speak("You're welcome! Is there anything else I can help you with?");

    } else {
      // Default response for unrecognized commands
      Tts.speak(`You said: ${text}. I'm still learning to respond to that.`);
    }
  };

  // ── Toggle Listening ────────────────────────
  // Starts or stops the speech recognition engine
  // Also triggers the haptic heartbeat on start
  const toggleListening = async () => {
    try {

      // ── Stop if already listening ───────────
      if (isListening) {
        SpeechModule?.stopListening();
        setIsListening(false);
        return;
      }

      // ── Guard: check module availability ───
      if (!SpeechModule) {
        Alert.alert('Error', 'Speech module not available.');
        return;
      }

      // ── Request mic permission ──────────────
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to use Claire.',
        );
        return;
      }

      // ── Start listening ─────────────────────
      Tts.stop();                              // stop any ongoing speech
      Vibration.vibrate([0, 100, 50, 100]);   // haptic heartbeat pulse
      setRecognizedText('Listening...');
      setIsListening(true);
      SpeechModule.startListening();

    } catch (e: any) {
      console.error('Voice Error:', e);
      setIsListening(false);
      Alert.alert('Error', e?.message || 'Something went wrong.');
    }
  };

  // ── Render ──────────────────────────────────
  return (
    <SafeAreaView style={styles.backgroundStyle}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>

        {/* App Title */}
        <Text style={styles.title}>CLAIRVOYANCE</Text>

        {/* Claire's current status */}
        <Text style={styles.subtitle}>
          {isListening ? 'Claire is listening...' : 'Claire is ready.'}
        </Text>

        {/* Displays what was recognized */}
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{recognizedText}</Text>
        </View>

        {/* Main voice button — blue when idle, red when listening */}
        <TouchableOpacity
          style={[styles.button, isListening && styles.buttonListening]}
          onPress={toggleListening}
        >
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Listening' : 'Talk to Claire'}
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({

  backgroundStyle: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
  },

  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
    marginBottom: 40,
  },

  resultContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  resultText: {
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 35,
    elevation: 4,
  },

  buttonListening: {
    backgroundColor: '#FF3B30',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },

});

export default App;