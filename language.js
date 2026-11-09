const languageKey = 'songs-of-syx-browser-language-v1';
const languageOptions = [
  ['default', 'Как в настройках игры'], ['en', 'English'], ['ru', 'Русский'],
  ['uk', 'Українська'], ['de', 'Deutsch'], ['fr', 'Français'], ['es-ES', 'Español'],
  ['it', 'Italiano'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['cs', 'Čeština'],
  ['hu', 'Magyar'], ['tr', 'Türkçe'], ['pt-BR', 'Português (Brasil)'],
  ['ko', '한국어'], ['ja', '日本語'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文']
];
function readBrowserLanguage() {
  try {
    const choice = localStorage.getItem(languageKey);
    return languageOptions.some(([code]) => code === choice) ? choice : 'default';
  } catch { return 'default'; }
}
function browserLanguageProperties() {
  const choice = readBrowserLanguage();
  return choice === 'default' ? [] : ['syx.browser.language=' + (choice === 'en' ? '' : choice)];
}
