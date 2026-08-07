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
  const pattern = [660, 880, 660, 880, 1100, 880];
  const cycles = 3;
  let timeOffset = 0;

  for (let i = 0; i < cycles; i++) {
    pattern.forEach((frequency) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const toneStart = startAt + timeOffset;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, toneStart);
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(0.4, toneStart + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.29);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneStart + 0.3);
      timeOffset += 0.3;
    });
  }
  navigator.vibrate?.([300, 100, 300, 100, 300]);
  return true;
}

export function announceAvailableOrder(detail = {}) {
  window.dispatchEvent(new CustomEvent('distrito:new-order-alert', { detail }));
}
