import { request, isObj, ApiError } from './api-client.js';

export const DICTIONARY_SOURCE = { name: 'Free Dictionary API', url: 'https://dictionaryapi.dev/' };
export const TRANSLATE_SOURCE = { name: 'MyMemory', url: 'https://mymemory.translated.net/doc/spec.php' };
export const FACT_SOURCE = { name: 'Useless Facts API', url: 'https://uselessfacts.jsph.pl/' };
export const QUOTE_SOURCE = { name: 'DummyJSON', url: 'https://dummyjson.com/docs/quotes' };
export const LANGUAGES = [
  ['en', 'English'], ['id', 'Indonesian'], ['ms', 'Malay'], ['es', 'Spanish'], ['fr', 'French'],
  ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['ar', 'Arabic'],
  ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh-CN', 'Chinese (Simplified)'],
  ['ru', 'Russian'], ['th', 'Thai'], ['vi', 'Vietnamese'], ['tr', 'Turkish'],
];
const text = (v) => typeof v === 'string';
const invalid = (source, message) => ({ ok: false, source, error: new ApiError('input', message) });
export const utf8Length = (value) => new TextEncoder().encode(value).length;

export async function dictionary(word, { force = false } = {}) {
  word = String(word).trim();
  if (!word || word.length > 100 || !/^[a-zA-Z][a-zA-Z '’.-]*$/.test(word)) {
    return invalid(DICTIONARY_SOURCE, 'Enter an English word or phrase (up to 100 characters).');
  }
  const res = await request(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
    force, cacheTtl: 86400000, source: DICTIONARY_SOURCE,
    validate: (d) => Array.isArray(d) && d.every((e) => isObj(e) && text(e.word) && Array.isArray(e.meanings)
      && e.meanings.every((m) => isObj(m) && text(m.partOfSpeech) && Array.isArray(m.definitions)
        && m.definitions.every((v) => isObj(v) && text(v.definition))))
      || 'The dictionary returned an unexpected definition format.',
  });
  if (res.error?.status === 404) return { ok: true, data: [], source: DICTIONARY_SOURCE, fetchedAt: Date.now(), fromCache: false, status: 404 };
  return res;
}

export async function translate(textValue, from, to, { force = false } = {}) {
  if (!text(textValue) || !textValue.trim()) return invalid(TRANSLATE_SOURCE, 'Enter text to translate.');
  if (utf8Length(textValue) > 500) return invalid(TRANSLATE_SOURCE, 'MyMemory accepts at most 500 UTF-8 bytes per request. Shorten the text.');
  if (![from, to].every((code) => LANGUAGES.some(([v]) => v === code)) || from === to) {
    return invalid(TRANSLATE_SOURCE, 'Choose two different languages.');
  }
  const q = new URLSearchParams({ q: textValue, langpair: `${from}|${to}` });
  // Do not cache submitted text or translation results in memory, storage or the browser HTTP cache.
  const res = await request(`https://api.mymemory.translated.net/get?${q}`, {
    force, cacheTtl: 0, persist: false, retries: 0, init: { cache: 'no-store', referrerPolicy: 'no-referrer' }, source: TRANSLATE_SOURCE,
    validate: (d) => {
      if (Number(d?.responseStatus) !== 200 || d?.quotaFinished === true) {
        return text(d?.responseDetails) && d.responseDetails ? d.responseDetails : 'MyMemory could not translate this text. Its daily quota may have been reached.';
      }
      return text(d?.responseData?.translatedText) || 'MyMemory returned an unexpected translation format.';
    },
  });
  if (res.ok) res.data = { text: res.data.responseData.translatedText, from, to };
  return res;
}

export function randomFact({ force = false } = {}) {
  return request('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
    force, cacheTtl: 0, persist: false, init: { cache: 'no-store' }, source: FACT_SOURCE,
    validate: (d) => isObj(d) && text(d.text) || 'The facts service returned an unexpected response.',
  });
}

export function randomQuote({ force = false } = {}) {
  return request('https://dummyjson.com/quotes/random', {
    force, cacheTtl: 0, persist: false, init: { cache: 'no-store' }, source: QUOTE_SOURCE,
    validate: (d) => isObj(d) && text(d.quote) && text(d.author) || 'DummyJSON returned an unexpected quote format.',
  });
}
