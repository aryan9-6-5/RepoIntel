import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ingestRepo, type IngestResult } from "../_shared/ingest.ts";
import { TtlCache, clientIp, overLimit } from "../_shared/limits.ts";
import { parseRepoRef } from "../_shared/repoUrl.ts";
import { corsHeadersFor } from "../_shared/validate.ts";

const treeCache = new TtlCache<IngestResult>(300_000); // 5 min: saves GitHub quota
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "http://localhost:8080,http://localhost:5173").split(",").map((s) => s.trim());

const STATUS: Record<string, number> = {
  not_found: 404,
  rate_limited: 429,
  repo_too_large: 413,
  too_many_files: 413,
  upstream_error: 502,
};

serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("origin"), ALLOWED_ORIGINS);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (await overLimit(clientIp(req), { url: Deno.env.get("SUPABASE_URL"), key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }, fetch, 20, 60, (m) => console.error(m))) return json({ error: "Too many requests. Please wait a minute." }, 429);

  try {
    const raw = await req.text();
    if (raw.length > 2_000) return json({ error: "Request too large" }, 413);
    let body: { repo?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const ref = typeof body?.repo === "string" ? parseRepoRef(body.repo) : null;
    if (!ref) return json({ error: "Enter a public GitHub repository as owner/repo or a github.com URL." }, 400);

    const result = await ingestRepo(
      ref,
      (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }),
      Deno.env.get("GITHUB_TOKEN") ?? undefined, treeCache);
    if (!result.ok) return json({ error: result.message, code: result.code, resetAt: result.resetAt }, STATUS[result.code] ?? 500);
    return json(result);
  } catch (error) {
    console.error("repo-ingest failed:", error instanceof Error ? error.name : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
