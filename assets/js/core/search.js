import { TOOLS, categoryById } from './registry.js';

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

const index = TOOLS.map((tool) => ({
  tool,
  name: norm(tool.name),
  id: tool.id.replace(/-/g, ' '),
  rest: norm([tool.description, tool.tags.join(' '), categoryById.get(tool.category).name, tool.source?.name || ''].join(' ')),
}));

export function search(query, pool = null) {
  const q = norm(query.trim());
  if (!q) return (pool || TOOLS).slice();
  const terms = q.split(/\s+/);
  const allowed = pool ? new Set(pool.map((t) => t.id)) : null;
  const scored = [];
  for (const entry of index) {
    if (allowed && !allowed.has(entry.tool.id)) continue;
    let score = 0;
    let all = true;
    for (const term of terms) {
      if (entry.name.startsWith(term)) score += 12;
      else if (new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(entry.name)) score += 8;
      else if (entry.name.includes(term) || entry.id.includes(term)) score += 5;
      else if (entry.rest.includes(term)) score += 2;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ tool: entry.tool, score });
  }
  scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  return scored.map((s) => s.tool);
}
