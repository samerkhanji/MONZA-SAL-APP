/**
 * Public Supabase key: legacy anon JWT or newer publishable key (sb_publishable_...).
 * Prefer NEXT_PUBLIC_SUPABASE_ANON_KEY; fall back to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (e.g. Vercel).
 */
export function getSupabasePublicKey(): string | undefined {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return anon || publishable || undefined;
}

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}
