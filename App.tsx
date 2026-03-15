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

const GROQ_API_KEY = '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';

const { SpeechModule } = NativeModules;
const speechEmitter = SpeechModule
  ? new NativeEventEmitter(SpeechModule)
  : null;

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

async function askClaire(
  userMessage: string,
  cartItems: string[],
): Promise<string> {

  const cartContext = cartItems.length > 0
    ? `User's cart: ${cartItems.join(', ')}.`
    : 'Cart is empty.';

  const systemPrompt = `You are Claire, a warm AI shopping assistant for visually impaired users.
${cartContext}

Rules:
- Keep responses to 1 sentence MAX, they will be spoken aloud.
- Be warm, clear and friendly.
- To add an item to cart, respond with ONLY: CART_ADD:[item name]
- To remove an item from cart, respond with ONLY: CART_REMOVE:[item name]
- Never add any other text before or after CART_ADD or CART_REMOVE commands.
- If unsure what item the user wants, ask ONE short clarifying question.
- Always confirm cart actions clearly.
- Never use markdown, bullet points or special characters.
- Speak as if the listener cannot see anything.`;

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    },
  );

  const data = await response.json();
  console.log('Groq response:', JSON.stringify(data));

  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || "I'm sorry, I didn't catch that. Please try again.";
}

function App() {

  const [isListening, setIsListening]       = useState(false);
  const [isThinking, setIsThinking]         = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [cart, setCart]                     = useState<string[]>([]);

  const cartRef = useRef<string[]>([]);
  cartRef.current = cart;

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

    const resultSub = speechEmitter.addListener(
      'onSpeechResult',
      (text: string) => {
        setRecognizedText(text);
        setIsListening(false);
        handleVoiceCommand(text);
      },
    );

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

  const detectObject = () => Tts.speak('Scanning. Please hold your camera steady.');
  const readLabel = () => Tts.speak('Reading label. Please point your camera at the product.');
  const navigateTo = (destination: string) => Tts.speak(`Navigating to ${destination}. Please follow the audio cues.`);

  const handleVoiceCommand = async (text: string) => {
    const lower = text.toLowerCase();

    if (lower.includes('what is this') || lower.includes('identify') ||
        lower.includes('detect') || lower.includes('scan') ||
        lower.includes('what am i holding')) {
      detectObject(); return;
    }

    if (lower.includes('read the label') || lower.includes('read label') ||
        lower.includes('ingredients') || lower.includes('expiry') ||
        lower.includes('expiration')) {
      readLabel(); return;
    }

    if (lower.includes('take me') || lower.includes('navigate') ||
        lower.includes('where is') || lower.includes('go to')) {
      const match = lower.match(/(?:take me to|navigate to|where is|go to)\s+(.+)/);
      navigateTo(match?.[1]?.trim() ?? 'your destination');
      return;
    }

    if (lower.includes('clear cart') || lower.includes('empty cart')) {
      setCart([]);
      Tts.speak('Your cart has been cleared.');
      return;
    }

    if ((lower.includes('what') && lower.includes('cart')) ||
        lower.includes('my cart') || lower.includes('whats in') ||
        lower.includes('show cart') || lower.includes('list cart')) {
      const current = cartRef.current;
      Tts.speak(
        current.length === 0
          ? 'Your cart is empty.'
          : `You have ${current.length} item${current.length !== 1 ? 's' : ''}: ${current.join(', ')}`,
      );
      return;
    }

    if (lower.includes('how many') || lower.includes('count')) {
      const count = cartRef.current.length;
      Tts.speak(`You have ${count} item${count !== 1 ? 's' : ''} in your cart.`);
      return;
    }

    setIsThinking(true);
    Tts.speak('Let me think...');

    try {
      const reply = await askClaire(text, cartRef.current);
      if (reply.startsWith('CART_ADD:')) {
        const rawItem = reply.replace('CART_ADD:', '').split('\n')[0].trim();
        addToCart(rawItem.split(',')[0].trim());
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

  return (
    <SafeAreaView style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.title}>CLAIRVOYANCE</Text>
        <Text style={styles.tagline}>Your AI Shopping Assistant</Text>
        <Text style={styles.status}>
          {isThinking  ? 'Claire is thinking...' :
           isListening ? 'Claire is listening...' :
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
          style={[styles.button, isListening && styles.buttonRed, isThinking && styles.buttonOrange]}
          onPress={toggleListening}
          disabled={isThinking}
        >
          <Text style={styles.buttonText}>
            {isThinking  ? 'Claire is thinking...' :
             isListening ? 'Stop Listening' :
             'Talk to Claire'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

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