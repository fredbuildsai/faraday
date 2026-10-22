// Server-only OpenAlex client: contact email + optional key, ~5 req/s, one retry on 429, 24h DB cache.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://api.openalex.org";
const DAY_MS = 24 * 60 * 60 * 1000;
let lastCall = 0;

function withCredentials(path: string): string {
  const url = new URL(path, BASE);
  const mailto = process.env["OPENALEX_MAILTO"];
  const key = process.env["OPENALEX_API_KEY"];
  if (mailto) url.searchParams.set("mailto", mailto);
  if (key) url.searchParams.set("api_key", key);
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function openalexGet<T = any>(path: string): Promise<T> {
  // Cache key excludes credentials.
  const cacheKey = new URL(path, BASE).toString();
  const { data: cached } = await supabaseAdmin
    .from("openalex_cache")
    .select("body, fetched_at")
    .eq("url", cacheKey)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < DAY_MS) return cached.body as T;

  let attempt = 0;
  while (true) {
    const wait = lastCall + 200 - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(withCredentials(path), { headers: { accept: "application/json" } });
    if (res.status === 429 && attempt === 0) {
      attempt++;
      await sleep(2000);
      continue;
    }
    if (res.status === 404) throw new OpenAlexNotFound();
    if (!res.ok) throw new Error(`OpenAlex error ${res.status}`);
    const body = await res.json();
    await supabaseAdmin.from("openalex_cache").upsert({ url: cacheKey, body, fetched_at: new Date().toISOString() });
    return body as T;
  }
}

export class OpenAlexNotFound extends Error {
  constructor() {
    super("Not found in OpenAlex");
  }
}
