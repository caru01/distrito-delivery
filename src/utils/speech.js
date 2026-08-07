export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-CO';
  utterance.rate = 0.9;
  utterance.pitch = 1.1;

  const selectVoice = () => {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return false;
    const femaleVoice = voices.find(v =>
      v.lang.startsWith('es') && (
        /female|mujer|paulina|helena|sabina|carmen|rosa|luna/i.test(v.name)
      )
    ) || voices.find(v => v.lang.startsWith('es'));
    if (femaleVoice) utterance.voice = femaleVoice;
    return true;
  };

  if (!selectVoice()) {
    const onVoicesChanged = () => {
      if (selectVoice()) {
        speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        speechSynthesis.speak(utterance);
      }
    };
    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    setTimeout(() => {
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      selectVoice();
      speechSynthesis.speak(utterance);
    }, 500);
    return;
  }

  speechSynthesis.speak(utterance);
}
