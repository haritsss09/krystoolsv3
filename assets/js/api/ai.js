import { call } from './backend.js';
import { ApiError } from './api-client.js';

export async function generate({ task, text, direction }) {
  const result = await call('ai', { task, text, direction }, { timeout: 35000, source: { name: 'Configured AI provider via server function' } });
  if (result.ok && typeof result.data?.text !== 'string') return { ...result, ok: false, error: new ApiError('invalid', 'The AI function returned no text.') };
  if (result.ok) result.source = { name: `${result.data.provider} · ${result.data.model}` };
  return result;
}
