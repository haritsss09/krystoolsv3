import { handle } from './handler.ts';

Deno.serve((req: Request) => handle(req, {
  ALLOWED_ORIGINS: Deno.env.get('ALLOWED_ORIGINS'),
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
