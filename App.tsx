// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
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
// CONFIG
// ─────────────────────────────────────────────
const GROQ_API_KEY = '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';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// ─────────────────────────────────────────────
// NATIVE SPEECH BRIDGE (Kotlin → JS)
// ─────────────────────────────────────────────
const { SpeechModule } = NativeModules;
const speechEmitter = SpeechModule
  ? new NativeEventEmitter(SpeechModule)
  : null;

// ─────────────────────────────────────────────
// PERMISSIONS
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
// GROQ AI — CLAIRE'S BRAIN
// ─────────────────────────────────────────────
async function askClaire(userMessage: string, cartItems: string[]): Promise<string> {
  const cartContext = cartItems.length > 0
    ? `User's cart: ${cartItems.join(', ')}.`
    : 'Cart is empty.';

  const systemPrompt = `You are Claire, a warm AI shopping assistant for visually impaired users.
${cartContext}

Rules:
- Keep responses to 1 sentence MAX, they will be spoken aloud.
- Be warm, clear and friendly.
- If the user wants to add an item to the cart, respond with ONLY: CART_ADD:[item name]. Do NOT ask clarifying questions, just add it.
- If the user wants to remove an item from the cart, respond with ONLY: CART_REMOVE:[item name].
- Never add any other text before or after CART_ADD or CART_REMOVE commands.
- Only ask a clarifying question if the request is completely ambiguous (e.g. user says "add it" with no prior context).
- Never use markdown, bullet points or special characters.
- Speak as if the listener cannot see anything.`;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      max_tokens: 100,
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  console.log('Groq response:', JSON.stringify(data));

  return data?.choices?.[0]?.message?.content?.trim()
    || "I'm sorry, I didn't catch that. Please try again.";
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────
function App() {

  // --- State ---
  const [isListening,    setIsListening]    = useState(false);
  const [isThinking,     setIsThinking]     = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [cart,           setCart]           = useState<string[]>([]);
  const [pendingItem,    setPendingItem]     = useState<string | null>(null);

  // Refs so event listeners always see latest values
  const cartRef    = useRef<string[]>([]);
  const pendingRef = useRef<string | null>(null);
  cartRef.current    = cart;
  pendingRef.current = pendingItem;

  // --- TTS + Speech Listener Setup ---
  useEffect(() => {
    Tts.getInitStatus()
      .then(() => {
        Tts.setDefaultLanguage('en-US');
        Tts.setDefaultRate(0.5);
        Tts.setDefaultPitch(1.1);
        setTimeout(() => {
          Tts.speak("Hello, I'm Claire. I'll help you shop independently today.");
        }, 1000);
      })
      .catch(() => console.warn('TTS not available'));

    if (!speechEmitter) return;

    const resultSub = speechEmitter.addListener('onSpeechResult', (text: string) => {
      setRecognizedText(text);
      setIsListening(false);
      handleVoiceCommand(text);
    });

    const errorSub = speechEmitter.addListener('onSpeechError', (error: string) => {
      console.warn('Speech error:', error);
      setIsListening(false);
      setRecognizedText('');
    });

    return () => {
      resultSub.remove();
      errorSub.remove();
      Tts.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────
  // CART ACTIONS
  // ─────────────────────────────────────────────
  const addToCart = (item: string) => {
    setCart(prev => {
      const updated = [...prev, item];
      Tts.speak(`${item} added. You now have ${updated.length} item${updated.length !== 1 ? 's' : ''}.`);
      return updated;
    });
  };

  const removeFromCart = (item: string) => {
    setCart(prev => {
      const index = prev.findIndex(i => i.toLowerCase().includes(item.toLowerCase()));
      if (index === -1) {
        Tts.speak(`I couldn't find ${item} in your cart.`);
        return prev;
      }
      const updated = prev.filter((_, i) => i !== index);
      Tts.speak(`${item} removed from your cart.`);
      return updated;
    });
  };

  // ─────────────────────────────────────────────
  // TEAMMATE STUBS
  // Member 2 — call detectObject() when object is identified
  // Member 3 — call readLabel('Product Name, $price') when label is scanned
  // Member 1 — call navigateTo('produce section') for navigation
  // ─────────────────────────────────────────────
  const detectObject = () =>
    Tts.speak('Scanning. Please hold your camera steady.');

  const readLabel = (productName?: string) => {
    if (productName) {
      // Member 3 passes in scanned product — Claire asks user to confirm
      setPendingItem(productName);
      pendingRef.current = productName;
      Tts.speak(`I found ${productName}. Would you like to add this to your cart? Say yes or no.`);
    } else {
      Tts.speak('Reading label. Please point your camera at the product.');
    }
  };

  const navigateTo = (destination: string) =>
    Tts.speak(`Navigating to ${destination}. Please follow the audio cues.`);

  // ─────────────────────────────────────────────
  // VOICE COMMAND HANDLER
  // ─────────────────────────────────────────────
  const handleVoiceCommand = async (text: string) => {
    const lower = text.toLowerCase();

    // 1. Handle yes/no confirmation for pending item
    if (pendingRef.current) {
      if (lower.includes('yes') || lower.includes('yeah') || lower.includes('yep') || lower.includes('sure')) {
        addToCart(pendingRef.current);
        setPendingItem(null);
        return;
      }
      if (lower.includes('no') || lower.includes('nope') || lower.includes('cancel')) {
        Tts.speak('Okay, nothing added.');
        setPendingItem(null);
        return;
      }
    }

    // 2. Object detection trigger
    if (lower.includes('what is this') || lower.includes('identify') ||
        lower.includes('detect')       || lower.includes('scan')     ||
        lower.includes('what am i holding')) {
      detectObject(); return;
    }

    // 3. Label reading trigger
    if (lower.includes('read the label') || lower.includes('read label') ||
        lower.includes('ingredients')    || lower.includes('expiry')     ||
        lower.includes('expiration')) {
      readLabel(); return;
    }

    // 4. Navigation trigger
    if (lower.includes('take me') || lower.includes('navigate') ||
        lower.includes('where is') || lower.includes('go to')) {
      const match = lower.match(/(?:take me to|navigate to|where is|go to)\s+(.+)/);
      navigateTo(match?.[1]?.trim() ?? 'your destination');
      return;
    }

    // 5. Clear cart
    if (lower.includes('clear cart') || lower.includes('empty cart')) {
      setCart([]);
      Tts.speak('Your cart has been cleared.');
      return;
    }

    // 6. Read cart
    if ((lower.includes('what') && lower.includes('cart')) ||
        lower.includes('my cart')    || lower.includes('whats in') ||
        lower.includes('show cart')  || lower.includes('list cart')) {
      const current = cartRef.current;
      Tts.speak(
        current.length === 0
          ? 'Your cart is empty.'
          : `You have ${current.length} item${current.length !== 1 ? 's' : ''}: ${current.join(', ')}`,
      );
      return;
    }

    // 7. Count cart items
    if (lower.includes('how many') || lower.includes('count')) {
      const count = cartRef.current.length;
      Tts.speak(`You have ${count} item${count !== 1 ? 's' : ''} in your cart.`);
      return;
    }

    // 8. Everything else — send to Groq AI
    setIsThinking(true);
    Tts.speak('Let me think...');

    try {
      const reply = await askClaire(text, cartRef.current);

      if (reply.startsWith('CART_ADD:')) {
        // Don't add directly — ask user to confirm first
        const item = reply.replace('CART_ADD:', '').split('\n')[0].trim().split(',')[0].trim();
        setPendingItem(item);
        pendingRef.current = item;
        Tts.speak(`Do you want ${item} added to your cart?`);

      } else if (reply.startsWith('CART_REMOVE:')) {
        removeFromCart(reply.replace('CART_REMOVE:', '').split('\n')[0].trim());

      } else {
        Tts.speak(reply);
      }
    } catch (err) {
      console.error('Groq error:', err);
      Tts.speak("I'm having trouble connecting. Please check your internet.");
    } finally {
      setIsThinking(false);
    }
  };

  // ─────────────────────────────────────────────
  // MIC BUTTON HANDLER
  // ─────────────────────────────────────────────
  const toggleListening = async () => {
    try {
      if (isListening) {
        SpeechModule?.stopListening();
        setIsListening(false);
        return;
      }
      if (!SpeechModule) {
        Alert.alert('Error', 'Speech module not available.');
        return;
      }
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please allow microphone access.');
        return;
      }
      Tts.stop();
      Vibration.vibrate([0, 100, 50, 100]);
      setRecognizedText('Listening...');
      setIsListening(true);
      SpeechModule.startListening();
    } catch (e: any) {
      console.error('Voice error:', e);
      setIsListening(false);
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    }
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>

        <Text style={styles.title}>CLAIRVOYANCE</Text>
        <Text style={styles.tagline}>Your AI Shopping Assistant</Text>

        <Text style={styles.status}>
          {isThinking  ? 'Claire is thinking...'       :
           isListening ? 'Claire is listening...'      :
           pendingItem ? 'Waiting for confirmation...' :
                         'Claire is ready.'}
        </Text>

        <View style={styles.speechBox}>
          <Text style={styles.speechText}>{recognizedText}</Text>
        </View>

        <View style={styles.cartBox}>
          <Text style={styles.cartTitle}>🛒 Cart ({cart.length} items)</Text>
          <ScrollView style={styles.cartScroll}>
            {cart.length === 0
              ? <Text style={styles.cartEmpty}>Your cart is empty</Text>
              : cart.map((item, i) => (
                  <Text key={i} style={styles.cartItem}>• {item}</Text>
                ))
            }
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            isListening && styles.buttonRed,
            isThinking  && styles.buttonOrange,
          ]}
          onPress={toggleListening}
          disabled={isThinking}
        >
          <Text style={styles.buttonText}>
            {isThinking  ? 'Claire is thinking...' :
             isListening ? 'Stop Listening'        :
                           'Talk to Claire'}
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
  background:   { flex: 1, backgroundColor: '#F3F3F3' },
  container:    { flex: 1, alignItems: 'center', padding: 20, paddingTop: 40 },
  title:        { fontSize: 32, fontWeight: '700', color: '#000', letterSpacing: 2 },
  tagline:      { fontSize: 14, color: '#888', marginBottom: 10 },
  status:       { fontSize: 18, color: '#666', marginTop: 5, marginBottom: 15 },
  speechBox:    { height: 60, justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 10 },
  speechText:   { fontSize: 18, color: '#333', textAlign: 'center', fontStyle: 'italic' },
  cartBox:      { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 20, elevation: 3, maxHeight: 200 },
  cartTitle:    { fontSize: 18, fontWeight: '600', color: '#000', marginBottom: 8 },
  cartScroll:   { maxHeight: 140 },
  cartEmpty:    { fontSize: 14, color: '#aaa', fontStyle: 'italic' },
  cartItem:     { fontSize: 16, color: '#333', paddingVertical: 4 },
  button:       { backgroundColor: '#007AFF', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 35, elevation: 4 },
  buttonRed:    { backgroundColor: '#FF3B30' },
  buttonOrange: { backgroundColor: '#FF9500' },
  buttonText:   { color: '#FFF', fontSize: 18, fontWeight: '600' },
});

export default App;