import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { answerWithCitations, buildMessages, fitSnippets } from "../_shared/answer.ts";
import { ingestRepo, type IngestResult } from "../_shared/ingest.ts";
import { TtlCache, clientIp, overLimit } from "../_shared/limits.ts";
import { Memo, chatError, groqChat } from "../_shared/llm.ts";
import { parseRepoRef } from "../_shared/repoUrl.ts";
import { chunkFile, rankPaths, searchChunks } from "../_shared/search.ts";
import { corsHeadersFor } from "../_shared/validate.ts";

const treeCache = new TtlCache<IngestResult>(300_000);
// Same repo+commit+question within 10 min reuses the answer (saves free-tier Groq quota); concurrent duplicates share one call.
const answers = new Memo<{ status: number; body: Record<string, unknown> }>(600_000);
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "http://localhost:8080,http://localhost:5173").split(",").map((s) => s.trim());
const MAX_FILES = 24; // bounds GitHub calls and CPU per request (24 beat 15 on the benchmark: docs/EVAL-UNSEEN.md)

serve(async (req) => {
  const t0 = Date.now();
  const cors = corsHeadersFor(req.headers.get("origin"), ALLOWED_ORIGINS);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (await overLimit(clientIp(req), { url: Deno.env.get("SUPABASE_URL"), key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }, fetch, 20, 60, (m) => console.error(m))) return json({ error: "Too many requests. Please wait a minute." }, 429);

  try {
    const raw = await req.text();
    if (raw.length > 3_000) return json({ error: "Request too large" }, 413);
    let body: { repo?: unknown; query?: unknown; ask?: unknown };
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
    const ref = typeof body.repo === "string" ? parseRepoRef(body.repo) : null;
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 300) : "";
    if (!ref || !query) return json({ error: "Provide repo (owner/repo) and query." }, 400);

    const f = (url: string, init?: { headers?: Record<string, string> }) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const ing = await ingestRepo(ref, f, Deno.env.get("GITHUB_TOKEN") ?? undefined, treeCache);
    if (!ing.ok) return json({ error: ing.message, code: ing.code }, ing.code === "not_found" ? 404 : ing.code === "rate_limited" ? 429 : 413);

    const run = async (): Promise<{ status: number; body: Record<string, unknown> }> => {
      const paths = rankPaths(ing.files.map((x) => x.path), query, MAX_FILES);
      const chunks = (await Promise.all(paths.map(async (p) => {
        const url = `https://raw.githubusercontent.com/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/${ing.commitSha}/${p.split("/").map(encodeURIComponent).join("/")}`;
        const r = await f(url);
        return r.ok ? chunkFile(p, await r.text()) : [];
      }))).flat();

      // Snippets are untrusted repo data: returned as data, never executed or interpreted.
      const snippets = searchChunks(chunks, query, 8);
      const base = { repoId: ing.repoId, commitSha: ing.commitSha, filesConsidered: paths.length, snippets };
      if (!body.ask) return { status: 200, body: base };
      if (!snippets.length) return { status: 200, body: { ...base, answer: "INSUFFICIENT EVIDENCE: no matching code found.", citations: { valid: [], invalid: [], grounded: false } } };

      const key = Deno.env.get("GROQ_API_KEY");
      if (!key) return { status: 503, body: { error: "AI service is not configured" } };
      // Free tier allows 8000 tokens/min per model: send at most ~10k chars of snippets (~3k tokens) and cap the output.
      const sent = fitSnippets(snippets);
      const { result: r, citations, retried } = await answerWithCitations(
        (messages) => groqChat(key, { messages, maxTokens: 900, reasoningEffort: "low", temperature: 0.2 }),
        buildMessages(query, sent), sent,
      );
      if (!r.ok) {
        console.error("Groq status:", r.status, r.code);
        const e = chatError(r);
        return { status: e.status, body: { ...base, error: e.error, upstreamStatus: r.status, upstreamCode: r.code, quota: r.quota } };
      }
      return { status: 200, body: { ...base, answer: r.text, citations, snippetsSent: sent.length, retried, usage: r.usage, aiMs: r.ms, model: r.model, fellBack: r.fellBack ?? false, quota: r.quota } };
    };

    // Only answered questions are memoized (retrieval-only calls are cheap and not LLM-bound).
    if (!body.ask) { const r = await run(); return json({ ...r.body, ms: Date.now() - t0 }, r.status); }
    const m = await answers.get(`${ing.commitSha}|${query.toLowerCase()}`, async () => {
      const r = await run();
      return { value: r, cacheable: r.status === 200 };
    });
    return json({ ...m.value.body, cached: m.cached, ms: Date.now() - t0 }, m.value.status);
  } catch (e) {
    console.error("repo-query failed:", e instanceof Error ? e.name : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
