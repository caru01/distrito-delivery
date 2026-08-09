function removeInvalidUtf16(value) {
  let result = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += value[index] + value[index + 1];
        index += 1;
      }
      continue;
    }
    if (code >= 0xDC00 && code <= 0xDFFF) continue;
    result += value[index];
  }
  return result;
}

export function normalizeUnicodeText(value) {
  return removeInvalidUtf16(String(value ?? ''))
    .replace(/\uFFFD/g, '')
    .normalize('NFC');
}
