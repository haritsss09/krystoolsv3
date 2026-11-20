import { h, input, select, field, button, panel, copyButton, actions, status } from '../../core/dom.js';

export const UNIT_GROUPS = {
  length: { label: 'Length', units: { m: ['Metres (m)', 1], km: ['Kilometres (km)', 1000], cm: ['Centimetres (cm)', 0.01], mm: ['Millimetres (mm)', 0.001], in: ['Inches (in)', 0.0254], ft: ['Feet (ft)', 0.3048], yd: ['Yards (yd)', 0.9144], mi: ['Miles (mi)', 1609.344], nmi: ['Nautical miles', 1852] } },
  mass: { label: 'Mass', units: { kg: ['Kilograms (kg)', 1], g: ['Grams (g)', 0.001], mg: ['Milligrams (mg)', 0.000001], t: ['Metric tonnes', 1000], lb: ['Pounds (lb)', 0.45359237], oz: ['Ounces (oz)', 0.028349523125], st: ['Stones', 6.35029318] } },
  temperature: { label: 'Temperature', units: { C: ['Celsius (°C)', 1], F: ['Fahrenheit (°F)', 1], K: ['Kelvin (K)', 1] } },
  area: { label: 'Area', units: { m2: ['Square metres', 1], km2: ['Square kilometres', 1000000], cm2: ['Square centimetres', 0.0001], ft2: ['Square feet', 0.09290304], yd2: ['Square yards', 0.83612736], mi2: ['Square miles', 2589988.110336], acre: ['Acres', 4046.8564224], ha: ['Hectares', 10000] } },
  volume: { label: 'Volume', units: { L: ['Litres (L)', 1], mL: ['Millilitres (mL)', 0.001], m3: ['Cubic metres', 1000], cup: ['US cups', 0.2365882365], floz: ['US fluid ounces', 0.0295735295625], gal: ['US gallons', 3.785411784], impgal: ['Imperial gallons', 4.54609], ft3: ['Cubic feet', 28.316846592] } },
  speed: { label: 'Speed', units: { ms: ['Metres per second', 1], kmh: ['Kilometres per hour', 1 / 3.6], mph: ['Miles per hour', 0.44704], knot: ['Knots', 1852 / 3600], fts: ['Feet per second', 0.3048] } },
  data: { label: 'Data size', units: { B: ['Bytes (B)', 1], bit: ['Bits (b)', 1 / 8], KB: ['Kilobytes (KB, decimal)', 1000], MB: ['Megabytes (MB, decimal)', 1e6], GB: ['Gigabytes (GB, decimal)', 1e9], TB: ['Terabytes (TB, decimal)', 1e12], KiB: ['Kibibytes (KiB, binary)', 1024], MiB: ['Mebibytes (MiB, binary)', 1024 ** 2], GiB: ['Gibibytes (GiB, binary)', 1024 ** 3], TiB: ['Tebibytes (TiB, binary)', 1024 ** 4] } },
  time: { label: 'Time', units: { s: ['Seconds', 1], ms: ['Milliseconds', 0.001], min: ['Minutes', 60], h: ['Hours', 3600], d: ['Days (24 hours)', 86400], wk: ['Weeks (7 days)', 604800] } },
};

export function convertUnit(value, group, from, to) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e300) throw new Error('Enter a finite value between -1e300 and 1e300.');
  if (!Object.hasOwn(UNIT_GROUPS, group)) throw new Error('Choose a valid unit category.');
  const units = UNIT_GROUPS[group].units;
  if (!Object.hasOwn(units, from) || !Object.hasOwn(units, to)) throw new Error('Choose units from the same category.');
  let result;
  if (group === 'temperature') {
    const kelvin = from === 'K' ? value : from === 'C' ? value + 273.15 : (value - 32) * 5 / 9 + 273.15;
    if (kelvin < -1e-10) throw new Error('Temperature cannot be below absolute zero.');
    const k = Math.max(0, kelvin);
    result = to === 'K' ? k : to === 'C' ? k - 273.15 : (k - 273.15) * 9 / 5 + 32;
  } else result = value * (units[from][1] / units[to][1]);
  if (!Number.isFinite(result)) throw new Error('The converted value exceeds numeric limits.');
  return result;
}

export function unitsTool(root) {
  const group = select(Object.entries(UNIT_GROUPS).map(([key, info]) => [key, info.label]));
  const from = select([]);
  const to = select([]);
  const value = input({ value: '1', inputmode: 'decimal' });
  const result = h('div', { class: 'big-value', 'aria-live': 'polite' });
  const description = h('p', { class: 'field__hint' });
  const feedback = h('div');
  let copy = '';
  function update() {
    try {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.value.trim())) throw new Error('Enter a number, using a dot for decimals. Scientific notation is supported.');
      const converted = convertUnit(Number(value.value), group.value, from.value, to.value);
      copy = String(Number(converted.toPrecision(14)));
      result.textContent = copy;
      description.textContent = UNIT_GROUPS[group.value].units[to.value][0];
      feedback.replaceChildren();
      value.removeAttribute('aria-invalid');
    } catch (error) {
      copy = '';
      result.textContent = '';
      description.textContent = '';
      value.setAttribute('aria-invalid', 'true');
      feedback.replaceChildren(status('err', error.message));
    }
  }
  function setUnits() {
    const options = Object.entries(UNIT_GROUPS[group.value].units);
    for (const control of [from, to]) control.replaceChildren(...options.map(([key, info]) => h('option', { value: key, text: info[0] })));
    to.value = options[1][0];
    update();
  }
  group.addEventListener('change', setUnits);
  for (const control of [value, from, to]) control.addEventListener('input', update);
  root.append(h('div', { class: 'panes' }, panel('Convert', h('div', { class: 'workspace' },
    field({ label: 'Category', control: group }), field({ label: 'Value', control: value }),
    field({ label: 'From', control: from }), field({ label: 'To', control: to }),
    h('div', { class: 'toolbar' }, button('Convert', { variant: 'primary', onclick: update }), button('Swap units', { onclick: () => {
      [from.value, to.value] = [to.value, from.value];
      update();
    } })))), panel('Result', actions(copyButton(() => copy)), result, description)), feedback,
  h('p', { class: 'field__hint', text: 'Results use floating-point arithmetic and display up to 14 significant digits. Months and years are not fixed-duration units. US and imperial volumes are labeled separately.' }));
  setUnits();
}
