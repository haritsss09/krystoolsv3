import { h } from '../../core/dom.js';

const GAMES = {
  'dino-runner': { src: 'assets/games/dino.html', title: 'Dino Runner 3D' },
  'track-racer': { src: 'assets/games/racer.html', title: 'Track Racer' },
};

export function gameTool(root, { tool }) {
  const game = GAMES[tool.id];
  const frame = h('iframe', { class: 'game-frame', src: game.src, title: game.title, allow: 'fullscreen', loading: 'eager' });
  const full = h('button', { class: 'btn', type: 'button', text: 'Full screen' });
  const reload = h('button', { class: 'btn btn--ghost', type: 'button', text: 'Restart game' });
  full.addEventListener('click', () => (frame.requestFullscreen ? frame.requestFullscreen() : null)?.catch?.(() => {}));
  reload.addEventListener('click', () => { frame.src = game.src; });
  frame.addEventListener('load', () => frame.focus());
  if (!document.fullscreenEnabled) full.hidden = true;
  root.append(h('div', { class: 'stack' }, h('div', { class: 'game-wrap' }, frame), h('div', { class: 'row' }, full, reload)));
  frame.focus();
}
