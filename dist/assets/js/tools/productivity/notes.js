import { h, input, textarea, field, button, panel, status, download } from '../../core/dom.js';

export function validateNotes(value) {
  if (!Array.isArray(value) || value.length > 200) throw new Error('Notes must be an array containing at most 200 notes.');
  const ids = new Set();
  let size = 0;
  for (const note of value) {
    if (!note || typeof note.id !== 'string' || !note.id || note.id.length > 100 || ids.has(note.id)
      || typeof note.title !== 'string' || note.title.length > 120
      || typeof note.body !== 'string' || note.body.length > 100000
      || !Number.isFinite(note.updatedAt) || Math.abs(note.updatedAt) > 8640000000000000) {
      throw new Error('Stored notes have an invalid format. Export a recovery copy before making changes.');
    }
    ids.add(note.id);
    size += note.title.length + note.body.length;
  }
  if (size > 2000000) throw new Error('Notes exceed the 2,000,000-character total limit. Export and shorten your notes.');
  return value;
}

export function notesTool(root, ctx) {
  let notes;
  const stored = ctx.store.get('notes', []);
  try { notes = validateNotes(stored).map(note => ({ ...note })); }
  catch (error) {
    root.append(status('err', error.message), button('Export recovery JSON', {
      onclick: () => download(JSON.stringify(stored, null, 2), 'krystools-notes-recovery.json', 'application/json'),
    }));
    return;
  }
  let selected = notes[0]?.id || null;
  let dirty = false;
  const list = h('ul', { class: 'notes__list', 'aria-label': 'Saved notes' });
  const title = input({ maxlength: 120, placeholder: 'Untitled note' });
  const body = textarea({ class: 'textarea textarea--prose', rows: 18, maxlength: 100000, spellcheck: 'true', placeholder: 'Write a note. Markdown syntax is kept as plain text.' });
  const feedback = h('div', { 'aria-live': 'polite' });
  const empty = h('p', { class: 'empty', text: 'No notes yet. Create a note to start writing.' });
  const save = button('Save now', { variant: 'primary', onclick: persist });
  const remove = button('Delete note', { onclick: () => {
    if (!selected || !window.confirm('Delete this note? This cannot be undone.')) return;
    const next = notes.filter(note => note.id !== selected);
    if (!write(next)) return;
    notes = next;
    selected = notes[0]?.id || null;
    dirty = false;
    render();
  } });
  function write(next) {
    try {
      validateNotes(next);
      if (ctx.store.set('notes', next) === false) throw new Error('Could not save to browser storage. Keep this page open and export JSON to protect your notes.');
      feedback.replaceChildren(status('ok', 'Saved in this browser.'));
      return true;
    } catch (error) {
      feedback.replaceChildren(status('err', error.message));
      return false;
    }
  }
  function persist() {
    const current = notes.find(note => note.id === selected);
    if (!current) return true;
    const next = notes.map(note => note.id === selected ? { ...note, title: title.value, body: body.value, updatedAt: Date.now() } : note);
    try { validateNotes(next); }
    catch (error) { feedback.replaceChildren(status('err', error.message)); dirty = true; return false; }
    notes = next;
    dirty = !write(notes);
    renderList();
    return !dirty;
  }
  function renderList() {
    list.replaceChildren(...notes.map(note => h('li', null, button(note.title || 'Untitled note', {
      'aria-current': String(note.id === selected),
      style: 'white-space:normal;overflow-wrap:anywhere',
      onclick: () => {
        if (dirty && !persist()) return;
        selected = note.id;
        render();
      },
    }))));
    empty.hidden = notes.length > 0;
  }
  function render() {
    const current = notes.find(note => note.id === selected);
    title.value = current?.title || '';
    body.value = current?.body || '';
    for (const control of [title, body, save, remove]) control.disabled = !current;
    renderList();
  }
  for (const control of [title, body]) control.addEventListener('input', () => { dirty = true; persist(); });
  root.append(h('div', { class: 'toolbar' },
    button('New note', { variant: 'primary', onclick: () => {
      if (dirty && !persist()) return;
      if (notes.length >= 200) { feedback.replaceChildren(status('err', 'Maximum 200 notes. Delete or export existing notes first.')); return; }
      const note = { id: globalThis.crypto.randomUUID(), title: '', body: '', updatedAt: Date.now() };
      const next = [note, ...notes];
      if (!write(next)) return;
      notes = next;
      selected = note.id;
      render();
      title.focus();
    } }),
    button('Export all notes (JSON)', { onclick: () => {
      const snapshot = notes.map(note => note.id === selected ? { ...note, title: title.value, body: body.value } : note);
      download(JSON.stringify(snapshot, null, 2), 'krystools-notes.json', 'application/json');
    } })), feedback,
  h('div', { class: 'notes' }, h('div', null, empty, list), panel('Markdown note',
    h('div', { class: 'workspace' }, field({ label: 'Title', control: title }), field({ label: 'Note', control: body, hint: 'Autosaved as you type. Up to 100,000 characters per note. Markdown is stored as text, not rendered.' }),
      h('div', { class: 'toolbar' }, save, remove)))),
  h('p', { class: 'field__hint', text: 'Local only. Clearing site data deletes notes. Export a backup regularly; avoid editing in multiple tabs at once.' }));
  const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  render();
  return () => window.removeEventListener('beforeunload', beforeUnload);
}
