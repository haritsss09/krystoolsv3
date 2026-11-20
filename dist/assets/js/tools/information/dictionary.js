import { h, field, input, textarea, select, button, panel, status } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { dictionary, translate, LANGUAGES, utf8Length } from '../../api/utilities.js';

function safeLink(value) {
  if (typeof value !== 'string' || !/^(https?:\/\/|\/\/)/i.test(value)) return null;
  try {
    const url = new URL(value, 'https://dictionaryapi.dev/');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
const strings = (value) => Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v) : [];

export function dictionaryTool(workspace) {
  const word = input({ required: true, maxlength: '100', placeholder: 'serendipity' });
  const view = apiView({
    idle: status('info', 'Enter an English word to look up definitions and pronunciation.'),
    loadingText: 'Looking up word',
    load: (force) => dictionary(word.value, { force }),
    isEmpty: (entries) => !entries.length || entries.every((e) => !e.meanings.some((m) => m.definitions.length))
      ? 'No definitions were found. Check the spelling or try another word.' : false,
    render: (entries) => entries.map((entry) => {
      const phonetics = Array.isArray(entry.phonetics) ? entry.phonetics.filter((p) => p && typeof p === 'object') : [];
      const pronunciation = [...new Set([entry.phonetic, ...phonetics.map((p) => p.text)].filter((p) => typeof p === 'string' && p))];
      const audioLinks = [...new Set(phonetics.map((p) => safeLink(p.audio)).filter(Boolean))];
      return h('article', { class: 'stack', style: 'overflow-wrap:anywhere' },
        h('h2', { text: entry.word }),
        pronunciation.length ? h('p', { class: 'mono', text: pronunciation.join(' · ') }) : null,
        audioLinks.length ? h('div', { class: 'row' }, audioLinks.map((href, i) => h('a', { href, target: '_blank', rel: 'noopener noreferrer', text: `Listen to pronunciation ${i + 1}` }))) : null,
        ...entry.meanings.map((meaning) => {
          const synonyms = [...new Set([...strings(meaning.synonyms), ...meaning.definitions.flatMap((d) => strings(d.synonyms))])];
          return h('section', { class: 'prose' }, h('h3', { text: meaning.partOfSpeech }),
            h('ol', null, meaning.definitions.map((definition) => h('li', null,
              h('p', { text: definition.definition }),
              typeof definition.example === 'string' && definition.example ? h('p', { class: 'field__hint', text: `Example: ${definition.example}` }) : null))),
            synonyms.length ? h('p', { text: `Synonyms: ${synonyms.join(', ')}` }) : null);
        }),
        safeLink(entry.license?.url) ? h('a', { href: safeLink(entry.license.url), target: '_blank', rel: 'noopener noreferrer', class: 'field__hint', text: `Entry license: ${entry.license.name || 'View license'}` }) : null,
        ...strings(entry.sourceUrls).map(safeLink).filter(Boolean).map((href) => h('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'field__hint', text: 'View original dictionary entry' })));
    }),
  });
  const form = h('form', { class: 'stack' }, field({ label: 'English word', control: word }),
    h('div', null, button('Look up word', { type: 'submit', variant: 'primary' })));
  const submit = (event) => { event.preventDefault(); view.run(); };
  form.addEventListener('submit', submit);
  const root = h('div', { class: 'stack' }, panel('Dictionary lookup', form), panel('Definitions', view.el));
  workspace.append(root);
  return () => { form.removeEventListener('submit', submit); view.destroy(); root.remove(); };
}

export function translateTool(workspace) {
  const from = select(LANGUAGES, { value: 'en' });
  const to = select(LANGUAGES, { value: 'id' });
  const text = textarea({ class: 'textarea textarea--prose', required: true, autocomplete: 'off', rows: '5' });
  const count = h('span', { class: 'field__meta', text: '0 / 500 UTF-8 bytes', 'aria-live': 'polite' });
  const view = apiView({
    idle: status('info', 'Your text is sent to MyMemory only when you translate. KrysTools does not save submitted text. Avoid sending confidential information.'),
    loadingText: 'Translating with MyMemory',
    load: (force) => translate(text.value, from.value, to.value, { force }),
    isEmpty: (data) => !data.text.trim() && 'MyMemory returned no translation. Try a shorter or different phrase.',
    render: (data) => [
      h('p', { class: 'field__hint', text: `${LANGUAGES.find(([code]) => code === data.from)?.[1]} to ${LANGUAGES.find(([code]) => code === data.to)?.[1]}` }),
      h('div', { class: 'output output--sm output--prose', style: 'white-space:pre-wrap', dir: 'auto', text: data.text }),
      h('p', { class: 'field__hint', text: 'MyMemory combines translation-memory matches and machine translation. Review important translations; daily usage quotas apply.' }),
    ],
  });
  const form = h('form', { class: 'stack', autocomplete: 'off' },
    h('div', { class: 'grid grid--2' }, field({ label: 'Source language', control: from }), field({ label: 'Target language', control: to })),
    field({ label: 'Text to translate', control: text, meta: count, hint: 'Maximum 500 UTF-8 bytes. Non-ASCII characters can use more than one byte.' }),
    h('div', null, button('Translate text', { type: 'submit', variant: 'primary' })));
  const updateCount = () => {
    const bytes = utf8Length(text.value);
    count.textContent = `${bytes} / 500 UTF-8 bytes`;
    text.setAttribute('aria-invalid', String(bytes > 500));
  };
  const submit = (event) => { event.preventDefault(); view.run(); };
  text.addEventListener('input', updateCount);
  form.addEventListener('submit', submit);
  const root = h('div', { class: 'stack' }, panel('Translation', form), panel('Translated text', view.el));
  workspace.append(root);
  return () => { form.removeEventListener('submit', submit); text.removeEventListener('input', updateCount); view.destroy(); text.value = ''; view.el.replaceChildren(); root.remove(); };
}
