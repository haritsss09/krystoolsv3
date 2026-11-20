import { h, field, input, textarea, select, panel, download, formatBytes } from '../../core/dom.js';
import { stack, action, message } from './image.js';

const PAGES = { A4: [595.276, 841.89], Letter: [612, 792], Legal: [612, 1008] };
const FONTS = ['Helvetica', 'Times-Roman', 'Courier'];
const WIN_ANSI = new Map(Array.from('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ', (char, i) => [char, [128,130,131,132,133,134,135,136,137,138,139,140,142,145,146,147,148,149,150,151,152,153,154,155,156,158,159][i]]));
const HELVETICA = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const TIMES = [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541];

export function encodeLatin(text) {
  let replaced = 0, output = '';
  for (const char of text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '    ')) {
    const code = char.codePointAt(0);
    if (char === '\n' || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) output += char;
    else if (WIN_ANSI.has(char)) output += String.fromCharCode(WIN_ANSI.get(char));
    else { output += '?'; replaced++; }
  }
  return { text: output, replaced };
}

export function wrapPdfText(text, maxWidth, font, fontSize) {
  const metrics = font === 'Helvetica' ? HELVETICA : TIMES;
  const width = (char) => {
    const code = char.charCodeAt(0);
    return (font === 'Courier' ? 600 : code >= 32 && code <= 126 ? metrics[code - 32] : 1100) * fontSize / 1000;
  };
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.length) { lines.push(''); continue; }
    let start = 0;
    while (start < paragraph.length) {
      let end = start, used = 0, breakAt = -1;
      while (end < paragraph.length && used + width(paragraph[end]) <= maxWidth) {
        used += width(paragraph[end]);
        if (paragraph[end] === ' ') breakAt = end;
        end++;
      }
      if (end === start) throw new Error('The font is too large for the selected page margins.');
      if (end < paragraph.length && breakAt > start) end = breakAt + 1;
      lines.push(paragraph.slice(start, end)); start = end;
      if (lines.length > 20000) throw new Error('Document exceeds the 20,000-line limit.');
    }
  }
  return lines;
}

export function makePdf(source, options = {}) {
  if (!source.trim()) throw new Error('Enter some text to create a PDF.');
  if (source.length > 500000) throw new Error('Text limit: 500,000 characters.');
  const { pageSize = 'A4', orientation = 'portrait', font = 'Helvetica', fontSize = 12, margin = 48, lineSpacing = 1.4 } = options;
  if (!Object.hasOwn(PAGES, pageSize) || !FONTS.includes(font) || !['portrait', 'landscape'].includes(orientation)) throw new Error('Unsupported page size, orientation or font.');
  if (!Number.isFinite(fontSize) || fontSize < 8 || fontSize > 36) throw new Error('Font size must be from 8 to 36 points.');
  if (!Number.isFinite(margin) || margin < 18 || margin > 108) throw new Error('Margins must be from 18 to 108 points.');
  if (!Number.isFinite(lineSpacing) || lineSpacing < 1 || lineSpacing > 2) throw new Error('Line spacing must be from 1 to 2.');
  const [width, height] = orientation === 'landscape' ? [...PAGES[pageSize]].reverse() : PAGES[pageSize];
  const encoded = encodeLatin(source), leading = fontSize * lineSpacing;
  const lines = wrapPdfText(encoded.text, width - margin * 2, font, fontSize);
  const perPage = Math.floor((height - margin * 2 - fontSize * 1.3) / leading) + 1;
  if (perPage < 1) throw new Error('Not enough room on the page for these settings.');
  const pageCount = Math.ceil(lines.length / perPage);
  if (pageCount > 200) throw new Error(`This would create ${pageCount} pages. Limit: 200 pages. Reduce the text or font size.`);
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '', `<< /Type /Font /Subtype /Type1 /BaseFont /${font} /Encoding /WinAnsiEncoding >>`];
  const pages = [];
  const number = (value) => String(Number(value.toFixed(3)));
  for (let page = 0; page < pageCount; page++) {
    const pageId = objects.length, contentId = pageId + 1; pages.push(`${pageId} 0 R`);
    const pageLines = lines.slice(page * perPage, (page + 1) * perPage);
    const textCommands = pageLines.map((line, i) => {
      const hex = Array.from(line, (char) => char.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      return `${i ? 'T*\n' : ''}<${hex}> Tj`;
    }).join('\n');
    const stream = `BT\n/F1 ${number(fontSize)} Tf\n${number(leading)} TL\n1 0 0 1 ${number(margin)} ${number(height - margin - fontSize)} Tm\n${textCommands}\nET\n`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(width)} ${number(height)}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  }
  objects[2] = `<< /Type /Pages /Kids [${pages.join(' ')}] /Count ${pageCount} >>`;
  // All PDF syntax is ASCII; user text uses WinAnsi bytes in hex strings.
  // String lengths therefore equal byte offsets, including for accented text.
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets.push(pdf.length); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { bytes: new TextEncoder().encode(pdf), pageCount, replaced: encoded.replaced, lines: lines.length };
}

export function textPdfTool(root) {
  const text = textarea({ class: 'textarea textarea--prose', rows: 14, placeholder: 'Type or paste the text to put in your PDF.' });
  const file = input({ type: 'file', accept: '.txt,text/plain' });
  const size = select(Object.keys(PAGES));
  const orientation = select([['portrait', 'Portrait'], ['landscape', 'Landscape']]);
  const font = select([['Helvetica', 'Helvetica (sans serif)'], ['Times-Roman', 'Times Roman (serif)'], ['Courier', 'Courier (monospace)']]);
  const fontSize = input({ type: 'number', min: 8, max: 36, step: 1, value: 12 });
  const margin = input({ type: 'number', min: 18, max: 108, step: 1, value: 48 });
  const spacing = select([['1', 'Single'], ['1.2', '1.2'], ['1.4', '1.4'], ['1.5', '1.5'], ['2', 'Double']], { value: '1.4' });
  const filename = input({ value: 'document.pdf', maxlength: 120 });
  const create = action('Create PDF', { variant: 'primary' }), save = action('Download PDF', { disabled: true });
  const feedback = h('div');
  let result = null, version = 0, alive = true;
  const invalidate = () => { version++; result = null; save.disabled = true; message(feedback, 'info', 'Text or settings changed. Create the PDF to refresh the download.'); };
  for (const control of [text, size, orientation, font, fontSize, margin, spacing]) control.addEventListener('input', invalidate);
  file.addEventListener('change', async () => {
    invalidate(); const id = version, chosen = file.files[0];
    if (!chosen) return;
    message(feedback, 'info', 'Reading UTF-8 text locally…');
    try {
      if (chosen.size > 2 * 1024 * 1024) throw new Error('Text file limit: 2 MB and 500,000 characters.');
      const bytes = await chosen.arrayBuffer();
      const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (value.length > 500000) throw new Error('Text limit: 500,000 characters.');
      if (!alive || id !== version) return;
      text.value = value; filename.value = `${chosen.name.replace(/\.[^.]*$/, '') || 'document'}.pdf`;
      message(feedback, 'ok', 'Text loaded. Choose page settings, then create the PDF.');
    } catch (error) { if (alive && id === version) message(feedback, 'err', error instanceof TypeError ? 'This file is not valid UTF-8 text. Save it as UTF-8 first.' : error.message); }
  });
  create.addEventListener('click', () => {
    invalidate(); message(feedback, 'info', 'Creating PDF locally…');
    try {
      result = makePdf(text.value, { pageSize: size.value, orientation: orientation.value, font: font.value, fontSize: Number(fontSize.value), margin: Number(margin.value), lineSpacing: Number(spacing.value) });
      save.disabled = false;
      message(feedback, 'ok', `${result.pageCount} page${result.pageCount === 1 ? '' : 's'}, ${formatBytes(result.bytes.length)}. ${result.replaced ? `${result.replaced} unsupported characters replaced with "?".` : 'All characters are supported.'}`);
    } catch (error) { message(feedback, 'err', error.message); }
  });
  save.addEventListener('click', () => {
    if (!result) return;
    let name = filename.value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'document.pdf';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    download(result.bytes, name, 'application/pdf');
  });
  message(feedback, 'info', 'Standard Latin fonts (WinAnsi). Other scripts and unsupported characters become "?". Text wraps and paginates automatically. Limit: 500,000 characters and 200 pages; no images or rich text.');
  root.append(h('div', { class: 'panes' }, panel('Plain text', stack(field({ label: 'Import UTF-8 text file', control: file }), field({ label: 'Document text', control: text }))), panel('PDF settings', stack(
    h('div', { class: 'panes' }, field({ label: 'Page size', control: size }), field({ label: 'Orientation', control: orientation })), field({ label: 'Standard font', control: font }),
    h('div', { class: 'panes' }, field({ label: 'Font size (points)', control: fontSize }), field({ label: 'Margins (points)', control: margin })),
    field({ label: 'Line spacing', control: spacing }), field({ label: 'Download filename', control: filename }),
    h('div', { class: 'toolbar' }, create, save), feedback))));
  return () => { alive = false; version++; result = null; };
}
