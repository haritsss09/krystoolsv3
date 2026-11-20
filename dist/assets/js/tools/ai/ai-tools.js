import { h, textarea, input, select, field, button, copyButton, download, status } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { generate } from '../../api/ai.js';
import { isConfigured } from '../../api/backend.js';

const OPTIONS = {
  'ai-summarize': ['Concise paragraph', 'Key bullet points', 'Detailed summary'],
  'ai-rewrite': ['Professional tone', 'Plain language', 'Friendly tone', 'Shorter text'],
  'ai-translate': ['English', 'Indonesian', 'Spanish', 'French', 'German', 'Japanese', 'Korean', 'Mandarin Chinese', 'Arabic'],
  'ai-grammar': ['English', 'Indonesian', 'Preserve the original language'],
  'ai-explain': ['Beginner explanation', 'Technical explanation', 'Identify edge cases'],
  'ai-code': ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'SQL', 'HTML and CSS'],
  'ai-regex': ['JavaScript RegExp, with test cases'],
  'ai-json': ['Repair invalid JSON', 'Convert input to JSON', 'Draft JSON Schema'],
  'ai-prompt': ['General assistant', 'Writing task', 'Coding task', 'Research task'],
  'ai-docs': ['README section', 'Function docstring', 'API documentation'],
};

export function aiTool(root, ctx) {
  const source = textarea({ maxlength: 24000, rows: 14, placeholder: 'Paste text, code or a task description. Do not include secrets or personal data.' });
  const mode = select(OPTIONS[ctx.tool.id]);
  const instructions = input({ maxlength: 300, placeholder: 'Optional constraints or audience' });
  const message = h('div');
  let submitted = null;
  let disposed = false;
  const submit = button('Generate', { type: 'submit', variant: 'primary' });
  const result = apiView({
    idle: status('info', 'No request sent. Review your input before sending it to the configured provider.'),
    loadingText: 'Waiting for the AI provider',
    load: async () => {
      if (!submitted) throw new Error('Enter input and select Generate.');
      submit.disabled = true;
      try { return await generate(submitted); }
      finally { if (!disposed) submit.disabled = false; }
    },
    isEmpty: data => !data.text.trim() && 'The provider returned an empty response.',
    render: data => [
      data.truncated ? status('info', 'The provider reached its output limit. The response below may be incomplete.') : null,
      status('info', 'AI output is unverified. Review facts, code and assumptions before use.'),
      h('pre', { class: 'output', text: data.text }),
      h('div', { class: 'toolbar' }, copyButton(data.text, 'Copy response'), button('Download response', { onclick: () => download(data.text, 'ai-response.txt') })),
    ],
  });
  const form = h('form', { class: 'stack', onsubmit: event => {
    event.preventDefault();
    if (!source.value.trim()) { message.replaceChildren(status('err', 'Enter text, code or a task description.')); source.focus(); return; }
    if (!isConfigured()) { message.replaceChildren(status('err', 'Server functions are not configured. Open Settings to connect your backend.')); return; }
    message.replaceChildren();
    submitted = { task: ctx.tool.id, text: source.value, direction: `${mode.value}${instructions.value ? '. ' + instructions.value : ''}` };
    result.run();
  } }, field({ label: 'Input', control: source, hint: 'Up to 24,000 characters. Input and output are not saved to browser storage.' }),
  h('div', { class: 'panes' }, field({ label: 'Output preference', control: mode }), field({ label: 'Additional instructions', control: instructions })),
  h('div', { class: 'toolbar' }, submit, h('a', { href: '#/settings', text: 'Backend settings' })), message);
  root.append(status('info', 'This tool sends your input to your configured AI provider through the server. Provider charges and data policies apply. Refresh and Retry send another request.'), form, result.el);
  return () => { disposed = true; submitted = null; result.destroy(); };
}
