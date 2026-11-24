export const languages = [
  ['Default', ''],
  ['English', 'en', 'eng'],
  ['French', 'fr', 'fra', 'fre'],
  ['Spanish', 'es', 'spa'],
  ['German', 'de', 'deu', 'ger'],
  ['Italian', 'it', 'ita'],
  ['Portuguese', 'pt', 'por'],
  ['Persian', 'fa', 'fas', 'per'],
  ['Arabic', 'ar', 'ara'],
  ['Hindi', 'hi', 'hin'],
  ['Japanese', 'ja', 'jpn'],
  ['Korean', 'ko', 'kor'],
];
export function languageCode(code?: string) {
  const normalized = (code || '').trim().toLowerCase().split(/[-_]/)[0];
  return (
    languages.find((row) => row.slice(1).includes(normalized))?.[1] ??
    normalized
  );
}
export function languageName(code?: string) {
  return (
    languages.find((row) => row[1] === languageCode(code))?.[0] ||
    code ||
    'Unknown'
  );
}
