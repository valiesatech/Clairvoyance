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

const { SpeechModule } = NativeModules;
const speechEmitter = SpeechModule ? new NativeEventEmitter(SpeechModule) : null;

async function requestAudioPermission() {
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

function App() {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');

  useEffect(() => {
    if (!speechEmitter) return;

    const resultSub = speechEmitter.addListener('onSpeechResult', (text: string) => {
      setRecognizedText(text);
      setIsListening(false);
    });

    const errorSub = speechEmitter.addListener('onSpeechError', (error: string) => {
      console.warn('Speech error:', error);
      setIsListening(false);
      setRecognizedText('');
    });

    return () => {
      resultSub.remove();
      errorSub.remove();
    };
  }, []);

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

  return (
    <SafeAreaView style={styles.backgroundStyle}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.title}>CLAIRVOYANCE</Text>
        <Text style={styles.subtitle}>
          {isListening ? 'Claire is listening...' : 'Claire is ready.'}
        </Text>
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{recognizedText}</Text>
        </View>
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

const styles = StyleSheet.create({
  backgroundStyle: { flex: 1, backgroundColor: '#F3F3F3' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: '700', color: '#000', letterSpacing: 2 },
  subtitle: { fontSize: 18, color: '#666', marginTop: 10, marginBottom: 40 },
  resultContainer: { height: 150, justifyContent: 'center', alignItems: 'center', width: '100%' },
  resultText: { fontSize: 22, color: '#333', textAlign: 'center', fontStyle: 'italic' },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 35, elevation: 4 },
  buttonListening: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
});

export default App;