let audioContext = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
}

export async function unlockDeliveryAlerts() {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === 'suspended') await context.resume();
  return context.state === 'running';
}

export function deliveryAlertsReady() {
  return Boolean(audioContext && audioContext.state === 'running');
}

export function playNewOrderAlert() {
  const context = getAudioContext();
  if (!context || context.state !== 'running') return false;

  const startAt = context.currentTime;
  [880, 1174, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const toneStart = startAt + index * 0.22;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(0.22, toneStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.17);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneStart + 0.18);
  });
  navigator.vibrate?.([180, 80, 180]);
  return true;
}

export function announceAvailableOrder(detail = {}) {
  window.dispatchEvent(new CustomEvent('distrito:new-order-alert', { detail }));
}
