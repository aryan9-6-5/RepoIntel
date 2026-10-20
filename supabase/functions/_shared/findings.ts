export type Severity = 'high' | 'medium' | 'low';

export interface Finding {
  rule: string;
  title: string;
  line: number; // 1-based
  severity: Severity;
  /** static = deterministic pattern match; hypothesis = model suggestion, unverified */
  kind: 'static' | 'hypothesis';
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
  rationale: string;
  /** how a developer can try to trigger/confirm it (static rules: fixed text; hypotheses: model text, unverified) */
  reproduction?: string;
}

const RULES: { rule: string; title: string; severity: Severity; re: RegExp; why: string; repro: string }[] = [
  { rule: 'eval', title: 'Dynamic code execution', severity: 'high', re: /\b(eval\s*\(|new\s+Function\s*\()/, why: 'Executes arbitrary strings as code; injection risk if input is attacker-influenced.', repro: 'Trace where the evaluated string comes from; pass a payload such as `process.exit(1)` and see whether it runs.' },
  { rule: 'hardcoded-secret', title: 'Possible hardcoded secret', severity: 'high', re: /(gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|(password|secret|api[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"])/i, why: 'Credentials in source are exposed to anyone with repo access.', repro: 'Check whether the value is a real credential (try it against the service in a safe environment), then rotate it and move it to a secret store.' },
  { rule: 'html-injection', title: 'Unescaped HTML sink', severity: 'medium', re: /(\.innerHTML\s*=|dangerouslySetInnerHTML|document\.write\s*\()/, why: 'Writing untrusted data to HTML sinks enables XSS.', repro: 'Feed the sink a string like `<img src=x onerror=alert(1)>` through the code path that reaches it and watch for execution.' },
  { rule: 'empty-catch', title: 'Swallowed exception', severity: 'low', re: /catch\s*(\([^)]*\))?\s*\{\s*\}/, why: 'Errors are silently ignored, hiding failures.', repro: 'Make the guarded call throw (bad input or a mocked failure) and check that the failure is surfaced or logged.' },
  { rule: 'loose-equality-null', title: 'Assignment in condition', severity: 'low', re: /\bif\s*\(\s*[A-Za-z_$][\w$.]*\s=\s[^=]/, why: 'Single "=" inside an if condition is usually a typo for a comparison.', repro: 'Run the branch with a value that makes the assignment truthy and falsy and compare against the intended comparison.' },
];

/** Deterministic, line-accurate pattern checks. Findings are patterns, not proven exploitable bugs. */
export function staticChecks(text: string): Finding[] {
  const out: Finding[] = [];
  text.split('\n').forEach((raw, i) => {
    const t = raw.trim();
    if (t.startsWith('//') || t.startsWith('#') || t.startsWith('*')) return;
    for (const r of RULES) {
      if (r.re.test(raw)) {
        out.push({ rule: r.rule, title: r.title, line: i + 1, severity: r.severity, kind: 'static', confidence: 'medium', evidence: t.slice(0, 160), rationale: r.why, reproduction: r.repro });
      }
    }
  });
  return out;
}

/** Keep only model suggestions whose line exists; mark them unverified hypotheses. */
export function validateHypotheses(raw: unknown, text: string): Finding[] {
  if (!Array.isArray(raw)) return [];
  const lines = text.split('\n');
  const out: Finding[] = [];
  for (const f of raw.slice(0, 10)) {
    if (typeof f !== 'object' || f === null) continue;
    const o = f as Record<string, unknown>;
    const line = Number(o.line);
    if (!Number.isInteger(line) || line < 1 || line > lines.length || typeof o.title !== 'string') continue;
    const sev: Severity = o.severity === 'high' || o.severity === 'medium' ? o.severity : 'low';
    out.push({
      rule: 'llm', title: o.title.slice(0, 120), line, severity: sev, kind: 'hypothesis', confidence: 'low',
      evidence: lines[line - 1].trim().slice(0, 160), rationale: typeof o.rationale === 'string' ? o.rationale.slice(0, 400) : '',
      reproduction: typeof o.reproduction === 'string' && o.reproduction.trim() ? o.reproduction.trim().slice(0, 300) : undefined,
    });
  }
  return out;
}

/** Benchmark scoring: findings are matched to labeled seeded bugs by rule + line. */
export function score(found: Finding[], labels: { rule: string; line: number }[]) {
  const hit = (l: { rule: string; line: number }) => found.some((f) => f.rule === l.rule && f.line === l.line);
  const tp = labels.filter(hit).length;
  const fp = found.filter((f) => !labels.some((l) => l.rule === f.rule && l.line === f.line)).length;
  return { tp, fp, fn: labels.length - tp, precision: found.length ? tp / found.length : 1, recall: labels.length ? tp / labels.length : 1 };
}
