/**
 * Local, dependency-free secret and sensitive-data scanner.
 *
 * Purely regex + heuristics — nothing ever leaves the process. Used by the
 * frontend before generate/validate/save/export to warn the user when content
 * looks like it contains live credentials.
 */

export type SecretSeverity = "critical" | "warning";

export interface SecretFinding {
  /** Stable id within one scan result (kind + occurrence index). */
  id: string;
  /** Machine-friendly pattern kind, e.g. "aws-access-key". */
  kind: string;
  /** Human label shown in the warning UI. */
  label: string;
  severity: SecretSeverity;
  /** The field/source this was found in (set by scanFields). */
  field?: string;
  /** Masked preview of the match, safe to render. */
  preview: string;
  /** 1-based line number within the scanned text. */
  line: number;
  /** The exact matched text (kept for redaction; never render directly). */
  match: string;
}

interface SecretPattern {
  kind: string;
  label: string;
  severity: SecretSeverity;
  re: RegExp;
  /** Optional filter to drop obvious placeholders and false positives. */
  accept?: (match: string) => boolean;
}

const PLACEHOLDER_RE =
  /example|sample|placeholder|changeme|change_me|your[_-]?|dummy|xxxx|test|<[^>]*>|\$\{|\{\{/i;

const notPlaceholder = (m: string) => !PLACEHOLDER_RE.test(m);

/**
 * Ordered pattern table. Specific, high-confidence token formats first
 * (critical), generic assignment heuristics last (warning).
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  { kind: "private-key", label: "Private key block", severity: "critical", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { kind: "aws-access-key", label: "AWS access key ID", severity: "critical", re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g },
  { kind: "aws-secret-key", label: "AWS secret access key", severity: "critical", re: /\baws_secret_access_key\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi, accept: notPlaceholder },
  { kind: "github-token", label: "GitHub token", severity: "critical", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{36,}\b/g },
  { kind: "gcp-api-key", label: "Google API key", severity: "critical", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: "gcp-service-account", label: "GCP service account key", severity: "critical", re: /"type"\s*:\s*"service_account"/g },
  { kind: "azure-storage-key", label: "Azure storage account key", severity: "critical", re: /AccountKey=[A-Za-z0-9+/=]{60,}/g },
  { kind: "azure-sas", label: "Azure SAS token", severity: "critical", re: /[?&]sig=[A-Za-z0-9%+/=]{30,}/g },
  { kind: "openai-key", label: "OpenAI API key", severity: "critical", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { kind: "groq-key", label: "Groq API key", severity: "critical", re: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { kind: "anthropic-key", label: "Anthropic API key", severity: "critical", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { kind: "stripe-key", label: "Stripe secret key", severity: "critical", re: /\b[sr]k_live_[A-Za-z0-9]{20,}\b/g },
  { kind: "slack-token", label: "Slack token", severity: "critical", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "jwt", label: "JSON Web Token", severity: "warning", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    kind: "connection-string",
    label: "Connection string with password",
    severity: "critical",
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s:@"']+:([^\s@"']+)@[^\s"']+/gi,
    accept: (m) => !/:\/\/[^:]+:(?:\$\{|\{\{|<|password\b|pass\b|xxx)/i.test(m),
  },
  {
    kind: "password-assignment",
    label: "Hardcoded password",
    severity: "warning",
    re: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']([^"']{6,})["']/gi,
    accept: notPlaceholder,
  },
  {
    kind: "secret-assignment",
    label: "Hardcoded secret or API key",
    severity: "warning",
    re: /\b(?:api[_-]?key|apikey|secret[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token|secret)\b\s*[:=]\s*["']([A-Za-z0-9_\-+/=.]{12,})["']/gi,
    accept: notPlaceholder,
  },
  {
    kind: "bearer-token",
    label: "Bearer token",
    severity: "warning",
    re: /\bBearer\s+[A-Za-z0-9_\-.~+/]{25,}=*/g,
    accept: notPlaceholder,
  },
];

const REDACTED = "<REDACTED>";

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

export function maskSecret(match: string): string {
  const flat = match.replace(/\s+/g, " ");
  if (flat.length <= 12) return `${flat.slice(0, 3)}…`;
  return `${flat.slice(0, 8)}…${flat.slice(-4)} (${flat.length} chars)`;
}

/** Scan one text blob. Returns findings ordered by position. */
export function scanContent(text: string, field?: string): SecretFinding[] {
  if (!text) return [];
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();

  for (const pattern of SECRET_PATTERNS) {
    pattern.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.re.exec(text))) {
      const match = m[0];
      if (pattern.accept && !pattern.accept(match)) continue;
      // Dedup identical matches of the same kind, and skip regions already
      // claimed by a more specific (earlier) pattern.
      const key = `${m.index}:${match}`;
      if (seen.has(key)) continue;
      const overlaps = findings.some(
        (f) => field === f.field && f.match === match && f.line === lineOf(text, m!.index),
      );
      if (overlaps) continue;
      seen.add(key);
      findings.push({
        id: `${pattern.kind}-${field ?? "content"}-${findings.length}`,
        kind: pattern.kind,
        label: pattern.label,
        severity: pattern.severity,
        field,
        preview: maskSecret(match),
        line: lineOf(text, m.index),
        match,
      });
      // Safety valve for pathological inputs.
      if (findings.length >= 100) return findings;
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

/** Scan several named fields (e.g. every section of a generated architecture). */
export function scanFields(fields: Record<string, string | undefined | null>): SecretFinding[] {
  const all: SecretFinding[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value === "string" && value) all.push(...scanContent(value, field));
  }
  return all;
}

/** Replace every finding's matched text with a redaction marker. */
export function redactContent(text: string, findings: SecretFinding[]): string {
  let out = text;
  for (const f of findings) {
    if (!f.match) continue;
    out = out.split(f.match).join(REDACTED);
  }
  return out;
}

/** Redact findings across a set of named fields; returns a new record. */
export function redactFields<T extends Record<string, unknown>>(
  fields: T,
  findings: SecretFinding[],
): T {
  const out: Record<string, unknown> = { ...fields };
  for (const f of findings) {
    if (!f.field || typeof out[f.field] !== "string") continue;
    out[f.field] = (out[f.field] as string).split(f.match).join(REDACTED);
  }
  return out as T;
}

export function hasCritical(findings: SecretFinding[]): boolean {
  return findings.some((f) => f.severity === "critical");
}
