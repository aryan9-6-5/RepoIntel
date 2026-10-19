import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildMessages, checkCitations } from "../_shared/answer.ts";
import { ingestRepo, type IngestResult } from "../_shared/ingest.ts";
import { TtlCache, clientIp, overLimit } from "../_shared/limits.ts";
import { buildTree, overviewFromPaths, parseManifest, pickManifests } from "../_shared/overview.ts";
import { parseRepoRef } from "../_shared/repoUrl.ts";
import { chunkFile, type Chunk } from "../_shared/search.ts";
import { corsHeadersFor } from "../_shared/validate.ts";

const treeCache = new TtlCache<IngestResult>(300_000);
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "http://localhost:8080,http://localhost:5173").split(",").map((s) => s.trim());

serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("origin"), ALLOWED_ORIGINS);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (await overLimit(clientIp(req), { url: Deno.env.get("SUPABASE_URL"), key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }, fetch, 20, 60, (m) => console.error(m))) return json({ error: "Too many requests. Please wait a minute." }, 429);

  try {
    const raw = await req.text();
    if (raw.length > 2_000) return json({ error: "Request too large" }, 413);
    let body: { repo?: unknown; summary?: unknown };
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
    const ref = typeof body.repo === "string" ? parseRepoRef(body.repo) : null;
    if (!ref) return json({ error: "Provide repo as owner/repo." }, 400);

    const f = (url: string, init?: { headers?: Record<string, string> }) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const ing = await ingestRepo(ref, f, Deno.env.get("GITHUB_TOKEN") ?? undefined, treeCache);
    if (!ing.ok) return json({ error: ing.message, code: ing.code }, ing.code === "not_found" ? 404 : ing.code === "rate_limited" ? 429 : 413);

    const paths = ing.files.map((x) => x.path);
    const overview = overviewFromPaths(paths);
    const rawUrl = (p: string) =>
      `https://raw.githubusercontent.com/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/${ing.commitSha}/${p.split("/").map(encodeURIComponent).join("/")}`;
    const read = async (p: string) => { const r = await f(rawUrl(p)); return r.ok ? await r.text() : null; };

    // Manifests -> dependencies (deterministic parsing; content is untrusted data, never executed)
    const manifests = pickManifests(overview.configFiles);
    const manifestTexts = await Promise.all(manifests.map(async (p) => [p, await read(p)] as const));
    const dependencies = manifestTexts.flatMap(([p, t]) => (t ? [parseManifest(p, t)] : [])).filter((d) => d !== null);

    const result: Record<string, unknown> = {
      repoId: ing.repoId, commitSha: ing.commitSha, overview, dependencies, tree: buildTree(paths),
    };

    if (body.summary) {
      const key = Deno.env.get("GROQ_API_KEY");
      if (!key) return json({ ...result, summaryError: "AI service is not configured" });
      const readme = paths.find((p) => /^readme(\.md)?$/i.test(p));
      const want = [readme, ...manifests.slice(0, 1), ...overview.entryPoints.slice(0, 3)].filter((p): p is string => !!p);
      const snippets: Chunk[] = (await Promise.all(want.map(async (p) => {
        const t = await read(p);
        return t ? chunkFile(p, t, 80).slice(0, 1) : [];
      }))).flat();
      const facts = `Languages: ${overview.languages.map((l) => `${l.name} (${l.files})`).join(", ")}\nTop directories: ${overview.topDirs.slice(0, 8).map((d) => `${d.name} (${d.files})`).join(", ")}\nEntry points: ${overview.entryPoints.join(", ") || "none detected"}`;
      const msgs = buildMessages(`Summarize the architecture of this repository: purpose, main modules, and how the entry points connect. Detected facts (not from snippets):\n${facts}`, snippets);
      const g = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: msgs, temperature: 0.2, max_tokens: 1500, reasoning_effort: "low" }),
        signal: AbortSignal.timeout(25_000),
      });
      if (g.ok) {
        const answer = (await g.json()).choices?.[0]?.message?.content;
        if (typeof answer === "string" && answer.trim()) {
          result.summary = answer;
          result.citations = checkCitations(answer, snippets);
          result.summarySources = snippets.map((s) => `${s.path}:${s.start}-${s.end}`);
        } else result.summaryError = "AI returned an empty response";
      } else {
        console.error("Groq status:", g.status);
        result.summaryError = g.status === 429 ? "AI rate limit reached. Try again shortly." : "AI service error";
      }
    }
    return json(result);
  } catch (e) {
    console.error("repo-overview failed:", e instanceof Error ? e.name : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
