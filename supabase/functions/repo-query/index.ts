import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ingestRepo, type IngestResult } from "../_shared/ingest.ts";
import { TtlCache, clientIp, rateLimited } from "../_shared/limits.ts";
import { parseRepoRef } from "../_shared/repoUrl.ts";
import { buildMessages, checkCitations } from "../_shared/answer.ts";
import { chunkFile, rankPaths, searchChunks } from "../_shared/search.ts";
import { corsHeadersFor } from "../_shared/validate.ts";

const treeCache = new TtlCache<IngestResult>(300_000); // 5 min: saves GitHub quota
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "http://localhost:8080,http://localhost:5173").split(",").map((s) => s.trim());
const MAX_FILES = 15; // bounds GitHub calls and CPU per request

serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("origin"), ALLOWED_ORIGINS);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (rateLimited(clientIp(req))) return json({ error: "Too many requests. Please wait a minute." }, 429);

  try {
    const raw = await req.text();
    if (raw.length > 3_000) return json({ error: "Request too large" }, 413);
    let body: { repo?: unknown; query?: unknown; ask?: unknown };
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
    const ref = typeof body.repo === "string" ? parseRepoRef(body.repo) : null;
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 300) : "";
    if (!ref || !query) return json({ error: "Provide repo (owner/repo) and query." }, 400);

    const token = Deno.env.get("GITHUB_TOKEN") ?? undefined;
    const f = (url: string, init?: { headers?: Record<string, string> }) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const ing = await ingestRepo(ref, f, token, treeCache);
    if (!ing.ok) return json({ error: ing.message, code: ing.code }, ing.code === "not_found" ? 404 : ing.code === "rate_limited" ? 429 : 413);

    const paths = rankPaths(ing.files.map((x) => x.path), query, MAX_FILES);
    const chunks = (await Promise.all(paths.map(async (p) => {
      const url = `https://raw.githubusercontent.com/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/${ing.commitSha}/${p.split("/").map(encodeURIComponent).join("/")}`;
      const r = await f(url);
      return r.ok ? chunkFile(p, await r.text()) : [];
    }))).flat();

    // Snippets are untrusted repo data: returned as data, never executed or interpreted.
    const snippets = searchChunks(chunks, query, 8);
    const base = { repoId: ing.repoId, commitSha: ing.commitSha, filesConsidered: paths.length, snippets };
    if (!body.ask) return json(base);
    if (!snippets.length) return json({ ...base, answer: "INSUFFICIENT EVIDENCE: no matching code found.", citations: { valid: [], invalid: [], grounded: false } });

    const key = Deno.env.get("GROQ_API_KEY");
    if (!key) return json({ error: "AI service is not configured" }, 503);
    const g = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: buildMessages(query, snippets), temperature: 0.2, max_tokens: 600 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!g.ok) {
      const ue = await g.json().catch(() => ({})); const upstreamCode = typeof ue?.error?.code === "string" ? ue.error.code : undefined;
      console.error("Groq status:", g.status, upstreamCode);
      return json({ ...base, error: g.status === 429 ? "AI rate limit reached." : "AI service error", upstreamStatus: g.status, upstreamCode }, g.status === 429 ? 429 : 502);
    }
    const answer = (await g.json()).choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return json({ ...base, error: "AI returned an empty response" }, 502);
    return json({ ...base, answer, citations: checkCitations(answer, snippets) });
  } catch (e) {
    console.error("repo-query failed:", e instanceof Error ? e.name : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
