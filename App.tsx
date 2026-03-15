// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
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
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─────────────────────────────────────────────
// THEME — Blue + Cyan, Light Mode
// ─────────────────────────────────────────────
const C = {
  primary:       '#0066FF',
  primaryLight:  '#4D94FF',
  cyan:          '#00D4FF',
  cyanLight:     '#E0F7FF',
  cyanGlow:      'rgba(0, 212, 255, 0.3)',
  bg:            '#F0F8FF',
  surface:       '#FFFFFF',
  surfaceBorder: 'rgba(0, 102, 255, 0.15)',
  overlay:       'rgba(255, 255, 255, 0.92)',
  textHigh:      '#0A1628',
  textMid:       '#4A6080',
  textLow:       '#8AA0B8',
  red:           '#FF3B30',
  orange:        '#FF9500',
  white:         '#FFFFFF',
};

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
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const cornerAnim   = useRef(new Animated.Value(0)).current;
  const cartAnim     = useRef(new Animated.Value(0)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  const waveAnim     = useRef(new Animated.Value(1)).current;

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

  // --- Button pulse + wave when listening ---
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      waveAnim.stopAnimation();
      glowAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true  }).start();
      Animated.timing(waveAnim,  { toValue: 1, duration: 200, useNativeDriver: true  }).start();
      Animated.timing(glowAnim,  { toValue: 0, duration: 200, useNativeDriver: false }).start();
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
  // └─────────────────────────────────────────────────────────┘
  const detectObject = () => {
    setIsScanning(true);
    Tts.speak('Scanning. Please hold your camera steady.');
    // TODO — Member 2: replace with real detection logic
    setTimeout(() => setIsScanning(false), 3000);
  };

  // ┌─────────────────────────────────────────────────────────┐
  // │  MEMBER 3 — LABEL / TEXT READER                         │
  // │  Call readLabel('Product Name, $price') from your       │
  // │  module when a label is scanned.                        │
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
      setTimeout(() => setIsScanning(false), 3000);
    }
  };

  // ┌─────────────────────────────────────────────────────────┐
  // │  MEMBER 1 — NAVIGATION                                  │
  // │  Replace stub with your spatial navigation logic.       │
  // │  Also called when user says "done shopping".            │
  // └─────────────────────────────────────────────────────────┘
  const navigateTo = (destination: string) => {
    Tts.speak(`Navigating to ${destination}. Please follow the audio cues.`);
    // TODO — Member 1: Navigation.guideTo(destination);
  };

  // ─────────────────────────────────────────────
  // VOICE COMMAND HANDLER
  // ─────────────────────────────────────────────
  const handleVoiceCommand = async (text: string) => {
    const lower = text.toLowerCase();

    // 1. Yes/no confirmation
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

    // 2. Object detection — Member 2
    if (lower.includes('what is this') || lower.includes('identify') ||
        lower.includes('detect')       || lower.includes('scan')     ||
        lower.includes('what am i holding')) {
      detectObject(); return;
    }

    // 3. Label reading — Member 3
    if (lower.includes('read the label') || lower.includes('read label') ||
        lower.includes('ingredients')    || lower.includes('expiry')     ||
        lower.includes('expiration')) {
      readLabel(); return;
    }

    // 4. Navigation — Member 1
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

    // 8. Done shopping — cashier
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
        // │  MEMBER 1 — Navigate to cashier                         │
        // └─────────────────────────────────────────────────────────┘
        navigateTo('cashier');
      }
      return;
    }

    // 9. Groq AI — no filler speech
    setIsThinking(true);
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
  // MIC TOGGLE
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
      setRecognizedText('');
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
  const cornerOpacity = cornerAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.5, 1],
  });

  const scanLineY = scanLineAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.52],
  });

  const cartHeight = cartAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 130],
  });

  const statusText =
    isScanning  ? 'Scanning...'                                  :
    isThinking  ? 'Processing...'                                :
    isListening ? 'Claire is listening...'                       :
    pendingItem ? `Add "${pendingItem}" to cart?`                :
                  'Tap anywhere to talk to Claire';

  const buttonColor =
    isListening ? C.red     :
    isThinking  ? C.orange  :
                  C.primary;

  const buttonLabel =
    isThinking  ? 'Processing...'  :
    isListening ? 'Stop Listening' :
                  'Talk to Claire';

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <TouchableOpacity
      style={styles.root}
      onPress={toggleListening}
      disabled={isThinking}
      activeOpacity={1}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      accessibilityHint="Double tap anywhere to start or stop listening"
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

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
          TOP BAR — floats over camera
          ════════════════════════════════════════ */}
      <View style={styles.topBar} pointerEvents="none">
        <View>
          <Text style={styles.appName}>CLAIRVOYANCE</Text>
          <Text style={styles.appTagline}>AI Shopping Assistant</Text>
        </View>
        {/* Status badge — top right, separate from app name */}
        {(isListening || isScanning) && (
          <View style={[
            styles.badge,
            isListening && styles.badgeListening,
            isScanning  && styles.badgeScanning,
          ]}>
            <View style={[
              styles.badgeDot,
              isListening && styles.badgeDotRed,
              isScanning  && styles.badgeDotCyan,
            ]} />
            <Text style={styles.badgeText}>
              {isScanning ? 'SCANNING' : 'LISTENING'}
            </Text>
          </View>
        )}
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
        </View>
      )}

      {/* ════════════════════════════════════════
          BOTTOM PANEL
          ════════════════════════════════════════ */}
      <View style={styles.bottomPanel} pointerEvents="box-none">

        {/* Status row */}
        <View style={styles.statusRow}>
          {isListening && (
            <Animated.View style={[styles.listeningRing, { transform: [{ scale: waveAnim }] }]} />
          )}
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
        </View>

        {/* Recognized speech */}
        {recognizedText !== '' && (
          <Text style={styles.recognizedText}>"{recognizedText}"</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Cart */}
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
          <ScrollView style={styles.cartScroll}>
            {cart.length === 0
              ? <Text style={styles.cartEmpty}>Your cart is empty</Text>
              : cart.map((item, i) => (
                  <View key={i} style={styles.cartRow}>
                    <View style={styles.cartDot} />
                    <Text style={styles.cartItem}>{item}</Text>
                  </View>
                ))
            }
          </ScrollView>
        </Animated.View>

        {/* Button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 14 }}>
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
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Camera ──
  cameraFullBleed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D6EEFF',
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon:  { fontSize: 52, marginBottom: 10 },
  cameraLabel: { color: '#90B8D8', fontSize: 17, fontWeight: '600', letterSpacing: 1 },
  cameraSub:   { color: '#B8D4E8', fontSize: 11, marginTop: 6, letterSpacing: 0.5 },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 52,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  appName: {
    color: C.textHigh,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  appTagline: {
    color: C.primary,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 2,
    fontWeight: '600',
  },

  // ── Badge (top right) ──
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  badgeListening: {
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
  },
  badgeScanning: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.4)',
  },
  badgeDot:     { width: 7, height: 7, borderRadius: 4 },
  badgeDotRed:  { backgroundColor: C.red },
  badgeDotCyan: { backgroundColor: C.cyan },
  badgeText:    { color: C.textHigh, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  // ── Scan line ──
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: C.cyan,
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 10,
  },

  // ── Corner brackets ──
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: C.cyan,
  },
  cornerTL: { top: 100,                    left: 20,  borderTopWidth: 3,    borderLeftWidth: 3  },
  cornerTR: { top: 100,                    right: 20, borderTopWidth: 3,    borderRightWidth: 3 },
  cornerBL: { bottom: SCREEN_HEIGHT * 0.44, left: 20,  borderBottomWidth: 3, borderLeftWidth: 3  },
  cornerBR: { bottom: SCREEN_HEIGHT * 0.44, right: 20, borderBottomWidth: 3, borderRightWidth: 3 },

  // ── Bottom panel ──
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingBottom: 36,
    paddingTop: 22,
    backgroundColor: C.overlay,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: C.surfaceBorder,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 20,
  },

  // ── Status ──
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    gap: 8,
  },
  listeningRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.red,
    opacity: 0.8,
  },
  statusText:      { color: C.textMid,  fontSize: 14, textAlign: 'center', letterSpacing: 0.2 },
  statusListening: { color: C.red,      fontWeight: '700' },
  statusScanning:  { color: C.cyan,     fontWeight: '700' },
  statusPending:   { color: C.primary,  fontWeight: '700', fontSize: 15 },

  // ── Recognized text ──
  recognizedText: {
    color: C.textLow,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: C.surfaceBorder,
    marginVertical: 10,
  },

  // ── Cart ──
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  cartIcon:  { fontSize: 16 },
  cartTitle: { color: C.textHigh, fontSize: 15, fontWeight: '700', flex: 1 },
  cartBadge: {
    backgroundColor: C.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  cartBadgeText: { color: C.white, fontSize: 12, fontWeight: '800' },
  cartChevron:   { color: C.textLow, fontSize: 14, marginLeft: 2 },
  cartBody:      { overflow: 'hidden' },
  cartScroll:    { paddingLeft: 4, marginTop: 6 },
  cartEmpty:     { color: C.textLow, fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  cartRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  cartDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: C.cyan },
  cartItem:      { color: C.textHigh, fontSize: 14, fontWeight: '500' },

  // ── Button ──
  button: {
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonText: {
    color: C.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

export default App;
