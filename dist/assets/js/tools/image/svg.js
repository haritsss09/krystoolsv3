import { h, field, input, textarea, panel, copyText, download, formatBytes } from '../../core/dom.js';
import { stack, action, message, previewImage } from './image.js';

const LIMIT = 2 * 1024 * 1024;
const SVG_NS = 'http://www.w3.org/2000/svg';
const ELEMENTS = new Set('svg g a defs symbol use path rect circle ellipse line polyline polygon text tspan textPath title desc linearGradient radialGradient stop clipPath mask pattern marker filter feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence'.split(' '));
const PRESENTATION = new Set('fill fill-opacity fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset stroke-opacity opacity color display visibility font-family font-size font-style font-weight font-stretch font-variant text-anchor text-decoration dominant-baseline alignment-baseline baseline-shift letter-spacing word-spacing white-space direction unicode-bidi paint-order vector-effect clip-path clip-rule mask filter stop-color stop-opacity flood-color flood-opacity lighting-color color-interpolation color-interpolation-filters shape-rendering text-rendering'.split(' '));
const ATTRIBUTES = new Set(('id viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry width height d points transform gradientTransform gradientUnits spreadMethod offset fx fy fr patternUnits patternContentUnits patternTransform clipPathUnits maskUnits maskContentUnits markerWidth markerHeight refX refY orient markerUnits marker-start marker-mid marker-end textLength lengthAdjust dx dy rotate startOffset method spacing filterUnits primitiveUnits in in2 result type values operator k1 k2 k3 k4 mode stdDeviation edgeMode kernelMatrix order targetX targetY divisor bias preserveAlpha scale xChannelSelector yChannelSelector surfaceScale diffuseConstant specularConstant specularExponent limitingConeAngle azimuth elevation pointsAtX pointsAtY pointsAtZ z baseFrequency numOctaves seed stitchTiles amplitude exponent intercept slope tableValues radius').split(' '));
const STRUCTURAL = new Set('svg g defs symbol clipPath mask pattern marker linearGradient radialGradient filter'.split(' '));

function safeValue(value) {
  if (/[\\<>@\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) || /\/\*|\*\/|(?:https?|data|javascript|file|blob):|\/\//i.test(value)) return false;
  const withoutURLs = value.replace(/url\(\s*(['"]?)#[A-Za-z_][\w:.-]*\1\s*\)/gi, '');
  return !/url\s*\(|expression\s*\(|var\s*\(|image\s*\(/i.test(withoutURLs);
}

export function optimizeSvg(source) {
  const originalBytes = new TextEncoder().encode(source).length;
  if (!source.trim() || originalBytes > LIMIT) throw new Error('Enter a nonempty SVG up to 2 MB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG document types and entity declarations are not supported. Remove them first.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid SVG XML. Check matching tags, namespaces and quoted attributes.');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== SVG_NS) throw new Error('The document must have an SVG root with xmlns="http://www.w3.org/2000/svg".');
  let removed = 0, visited = 0;
  const walk = (element, preserve = false, depth = 0) => {
    if (++visited > 10000 || depth > 128) throw new Error('SVG exceeds the safety limit of 10,000 elements or 128 nesting levels.');
    const inText = preserve || ['text', 'tspan', 'textPath', 'title', 'desc'].includes(element.localName) || element.getAttribute('xml:space') === 'preserve';
    for (const attr of [...element.attributes]) {
      const name = attr.name, local = attr.localName, value = attr.value;
      if (name === 'xmlns' && element === root && value === SVG_NS) continue;
      if (name === 'xml:space' && ['preserve', 'default'].includes(value)) continue;
      if (local === 'href' && ['use', 'textPath'].includes(element.localName) && /^#[A-Za-z_][\w:.-]*$/.test(value)) {
        element.removeAttributeNode(attr); element.setAttribute('href', value); continue;
      }
      if (name === 'style') {
        const declarations = [];
        for (const part of value.split(';')) {
          const colon = part.indexOf(':');
          if (colon < 0) { if (part.trim()) removed++; continue; }
          const property = part.slice(0, colon).trim().toLowerCase(), val = part.slice(colon + 1).trim();
          if (PRESENTATION.has(property) && val && safeValue(val) && !/!important/i.test(val)) declarations.push(`${property}:${val}`);
          else removed++;
        }
        if (declarations.length) element.setAttribute('style', declarations.join(';'));
        else { element.removeAttributeNode(attr); removed++; }
        continue;
      }
      if (attr.namespaceURI || (!PRESENTATION.has(name) && !ATTRIBUTES.has(name)) || !safeValue(value)) {
        element.removeAttributeNode(attr); removed++;
      }
    }
    for (const child of [...element.childNodes]) {
      if (child.nodeType === 1) {
        if (child.namespaceURI !== SVG_NS || !ELEMENTS.has(child.localName)) { child.remove(); removed++; }
        else walk(child, inText, depth + 1);
      } else if (child.nodeType === 8 || child.nodeType === 7) { child.remove(); removed++; }
      else if ((child.nodeType === 3 || child.nodeType === 4) && !inText && STRUCTURAL.has(element.localName) && !child.textContent.trim()) { child.remove(); removed++; }
    }
  };
  walk(root);
  // Serialize the sanitized XML, never insert it into the HTML document.
  const output = new XMLSerializer().serializeToString(root);
  return { output, originalBytes, outputBytes: new TextEncoder().encode(output).length, removed };
}

export function svgTool(root) {
  const file = input({ type: 'file', accept: 'image/svg+xml,.svg' });
  const source = textarea({ rows: 10, placeholder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">…</svg>' });
  const output = textarea({ rows: 8, readOnly: true });
  const optimize = action('Optimize and preview', { variant: 'primary' }), save = action('Download SVG', { disabled: true }), copy = action('Copy SVG', { disabled: true });
  const feedback = h('div'), preview = h('div', { class: 'preview-box' });
  let version = 0, alive = true, url = null, filename = 'optimized.svg';
  const reset = () => { version++; output.value = ''; save.disabled = copy.disabled = true; preview.replaceChildren(); if (url) URL.revokeObjectURL(url); url = null; };
  source.addEventListener('input', () => { reset(); message(feedback, 'info', 'Source changed. Optimize again to refresh the sanitized preview.'); });
  file.addEventListener('change', async () => {
    reset(); const id = version, chosen = file.files[0];
    if (!chosen) return;
    message(feedback, 'info', 'Reading SVG locally…');
    try {
      if (!chosen.size || chosen.size > LIMIT) throw new Error('Choose a nonempty SVG file up to 2 MB.');
      const value = await chosen.text();
      if (!alive || id !== version) return;
      source.value = value; filename = `${chosen.name.replace(/\.svg$/i, '')}-optimized.svg`;
      message(feedback, 'info', 'SVG loaded. Optimize to sanitize and preview.');
    } catch (error) { if (alive && id === version) message(feedback, 'err', error.message); }
  });
  optimize.addEventListener('click', () => {
    reset(); const id = version;
    message(feedback, 'info', 'Optimizing SVG locally…');
    try {
      const result = optimizeSvg(source.value);
      output.value = result.output; copy.disabled = save.disabled = false;
      url = URL.createObjectURL(new Blob([result.output], { type: 'image/svg+xml' }));
      const image = previewImage('Sanitized SVG preview');
      image.onload = () => { if (alive && id === version) { URL.revokeObjectURL(url); url = null; } };
      image.onerror = () => {
        if (alive && id === version) { if (url) URL.revokeObjectURL(url); url = null; message(feedback, 'err', 'SVG optimized, but this browser could not render its image preview. Check the output before downloading.'); }
      };
      image.src = url; preview.replaceChildren(image);
      const delta = result.originalBytes - result.outputBytes;
      message(feedback, 'ok', `${formatBytes(result.originalBytes)} → ${formatBytes(result.outputBytes)} (${delta >= 0 ? 'saved' : 'grew by'} ${formatBytes(Math.abs(delta))}). Removed ${result.removed} items. Text whitespace is preserved.`);
    } catch (error) { message(feedback, 'err', error.message); }
  });
  save.addEventListener('click', () => { if (output.value) download(output.value, filename, 'image/svg+xml'); });
  copy.addEventListener('click', async () => {
    try { const ok = await copyText(output.value); if (alive) message(feedback, ok ? 'ok' : 'err', ok ? 'SVG copied.' : 'Copy failed. Select the output and copy manually.'); }
    catch { if (alive) message(feedback, 'err', 'Copy failed. Select the output and copy manually.'); }
  });
  message(feedback, 'info', 'Up to 2 MB. Removes comments, editor metadata, scripts, animation, foreign content, stylesheets and external references. Safe inline presentation styles remain. Some artwork may change; compare before use.');
  root.append(h('div', { class: 'panes' }, panel('SVG source', stack(field({ label: 'SVG file', control: file }), field({ label: 'SVG markup', control: source }), optimize)), panel('Sanitized output', stack(feedback, preview, field({ label: 'Optimized SVG markup', control: output }), h('div', { class: 'toolbar' }, copy, save)))));
  return () => { alive = false; reset(); };
}
