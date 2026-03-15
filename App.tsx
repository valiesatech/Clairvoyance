import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import Tts from 'react-native-tts';

// ─────────────────────────────────────────────
// NATIVE SPEECH MODULE SETUP
// ─────────────────────────────────────────────
const { SpeechModule } = NativeModules;
const speechEmitter = SpeechModule ? new NativeEventEmitter(SpeechModule) : null;

// ─────────────────────────────────────────────
// PERMISSION HELPER
// ─────────────────────────────────────────────
async function requestAudioPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission',
      message: 'Clairvoyance needs microphone access.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

// ─────────────────────────────────────────────
// ITEM EXTRACTOR HELPER
// Extracts item name from natural speech
// Works with fast or slow speech patterns
// ─────────────────────────────────────────────
function extractItemName(text: string): string {
  const lower = text.toLowerCase();

  // Pattern 1: "add X to my cart" or "add X to cart"
  const match1 = lower.match(/add\s+(.+?)\s+to\s+(?:my\s+)?cart/);
  if (match1) return match1[1].trim();

  // Pattern 2: "add X cart" (fast speech drops "to")
  const match2 = lower.match(/add\s+(.+?)\s+cart/);
  if (match2) return match2[1].trim();

  // Pattern 3: "X add to cart" (item said first)
  const match3 = lower.match(/^(.+?)\s+add/);
  if (match3) return match3[1].trim();

  // Pattern 4: just grab everything after "add"
  const match4 = lower.match(/add\s+(.+)/);
  if (match4) {
    return match4[1]
      .replace(/\bto\b/g, '')
      .replace(/\bmy\b/g, '')
      .replace(/\bcart\b/g, '')
      .trim();
  }

  return 'this item';
}

// ─────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────
function App() {

  // ── State ──────────────────────────────────
  const [isListening, setIsListening]       = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [cart, setCart]                     = useState<string[]>([]);

  // Use ref for cart so handleVoiceCommand always sees latest value
  const cartRef = useRef<string[]>([]);
  cartRef.current = cart;

  // ── Initialization ─────────────────────────
  useEffect(() => {

    // Initialize TTS and greet user
    Tts.getInitStatus().then(() => {
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultRate(0.5);
      Tts.setDefaultPitch(1.1);
      setTimeout(() => {
        Tts.speak("Hello, I'm Claire. I'll help you shop independently today.");
      }, 1000);
    }).catch(() => {
      console.warn('TTS not available');
    });

    if (!speechEmitter) return;

    // Listen for speech results
    const resultSub = speechEmitter.addListener(
      'onSpeechResult',
      (text: string) => {
        setRecognizedText(text);
        setIsListening(false);
        handleVoiceCommand(text);
      },
    );

    // Listen for speech errors
    const errorSub = speechEmitter.addListener(
      'onSpeechError',
      (error: string) => {
        console.warn('Speech error:', error);
        setIsListening(false);
        setRecognizedText('');
      },
    );

    return () => {
      resultSub.remove();
      errorSub.remove();
      Tts.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // ── Cart Helpers ────────────────────────────

  // Add item to cart
  const addToCart = (item: string) => {
    setCart(prev => {
      const updated = [...prev, item];
      Tts.speak(
        `${item} added to your cart. You now have ${updated.length} item${updated.length > 1 ? 's' : ''}.`
      );
      return updated;
    });
  };

  // Remove item from cart
  const removeFromCart = (item: string) => {
    setCart(prev => {
      const index = prev.findIndex(i =>
        i.toLowerCase().includes(item.toLowerCase())
      );
      if (index === -1) {
        Tts.speak(`I couldn't find ${item} in your cart.`);
        return prev;
      }
      const updated = prev.filter((_, i) => i !== index);
      Tts.speak(`${item} removed from your cart.`);
      return updated;
    });
  };

  // Read cart aloud
  const readCart = () => {
    const current = cartRef.current;
    if (current.length === 0) {
      Tts.speak("Your cart is empty.");
      return;
    }
    const itemList = current.join(', ');
    Tts.speak(
      `You have ${current.length} item${current.length > 1 ? 's' : ''} in your cart: ${itemList}`
    );
  };

  // ── Stub Functions ──────────────────────────
  // Will be replaced by teammates' real modules

  // Member 2 - Object Detection
  const detectObject = () => {
    Tts.speak("Scanning object. Please hold your camera steady.");
  };

  // Member 3 - Label Reader
  const readLabel = () => {
    Tts.speak("Reading label. Please point your camera at the product.");
  };

  // Member 1 - Navigation
  const navigateTo = (destination: string) => {
    Tts.speak(`Navigating to the ${destination} section. Please follow the audio cues.`);
  };

  // ── Voice Command Handler ───────────────────
  // Processes what the user said and routes
  // to the appropriate action
  const handleVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();

// ── Greetings ───────────────────────────
    if (lower.includes('hello') || lower.includes('hi') ||
        lower.includes('hey') ||
        lower.includes('good morning') || lower.includes('good afternoon') ||
        lower.includes('good evening')) {
      Tts.speak("Hello! I'm ready to help you shop. What would you like to do?");

    // ── Identity ────────────────────────────
    } else if (lower.includes('who are you') || lower.includes('your name')) {
      Tts.speak("I'm Claire, your AI shopping assistant. I can help you find products, read labels, and manage your shopping cart.");

    // ── Add to Cart ─────────────────────────
    } else if (lower.includes('add') && lower.includes('cart')) {
      const itemName = extractItemName(lower);
      addToCart(itemName);

    // ── Remove from Cart ────────────────────
    } else if (lower.includes('remove') || lower.includes('delete')) {
      const match = lower.match(/(?:remove|delete)\s+(.+?)(?:\s+from\s+(?:my\s+)?cart)?$/);
      const itemName = match ? match[1].trim() : 'item';
      removeFromCart(itemName);

    // ── Read Cart ───────────────────────────
    } else if (
      (lower.includes('what') && lower.includes('cart')) ||
      lower.includes('my cart') ||
      lower.includes('show cart') ||
      lower.includes('read cart') ||
      lower.includes('list cart') ||
      lower.includes('whats in')
    ) {
      readCart();

    // ── Clear Cart ──────────────────────────
    } else if (lower.includes('clear cart') || lower.includes('empty cart')) {
      setCart([]);
      Tts.speak("Your cart has been cleared.");

    // ── Item Count ──────────────────────────
    } else if (lower.includes('how many') || lower.includes('count')) {
      const count = cartRef.current.length;
      Tts.speak(`You have ${count} item${count !== 1 ? 's' : ''} in your cart.`);

    // ── Object Detection ────────────────────
    } else if (
      lower.includes('what is this') ||
      lower.includes('what am i holding') ||
      lower.includes('identify') ||
      lower.includes('detect') ||
      lower.includes('scan')
    ) {
      detectObject();

    // ── Label Reading ───────────────────────
    } else if (
      lower.includes('read the label') ||
      lower.includes('read label') ||
      lower.includes('price') ||
      lower.includes('ingredients') ||
      lower.includes('expiry') ||
      lower.includes('expiration') ||
      lower.includes('how much')
    ) {
      readLabel();

    // ── Navigation ──────────────────────────
    } else if (
      lower.includes('take me') ||
      lower.includes('navigate') ||
      lower.includes('where is') ||
      lower.includes('go to')
    ) {
      const match = lower.match(/(?:take me to|navigate to|where is|go to)\s+(.+)/);
      const destination = match ? match[1].trim() : 'your destination';
      navigateTo(destination);

    // ── Help ────────────────────────────────
    } else if (lower.includes('help') || lower.includes('what can you do')) {
      Tts.speak(
        "Here's what I can do: Say add apples to cart to add items. Say what's in my cart to hear your list. Say read the label to scan a product. Say what is this to identify an object. Say take me to the dairy section to navigate."
      );

    // ── Thanks ──────────────────────────────
    } else if (lower.includes('thank')) {
      Tts.speak("You're welcome! Happy shopping!");

    // ── Default ─────────────────────────────
    } else {
      Tts.speak(
        `I heard: ${text}. Try saying add to cart, read the label, or what's in my cart.`
      );
    }
  };

  // ── Toggle Listening ────────────────────────
  const toggleListening = async () => {
    try {

      // Stop if already listening
      if (isListening) {
        SpeechModule?.stopListening();
        setIsListening(false);
        return;
      }

      // Check module availability
      if (!SpeechModule) {
        Alert.alert('Error', 'Speech module not available.');
        return;
      }

      // Request mic permission
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please allow microphone access.');
        return;
      }

      // Start listening with haptic feedback
      Tts.stop();
      Vibration.vibrate([0, 100, 50, 100]);
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
        <Text style={styles.tagline}>Your AI Shopping Assistant</Text>

        {/* Claire's current status */}
        <Text style={styles.subtitle}>
          {isListening ? 'Claire is listening...' : 'Claire is ready.'}
        </Text>

        {/* Displays what was recognized */}
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{recognizedText}</Text>
        </View>

        {/* Shopping Cart Display */}
        <View style={styles.cartContainer}>
          <Text style={styles.cartTitle}>🛒 Cart ({cart.length} items)</Text>
          <ScrollView style={styles.cartScroll}>
            {cart.length === 0
              ? <Text style={styles.cartEmpty}>Your cart is empty</Text>
              : cart.map((item, index) => (
                  <Text key={index} style={styles.cartItem}>• {item}</Text>
                ))
            }
          </ScrollView>
        </View>

        {/* Main voice button */}
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
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
  },

  tagline: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 18,
    color: '#666',
    marginTop: 5,
    marginBottom: 15,
  },

  resultContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },

  resultText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  cartContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
    maxHeight: 200,
  },

  cartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },

  cartScroll: {
    maxHeight: 140,
  },

  cartEmpty: {
    fontSize: 14,
    color: '#aaa',
    fontStyle: 'italic',
  },

  cartItem: {
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
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