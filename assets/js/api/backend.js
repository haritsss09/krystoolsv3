import config from '../config.js';
import * as store from '../core/storage.js';
import { request, ApiError } from './api-client.js';
import * as auth from '../services/auth.js';

export function settings() {
  const local = store.get('backend', null);
  return {
    url: (local?.url || config.functionsUrl || '').replace(/\/+$/, ''),
    anonKey: local?.anonKey || config.anonKey || '',
    fromDevice: Boolean(local?.url),
  };
}

export const isConfigured = () => Boolean(settings().url);

export async function call(name, body, { timeout = 20000, source = { name: 'KrysTools server function' } } = {}) {
  const { url, anonKey } = settings();
  if (!url) {
    return {
      ok: false,
      source: null,
      error: new ApiError('config', 'Server functions are not configured for this site. The owner needs to deploy the Supabase functions and set the functions URL (see Settings).'),
    };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (anonKey) {
    headers.Authorization = `Bearer ${anonKey}`;
    headers.apikey = anonKey;
  }
  const token = await auth.accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return request(`${url}/${name}`, {
    timeout,
    retries: 0,
    source,
    init: { method: 'POST', headers, body: JSON.stringify(body) },
    validate: (d) => (d && typeof d === 'object' ? true : 'The server function returned an unexpected response.'),
  });
}
