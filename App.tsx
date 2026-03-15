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
  Animated,
  Dimensions,
} from 'react-native';
import Tts from 'react-native-tts';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const GROQ_API_KEY = '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';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────
// NATIVE SPEECH BRIDGE (Kotlin → JS)
// ─────────────────────────────────────────────
const { SpeechModule } = NativeModules;
const speechEmitter = SpeechModule
  ? new NativeEventEmitter(SpeechModule)
  : null;

// ─────────────────────────────────────────────
// ┌─────────────────────────────────────────┐
// │  MEMBER 1 — NAVIGATION                  │
// │  Import your navigation module here     │
// │  e.g. import Navigation from './Member1/NavigationModule'; │
// └─────────────────────────────────────────┘

// ─────────────────────────────────────────────
// ┌─────────────────────────────────────────┐
// │  MEMBER 2 — OBJECT DETECTION            │
// │  Import your detection module here      │
// │  e.g. import ObjectDetector from './Member2/DetectionModule'; │
// └─────────────────────────────────────────┘

// ─────────────────────────────────────────────
// ┌─────────────────────────────────────────┐
// │  MEMBER 3 — LABEL / TEXT READER         │
// │  Import your label reader module here   │
// │  e.g. import LabelReader from './Member3/LabelReaderModule'; │
// └─────────────────────────────────────────┘

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
  const [isScanning,     setIsScanning]     = useState(false);
  const [cartExpanded,   setCartExpanded]   = useState(false);

  // Refs
  const cartRef      = useRef<string[]>([]);
  const pendingRef   = useRef<string | null>(null);
  cartRef.current    = cart;
  pendingRef.current = pendingItem;

  // Animations
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const borderAnim   = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const cornerAnim   = useRef(new Animated.Value(0)).current;
  const cartAnim     = useRef(new Animated.Value(0)).current;

  // --- Scanning animation ---
  useEffect(() => {
    if (isScanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(cornerAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(cornerAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scanLineAnim.stopAnimation();
      cornerAnim.stopAnimation();
      Animated.timing(scanLineAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(cornerAnim,   { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isScanning]);

  // --- Button pulse when listening ---
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(borderAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(borderAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      borderAnim.stopAnimation();
      Animated.timing(pulseAnim,  { toValue: 1, duration: 200, useNativeDriver: true  }).start();
      Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  }, [isListening]);

  // --- Cart expand animation ---
  useEffect(() => {
    Animated.spring(cartAnim, {
      toValue: cartExpanded ? 1 : 0,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start();
  }, [cartExpanded]);

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
    setCartExpanded(true);
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
  // ─────────────────────────────────────────────

  // ┌─────────────────────────────────────────────────────────┐
  // │  MEMBER 2 — OBJECT DETECTION                            │
  // │  Replace stub below with your detection call.           │
  // │  When you have a result, call:                          │
  // │    setPendingItem(detectedItemName)                     │
  // │    setIsScanning(false)                                 │
  // │    Tts.speak(`I found ${result}. Add to cart?`)         │
  // └─────────────────────────────────────────────────────────┘
  const detectObject = () => {
    setIsScanning(true);
    Tts.speak('Scanning. Please hold your camera steady.');
    // TODO — Member 2: replace with real detection logic
    // Example:
    // const result = await ObjectDetector.detect();
    // setIsScanning(false);
    // if (result) {
    //   setPendingItem(result);
    //   pendingRef.current = result;
    //   Tts.speak(`I found ${result}. Would you like to add this to your cart? Say yes or no.`);
    // }
    setTimeout(() => setIsScanning(false), 3000);
  };

  // ┌─────────────────────────────────────────────────────────┐
  // │  MEMBER 3 — LABEL / TEXT READER                         │
  // │  Call readLabel('Product Name, $price') from your       │
  // │  module when a label is scanned. Claire handles         │
  // │  the confirmation flow automatically.                   │
  // └─────────────────────────────────────────────────────────┘
  const readLabel = (productName?: string) => {
    if (productName) {
      setIsScanning(false);
      setPendingItem(productName);
      pendingRef.current = productName;
      Tts.speak(`I found ${productName}. Would you like to add this to your cart? Say yes or no.`);
    } else {
      setIsScanning(true);
      Tts.speak('Reading label. Please point your camera at the product.');
      // TODO — Member 3: trigger your label scan here
      // Example:
      // const result = await LabelReader.scan();
      // if (result) readLabel(result);
      setTimeout(() => setIsScanning(false), 3000);
    }
  };

  // ┌─────────────────────────────────────────────────────────┐
  // │  MEMBER 1 — NAVIGATION                                  │
  // │  Replace stub with your spatial navigation logic.       │
  // │  Destination string comes from Claire's voice parser.   │
  // │  Also called when user says "done shopping" to guide    │
  // │  them to the cashier.                                   │
  // └─────────────────────────────────────────────────────────┘
  const navigateTo = (destination: string) => {
    Tts.speak(`Navigating to ${destination}. Please follow the audio cues.`);
    // TODO — Member 1: add your spatial navigation logic here
    // Example:
    // Navigation.guideTo(destination);
  };

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

    // 2. Object detection — routes to Member 2
    if (lower.includes('what is this') || lower.includes('identify') ||
        lower.includes('detect')       || lower.includes('scan')     ||
        lower.includes('what am i holding')) {
      detectObject(); return;
    }

    // 3. Label reading — routes to Member 3
    if (lower.includes('read the label') || lower.includes('read label') ||
        lower.includes('ingredients')    || lower.includes('expiry')     ||
        lower.includes('expiration')) {
      readLabel(); return;
    }

    // 4. Navigation — routes to Member 1
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
        lower.includes('my cart')   || lower.includes('whats in') ||
        lower.includes('show cart') || lower.includes('list cart')) {
      const current = cartRef.current;
      setCartExpanded(true);
      Tts.speak(
        current.length === 0
          ? 'Your cart is empty.'
          : `You have ${current.length} item${current.length !== 1 ? 's' : ''}: ${current.join(', ')}`,
      );
      return;
    }

    // 7. Count items
    if (lower.includes('how many') || lower.includes('count')) {
      const count = cartRef.current.length;
      Tts.speak(`You have ${count} item${count !== 1 ? 's' : ''} in your cart.`);
      return;
    }

    // 8. Done shopping — confirm and direct to cashier
    if (lower.includes('done shopping')    || lower.includes('finished shopping') ||
        lower.includes('checkout')         || lower.includes('check out')         ||
        lower.includes('pay now')          || lower.includes('go to cashier')     ||
        lower.includes('ready to checkout')) {
      const count = cartRef.current.length;
      if (count === 0) {
        Tts.speak("Your cart is empty. Are you sure you're done shopping?");
      } else {
        Tts.speak(
          `Great! You have ${count} item${count !== 1 ? 's' : ''} in your cart. ` +
          `Let me guide you to the cashier. Please follow the audio cues.`
        );
        // ┌─────────────────────────────────────────────────────────┐
        // │  MEMBER 1 — Navigate to cashier on done shopping        │
        // │  e.g. Navigation.guideTo('cashier');                    │
        // └─────────────────────────────────────────────────────────┘
        navigateTo('cashier');
      }
      return;
    }

    // 9. Everything else — Groq AI
    setIsThinking(true);
    Tts.speak('Let me think...');

    try {
      const reply = await askClaire(text, cartRef.current);

      if (reply.startsWith('CART_ADD:')) {
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
  // MIC BUTTON
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
  // DERIVED VALUES
  // ─────────────────────────────────────────────
  const borderColor = borderAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(245,166,35,0.6)', 'rgba(255,107,0,1)'],
  });

  const cornerOpacity = cornerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.6, 1],
  });

  const scanLineY = scanLineAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.55],
  });

  const cartHeight = cartAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 120],
  });

  const statusText =
    isScanning  ? '⬡ Scanning...'                                      :
    isThinking  ? '✦ Claire is thinking...'                             :
    isListening ? '◉ Claire is listening...'                            :
    pendingItem ? `Add "${pendingItem}" to cart? Say yes or no.`        :
                  'Double tap to talk to Claire';

  const buttonColor =
    isListening ? '#FF3B30' :
    isThinking  ? '#FF9500' :
                  '#F5A623';

  const buttonLabel =
    isThinking  ? 'Thinking...'    :
    isListening ? 'Stop Listening' :
                  'Talk to Claire';

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ════════════════════════════════════════
          FULL BLEED CAMERA
          ════════════════════════════════════════ */}
      {/* ┌─────────────────────────────────────────────────────────┐ */}
      {/* │  MEMBER 2 — Replace this View with your Camera component│ */}
      {/* │  e.g. <Camera style={StyleSheet.absoluteFill} ... />    │ */}
      {/* └─────────────────────────────────────────────────────────┘ */}
      <View style={styles.cameraFullBleed}>
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.cameraLabel}>Camera Feed</Text>
          <Text style={styles.cameraSub}>Member 2 · Detection  |  Member 3 · Labels</Text>
        </View>
      </View>

      {/* ════════════════════════════════════════
          SCANNING OVERLAY
          ════════════════════════════════════════ */}
      {isScanning && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
          <Animated.View style={[styles.corner, styles.cornerTL, { opacity: cornerOpacity }]} />
          <Animated.View style={[styles.corner, styles.cornerTR, { opacity: cornerOpacity }]} />
          <Animated.View style={[styles.corner, styles.cornerBL, { opacity: cornerOpacity }]} />
          <Animated.View style={[styles.corner, styles.cornerBR, { opacity: cornerOpacity }]} />
          <View style={styles.scanningBadge}>
            <View style={styles.scanDot} />
            <Text style={styles.scanBadgeText}>SCANNING</Text>
          </View>
        </View>
      )}

      {/* LISTENING badge */}
      {isListening && !isScanning && (
        <View style={styles.listeningBadge} pointerEvents="none">
          <View style={styles.listeningDot} />
          <Text style={styles.listeningBadgeText}>LISTENING</Text>
        </View>
      )}

      {/* ════════════════════════════════════════
          BOTTOM OVERLAY
          ════════════════════════════════════════ */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">

        {/* App name */}
        <View style={styles.topBar}>
          <Text style={styles.appName}>CLAIRVOYANCE</Text>
          <Text style={styles.appTagline}>AI Shopping Assistant</Text>
        </View>

        {/* Status */}
        <Text
          style={[
            styles.statusText,
            isListening && styles.statusListening,
            isScanning  && styles.statusScanning,
            pendingItem && styles.statusPending,
          ]}
          accessibilityLabel={statusText}
          accessibilityLiveRegion="polite"
        >
          {statusText}
        </Text>

        {/* Recognized speech */}
        {recognizedText !== '' && recognizedText !== 'Listening...' && (
          <Text style={styles.recognizedText}>"{recognizedText}"</Text>
        )}

        {/* Cart (collapsible) */}
        <TouchableOpacity
          style={styles.cartHeader}
          onPress={() => setCartExpanded(v => !v)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Shopping cart, ${cart.length} items. Double tap to ${cartExpanded ? 'collapse' : 'expand'}`}
        >
          <Text style={styles.cartIcon}>🛒</Text>
          <Text style={styles.cartTitle}>Shopping Cart</Text>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cart.length}</Text>
          </View>
          <Text style={styles.cartChevron}>{cartExpanded ? '▾' : '▴'}</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.cartBody, { height: cartHeight }]}>
          <ScrollView style={styles.cartScroll} accessibilityLabel={`Cart contains ${cart.length} items`}>
            {cart.length === 0
              ? <Text style={styles.cartEmpty}>Your cart is empty</Text>
              : cart.map((item, i) => (
                  <Text key={i} style={styles.cartItem}>• {item}</Text>
                ))
            }
          </ScrollView>
        </Animated.View>

        {/* Talk to Claire Button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 12 }}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonColor }]}
            onPress={toggleListening}
            disabled={isThinking}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            accessibilityHint="Double tap to start or stop listening"
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Camera
  cameraFullBleed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d0d',
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon:  { fontSize: 52, marginBottom: 10 },
  cameraLabel: { color: '#444', fontSize: 17, fontWeight: '600', letterSpacing: 1 },
  cameraSub:   { color: '#2a2a2a', fontSize: 11, marginTop: 6, letterSpacing: 0.5 },

  // Scan line
  scanLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: '#F5A623',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 10,
  },

  // Corner brackets
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#F5A623',
  },
  cornerTL: { top: 60,                    left: 24,  borderTopWidth: 3,    borderLeftWidth: 3  },
  cornerTR: { top: 60,                    right: 24, borderTopWidth: 3,    borderRightWidth: 3 },
  cornerBL: { bottom: SCREEN_HEIGHT * 0.42, left: 24,  borderBottomWidth: 3, borderLeftWidth: 3  },
  cornerBR: { bottom: SCREEN_HEIGHT * 0.42, right: 24, borderBottomWidth: 3, borderRightWidth: 3 },

  // Scanning badge
  scanningBadge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 7,
  },
  scanDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F5A623' },
  scanBadgeText: { color: '#F5A623', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  // Listening badge
  listeningBadge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 7,
  },
  listeningDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  listeningBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  // Bottom overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.52,
    left: 20,
  },
  appName:    { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  appTagline: { color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: 1, marginTop: 2 },

  // Status
  statusText:      { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 4, letterSpacing: 0.3 },
  statusListening: { color: '#F5A623', fontWeight: '700' },
  statusScanning:  { color: '#F5A623', fontWeight: '700' },
  statusPending:   { color: '#fff',    fontWeight: '600' },

  // Recognized text
  recognizedText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 10,
  },

  // Cart
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  cartIcon:      { fontSize: 16 },
  cartTitle:     { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  cartBadge:     { backgroundColor: '#F5A623', borderRadius: 10, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cartBadgeText: { color: '#000', fontSize: 12, fontWeight: '700' },
  cartChevron:   { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginLeft: 4 },
  cartBody:      { overflow: 'hidden' },
  cartScroll:    { paddingLeft: 4 },
  cartEmpty:     { color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  cartItem:      { color: 'rgba(255,255,255,0.85)', fontSize: 14, paddingVertical: 3 },

  // Button
  button: {
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default App;