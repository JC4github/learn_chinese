// Recording identity includes the written pronunciation, not just the characters.
export function pronunciationKey(text, pinyin = "") {
  return `${String(text).trim()}|${String(pinyin).normalize("NFC").toLowerCase().replace(/\s+/g, "")}`;
}

// Only an explicitly marked, isolated syllable can select a numbered-tone file.
// In particular, neutral ma must never silently select ma1.
export function numberedSyllable(pinyin) {
  const input = String(pinyin).trim().toLowerCase().normalize("NFD");
  let tone = "", plain = "";
  const marks = {"\u0304":"1", "\u0301":"2", "\u030c":"3", "\u0300":"4"};
  for (const character of input) {
    if (marks[character]) {
      if (tone) return null;
      tone = marks[character];
    } else if (character === "\u0308") {
      if (!plain.endsWith("u")) return null;
      plain = plain.slice(0, -1) + "v";
    } else plain += character;
  }
  return tone && /^[a-zv]+$/.test(plain) ? plain + tone : null;
}
