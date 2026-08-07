export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-CO';
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  // Try to find a female Spanish voice
  const voices = speechSynthesis.getVoices();
  const femaleVoice = voices.find(v => v.lang.startsWith('es') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('mujer') || v.name.toLowerCase().includes('paulina') || v.name.toLowerCase().includes('helena') || v.name.toLowerCase().includes('sabina'))) 
    || voices.find(v => v.lang.startsWith('es'));
  if (femaleVoice) utterance.voice = femaleVoice;
  speechSynthesis.speak(utterance);
}
