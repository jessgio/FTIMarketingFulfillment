export function assertSupabaseConfigured(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const placeholder =
    !url ||
    !key ||
    url.includes("your-project") ||
    key.includes("your-anon-key") ||
    url.includes("placeholder.supabase.co");

  if (placeholder) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server (npm run dev)."
    );
  }
}
