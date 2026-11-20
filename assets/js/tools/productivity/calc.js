import { h, input, select, field, button, panel, actions, copyButton, status } from '../../core/dom.js';

function finite(value) {
  if (!Number.isFinite(value)) throw new Error('The result is outside the real, finite number range.');
  return Object.is(value, -0) ? 0 : value;
}

export function percentage(mode, a, b) {
  if (![a, b].every(n => Number.isFinite(n) && Math.abs(n) <= 1e300)) throw new Error('Enter finite numbers with magnitude at most 1e300.');
  if (mode === 'of') return finite(a / 100 * b);
  if (mode === 'ratio') {
    if (b === 0) throw new Error('The whole cannot be zero.');
    return finite(a / b * 100);
  }
  if (mode === 'change') {
    if (a === 0) throw new Error('Percentage change from zero is undefined.');
    return finite((b - a) / Math.abs(a) * 100);
  }
  throw new Error('Choose a percentage operation.');
}

export function evaluateExpression(expression, { angle = 'rad', memory = 0, answer = 0 } = {}) {
  if (typeof expression !== 'string' || !expression.trim() || expression.length > 2000) throw new Error('Enter an expression of 1 to 2,000 characters.');
  if (!['rad', 'deg'].includes(angle)) throw new Error('Choose radians or degrees.');
  finite(memory);
  finite(answer);
  const tokens = [];
  let position = 0;
  while (position < expression.length) {
    const rest = expression.slice(position);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { position += whitespace[0].length; continue; }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    const name = rest.match(/^[a-zA-Z]+/);
    const match = number || name;
    if (match) {
      tokens.push({ kind: number ? 'number' : 'name', value: number ? finite(Number(match[0])) : match[0].toLowerCase() });
      position += match[0].length;
    } else if ('+-*/%^!(),'.includes(rest[0])) {
      tokens.push({ kind: rest[0], value: rest[0] });
      position++;
    } else throw new Error(`Unexpected character at position ${position + 1}.`);
    if (tokens.length > 512) throw new Error('Use at most 512 expression tokens.');
  }
  tokens.push({ kind: 'end' });
  let cursor = 0;
  let depth = 0;
  const peek = () => tokens[cursor].kind;
  const accept = kind => { if (peek() === kind) { cursor++; return true; } return false; };
  const requireToken = kind => { if (!accept(kind)) throw new Error(`Expected “${kind}”.`); };
  const radians = x => angle === 'deg' ? x * Math.PI / 180 : x;
  const fromRadians = x => angle === 'deg' ? x * 180 / Math.PI : x;
  const functions = new Map([
    ['sin', [1, 1, x => Math.sin(radians(x))]], ['cos', [1, 1, x => Math.cos(radians(x))]],
    ['tan', [1, 1, x => { const r = radians(x); if (Math.abs(Math.cos(r)) < 1e-14) throw new Error('Tangent is undefined at this angle.'); return Math.tan(r); }]],
    ['asin', [1, 1, x => fromRadians(Math.asin(x))]], ['acos', [1, 1, x => fromRadians(Math.acos(x))]], ['atan', [1, 1, x => fromRadians(Math.atan(x))]],
    ['sqrt', [1, 1, Math.sqrt]], ['cbrt', [1, 1, Math.cbrt]], ['abs', [1, 1, Math.abs]],
    ['ln', [1, 1, Math.log]], ['log', [1, 1, Math.log10]], ['exp', [1, 1, Math.exp]],
    ['floor', [1, 1, Math.floor]], ['ceil', [1, 1, Math.ceil]], ['round', [1, 1, Math.round]],
    ['min', [1, 16, Math.min]], ['max', [1, 16, Math.max]], ['pow', [2, 2, Math.pow]], ['hypot', [1, 16, Math.hypot]],
  ]);
  const constants = new Map([['pi', Math.PI], ['e', Math.E], ['tau', 2 * Math.PI], ['mem', memory], ['ans', answer]]);
  function primary() {
    if (++depth > 64) throw new Error('Expression nesting is limited to 64 levels.');
    try {
      let value;
      if (peek() === 'number') value = tokens[cursor++].value;
      else if (accept('(')) { value = sum(); requireToken(')'); }
      else if (peek() === 'name') {
        const name = tokens[cursor++].value;
        if (accept('(')) {
          const fn = functions.get(name);
          if (!fn) throw new Error(`Unknown function: ${name}.`);
          const args = [];
          if (peek() !== ')') {
            do {
              args.push(sum());
              if (args.length > 16) throw new Error('Functions accept at most 16 arguments.');
            } while (accept(','));
          }
          requireToken(')');
          if (args.length < fn[0] || args.length > fn[1]) throw new Error(`${name} expects ${fn[0] === fn[1] ? fn[0] : fn[0] + '–' + fn[1]} argument(s).`);
          value = finite(fn[2](...args));
        } else {
          if (!constants.has(name)) throw new Error(`Unknown constant: ${name}.`);
          value = constants.get(name);
        }
      } else throw new Error('Expected a number, constant, function or parenthesized expression.');
      while (accept('!')) {
        if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error('Factorial requires a whole number from 0 to 170.');
        let product = 1;
        for (let n = 2; n <= value; n++) product *= n;
        value = finite(product);
      }
      return value;
    } finally { depth--; }
  }
  function power() {
    const base = primary();
    return accept('^') ? finite(base ** unary()) : base;
  }
  function unary() {
    if (++depth > 64) throw new Error('Expression nesting is limited to 64 levels.');
    try {
      if (accept('+')) return unary();
      if (accept('-')) return finite(-unary());
      return power();
    } finally { depth--; }
  }
  function product() {
    let left = unary();
    while (['*', '/', '%'].includes(peek())) {
      const op = tokens[cursor++].kind;
      const right = unary();
      if ((op === '/' || op === '%') && right === 0) throw new Error('Division by zero is undefined.');
      left = finite(op === '*' ? left * right : op === '/' ? left / right : left % right);
    }
    return left;
  }
  function sum() {
    let left = product();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[cursor++].kind;
      const right = product();
      left = finite(op === '+' ? left + right : left - right);
    }
    return left;
  }
  const result = sum();
  if (peek() !== 'end') throw new Error('Unexpected token. Use an explicit multiplication sign, such as 2*pi.');
  return finite(result);
}

export function percentTool(root) {
  const mode = select([['of', 'Percent of a number'], ['ratio', 'What percent is one number of another?'], ['change', 'Percentage change']]);
  const a = input({ value: '25', inputmode: 'decimal' });
  const b = input({ value: '200', inputmode: 'decimal' });
  const aField = field({ label: 'Percent', control: a });
  const bField = field({ label: 'Number', control: b });
  const result = h('div', { class: 'big-value', 'aria-live': 'polite' });
  const formula = h('p', { class: 'field__hint' });
  const feedback = h('div');
  let copy = '';
  function update() {
    const labels = { of: ['Percent', 'Number'], ratio: ['Part', 'Whole'], change: ['Original value', 'New value'] }[mode.value];
    aField.querySelector('label span').textContent = labels[0];
    bField.querySelector('label span').textContent = labels[1];
    try {
      for (const control of [a, b]) if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(control.value.trim())) throw new Error('Enter both numbers, using dots for decimals.');
      copy = String(Number(percentage(mode.value, Number(a.value), Number(b.value)).toPrecision(14))) + (mode.value === 'of' ? '' : '%');
      result.textContent = copy;
      formula.textContent = mode.value === 'of' ? 'Percent ÷ 100 × number' : mode.value === 'ratio' ? 'Part ÷ whole × 100' : '(New − original) ÷ |original| × 100. A negative result means a decrease.';
      feedback.replaceChildren();
    } catch (error) { copy = ''; result.textContent = ''; formula.textContent = ''; feedback.replaceChildren(status('err', error.message)); }
  }
  for (const control of [mode, a, b]) control.addEventListener('input', update);
  root.append(field({ label: 'Calculation', control: mode }), h('div', { class: 'panes' },
    panel('Values', h('div', { class: 'workspace' }, aField, bField, button('Calculate', { variant: 'primary', onclick: update }))),
    panel('Result', actions(copyButton(() => copy)), result, formula)), feedback);
  update();
}

export function calculatorTool(root) {
  let memory = 0;
  let answer = 0;
  let copy = '';
  const expression = input({ value: '2^10 / sqrt(16) + sin(pi/2)', maxlength: 2000, class: 'input input--mono' });
  const angle = select([['rad', 'Radians'], ['deg', 'Degrees']]);
  const result = h('div', { class: 'big-value', 'aria-live': 'polite', text: 'Enter an expression' });
  const memoryDisplay = h('p', { class: 'field__hint', text: 'Memory: 0' });
  const feedback = h('div');
  const history = h('ol', { class: 'output output--sm', 'aria-label': 'Recent calculations' });
  const entries = [];
  function calculate(record = true) {
    try {
      const value = evaluateExpression(expression.value, { angle: angle.value, memory, answer });
      answer = value;
      copy = String(value);
      result.textContent = copy;
      feedback.replaceChildren();
      expression.removeAttribute('aria-invalid');
      if (record) {
        entries.unshift(`${expression.value} = ${copy} (${angle.value})`);
        entries.splice(10);
        history.replaceChildren(...entries.map(text => h('li', { text })));
      }
      return value;
    } catch (error) {
      copy = '';
      result.textContent = 'No result';
      expression.setAttribute('aria-invalid', 'true');
      feedback.replaceChildren(status('err', error.message));
      return null;
    }
  }
  function insert(text) {
    const start = expression.selectionStart ?? expression.value.length;
    const end = expression.selectionEnd ?? start;
    if (expression.value.length - (end - start) + text.length > 2000) { feedback.replaceChildren(status('err', 'Expression limit: 2,000 characters.')); return; }
    expression.setRangeText(text, start, end, 'end');
    expression.focus();
  }
  function changeMemory(operation) {
    if (operation === 'clear') memory = 0;
    else {
      const value = calculate(false);
      if (value === null) return;
      try { memory = finite(operation === 'add' ? memory + value : operation === 'subtract' ? memory - value : value); }
      catch (error) { feedback.replaceChildren(status('err', error.message)); return; }
    }
    memoryDisplay.textContent = `Memory: ${memory}`;
  }
  const form = h('form', { class: 'workspace', onsubmit: event => { event.preventDefault(); calculate(); } },
    field({ label: 'Expression', control: expression, hint: 'Enter to calculate. Use * for multiplication, ^ for powers, ! for factorial, and % for remainder.' }),
    field({ label: 'Trigonometry mode', control: angle }),
    h('div', { class: 'toolbar' }, button('Calculate', { type: 'submit', variant: 'primary' }), button('Clear', { onclick: () => { expression.value = ''; copy = ''; result.textContent = 'Enter an expression'; feedback.replaceChildren(); expression.focus(); } }),
      button('Backspace', { onclick: () => {
        const start = expression.selectionStart ?? expression.value.length;
        const end = expression.selectionEnd ?? start;
        expression.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end');
        expression.focus();
      } })),
    h('div', { class: 'calc-grid' }, ...['7', '8', '9', '/', 'sqrt(', '4', '5', '6', '*', '^', '1', '2', '3', '-', '(', '0', '.', 'pi', '+', ')', 'sin(', 'cos(', 'tan(', 'log(', 'ln('].map(key => button(key, { onclick: () => insert(key) }))),
    h('div', { class: 'toolbar' },
      button('MS', { 'aria-label': 'Store result in memory', onclick: () => changeMemory('store') }),
      button('M+', { 'aria-label': 'Add result to memory', onclick: () => changeMemory('add') }),
      button('M−', { 'aria-label': 'Subtract result from memory', onclick: () => changeMemory('subtract') }),
      button('MR', { 'aria-label': 'Insert memory constant', onclick: () => insert('mem') }),
      button('MC', { 'aria-label': 'Clear memory', onclick: () => changeMemory('clear') }),
      button('Ans', { 'aria-label': 'Insert previous answer', onclick: () => insert('ans') })), memoryDisplay);
  root.append(h('div', { class: 'panes' }, panel('Expression', form), panel('Result', actions(copyButton(() => copy)), result, feedback)),
    panel('Recent calculations', history),
    h('p', { class: 'field__hint', text: 'Constants: pi, e, tau, ans, mem. Functions: sin, cos, tan, asin, acos, atan, sqrt, cbrt, abs, ln (natural), log (base 10), exp, floor, ceil, round, min, max, pow, hypot. Separate function arguments with commas. Powers associate right to left; -2^2 = -4. Floating-point results are approximate. Memory and history reset when you leave.' }));
  angle.addEventListener('change', () => { copy = ''; result.textContent = 'Calculate with the selected angle mode'; });
}
