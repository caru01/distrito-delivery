export const NOTIFICATION_LANGUAGES = [
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
];

export const NOTIFICATION_VOICES = [
  { value: 'female-clear', label: 'Femenina clara' },
  { value: 'female-energetic', label: 'Femenina enérgica' },
  { value: 'female-calm', label: 'Femenina tranquila' },
  { value: 'male', label: 'Masculina' },
  { value: 'system', label: 'Predeterminada del dispositivo' },
];

const PHRASES = {
  'es': { new_order: 'Nuevo pedido', order_accepted: 'Pedido aceptado', order_delivered: 'Pedido entregado' },
  'en': { new_order: 'New order', order_accepted: 'Order accepted', order_delivered: 'Order delivered' },
  'pt': { new_order: 'Novo pedido', order_accepted: 'Pedido aceito', order_delivered: 'Pedido entregue' },
};

let audioContext = null;

function preferences(settings = {}) {
  return {
    language: settings.notification_language || 'es-CO',
    voice: settings.notification_voice || 'female-clear',
  };
}

function voiceNameMatches(voice, style) {
  const name = String(voice?.name || '');
  if (style === 'male') return /male|hombre|jorge|diego|carlos|pablo|andrés|andres/i.test(name);
  return /female|mujer|paulina|helena|sabina|carmen|rosa|luna|monica|mónica|luciana/i.test(name);
}

function selectVoice(voices, language, style) {
  const languagePrefix = language.split('-')[0].toLowerCase();
  const localized = voices.filter((voice) => String(voice.lang || '').toLowerCase().startsWith(languagePrefix));
  if (style === 'system') return localized[0] || voices[0] || null;
  return localized.find((voice) => voiceNameMatches(voice, style)) || localized[0] || voices[0] || null;
}

export function speakNotification(key, settings = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const { language, voice: style } = preferences(settings);
  const phraseSet = PHRASES[language.split('-')[0]] || PHRASES.es;
  const text = phraseSet[key] || String(key || '');
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = style === 'female-energetic' ? 1.06 : style === 'female-calm' ? 0.82 : 0.92;
  utterance.pitch = style === 'male' ? 0.82 : style === 'female-energetic' ? 1.22 : style === 'female-calm' ? 1.02 : 1.12;
  let spoken = false;
  const speak = () => {
    if (spoken) return;
    spoken = true;
    const voice = selectVoice(window.speechSynthesis.getVoices(), language, style);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
  if (window.speechSynthesis.getVoices().length) speak();
  else {
    window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
    window.setTimeout(speak, 500);
  }
  return true;
}

function getAudioContext() {
  if (audioContext) return audioContext;
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
}

export async function unlockNotificationAudio() {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === 'suspended') await context.resume();
  return context.state === 'running';
}

export function notificationAudioReady() {
  return Boolean(audioContext && audioContext.state === 'running');
}

export function playAttentionAlert({ cycles = 5 } = {}) {
  const context = getAudioContext();
  if (!context || context.state !== 'running') return false;
  const startAt = context.currentTime;
  const pattern = [740, 988, 740, 1175];
  let offset = 0;
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    pattern.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const toneStart = startAt + offset;
      oscillator.type = index % 2 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, toneStart);
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(0.32, toneStart + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneStart + 0.23);
      offset += 0.24;
    });
    offset += 0.16;
  }
  navigator.vibrate?.([350, 120, 350, 120, 500]);
  return true;
}
