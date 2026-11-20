import { h, field, input, select, button, panel, status, kv } from '../../core/dom.js';
import { apiView } from '../../core/api-view.js';
import { currencies, latestRates, FX_SOURCE } from '../../api/currency.js';

export function currencyTool(workspace) {
  const amount = input({ type: 'number', min: '0', step: 'any', value: '1', required: true });
  const from = select([], { disabled: true, required: true });
  const to = select([], { disabled: true, required: true });
  const convert = button('Convert currency', { type: 'submit', variant: 'primary', disabled: true });
  const swap = button('Swap currencies', { disabled: true });
  let names = {};
  const resultView = apiView({
    idle: status('info', 'Choose currencies and enter an amount to convert.'),
    loadingText: 'Loading reference exchange rate',
    load: async (force) => {
      const value = Number(amount.value);
      const base = from.value;
      const symbol = to.value;
      if (!amount.value.trim() || !Number.isFinite(value) || value < 0 || !names[base] || !names[symbol]) {
        return { ok: false, source: FX_SOURCE, error: new Error('Enter a finite, non-negative amount and choose two supported currencies.') };
      }
      const res = await latestRates(base, base === symbol ? [] : [symbol], { force });
      if (!res.ok) return res;
      const rate = base === symbol ? 1 : res.data.rates[symbol];
      if (rate == null) return { ...res, data: null };
      if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(value * rate)) {
        return { ok: false, source: FX_SOURCE, error: new Error('The conversion is outside the supported numeric range, or the source rate is invalid.') };
      }
      return { ...res, data: { value, base, symbol, rate, converted: value * rate, date: res.data.date } };
    },
    isEmpty: (d) => !d && 'The source has no rate for this currency pair.',
    render: (d) => [
      h('p', { class: 'big-value', text: `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(d.converted)} ${d.symbol}` }),
      kv([['From', `${d.value} ${d.base}`], ['Reference rate', `1 ${d.base} = ${d.rate} ${d.symbol}`], ['Rate date', d.date]]),
      h('p', { class: 'field__hint', text: d.base === d.symbol ? 'Same-currency conversion: the amount is unchanged.' : 'Reference rates only. Bank fees, spreads and trading prices are not included.' }),
    ],
  });
  const currencyView = apiView({
    loadingText: 'Loading available currencies',
    load: (force) => currencies({ force }),
    isEmpty: (d) => !Object.keys(d).length && 'No currencies are available from the source.',
    render: (data) => {
      names = Object.fromEntries(Object.entries(data).filter(([code, name]) => /^[A-Z]{3}$/.test(code) && typeof name === 'string'));
      for (const [control, defaultCode] of [[from, 'USD'], [to, 'IDR']]) {
        const previous = control.value;
        control.replaceChildren(...Object.entries(names).sort(([a], [b]) => a.localeCompare(b)).map(([code, name]) => h('option', { value: code, text: `${code} · ${name}` })));
        control.value = names[previous] ? previous : names[defaultCode] ? defaultCode : Object.keys(names)[0] || '';
        control.disabled = !control.value;
      }
      convert.disabled = swap.disabled = !from.value || !to.value;
      return h('p', { class: 'field__hint', text: `${Object.keys(names).length} currencies available from Frankfurter.` });
    },
  });
  const form = h('form', { class: 'stack' }, field({ label: 'Amount', control: amount }),
    h('div', { class: 'grid grid--2' }, field({ label: 'From currency', control: from }), field({ label: 'To currency', control: to })),
    h('div', { class: 'row' }, convert, swap));
  const submit = (e) => { e.preventDefault(); resultView.run(); };
  const swapValues = () => { [from.value, to.value] = [to.value, from.value]; resultView.run(); };
  form.addEventListener('submit', submit);
  swap.addEventListener('click', swapValues);
  const root = h('div', { class: 'stack' }, currencyView.el, panel('Conversion', form), panel('Result', resultView.el));
  workspace.append(root);
  currencyView.run();
  return () => { form.removeEventListener('submit', submit); swap.removeEventListener('click', swapValues); currencyView.destroy(); resultView.destroy(); root.remove(); };
}
