import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeverityBadge } from "@/components/threat-model-view";
import { streamJsonEvents } from "@/lib/sse-stream";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  FileCode2,
  FileSearch,
  Loader2,
  ShieldCheck,
  Upload,
  BookOpenCheck,
  Wrench,
} from "lucide-react";

type IacFormat = "terraform" | "cloudformation" | "kubernetes";

interface ValidationFinding {
  severity?: string;
  title?: string;
  resource?: string;
  explanation?: string;
  recommendation?: string;
  wellArchitectedPillar?: string;
}

interface ValidationResult {
  summary?: string;
  scores?: Record<string, number>;
  findings?: ValidationFinding[];
}

const FORMAT_OPTIONS: { value: IacFormat; label: string }[] = [
  { value: "terraform", label: "Terraform (HCL)" },
  { value: "cloudformation", label: "CloudFormation" },
  { value: "kubernetes", label: "Kubernetes YAML" },
];

const SCORE_LABELS: { key: string; label: string }[] = [
  { key: "security", label: "Security" },
  { key: "reliability", label: "Reliability" },
  { key: "costEfficiency", label: "Cost Efficiency" },
  { key: "scalability", label: "Scalability" },
  { key: "operationalMaturity", label: "Operational Maturity" },
];

/** Best-effort format detection for uploaded files; the user can override. */
function detectFormat(filename: string, content: string): IacFormat {
  if (/\.tf(vars)?$/i.test(filename)) return "terraform";
  if (/AWSTemplateFormatVersion|AWS::/i.test(content)) return "cloudformation";
  if (/^\s*(apiVersion|kind)\s*:/m.test(content)) return "kubernetes";
  return "terraform";
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-yellow-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
}

function ScoreCard({ label, score, index }: { label: string; score: number; index: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">{label}</CardDescription>
          <CardTitle className={cn("text-3xl tabular-nums", scoreColor(clamped))}>
            {clamped}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${clamped}%` }}
              transition={{ duration: 0.7, delay: 0.2 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className={cn("h-full rounded-full", scoreBarColor(clamped))}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FindingCard({ finding, index }: { finding: ValidationFinding; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge level={finding.severity} />
            <CardTitle className="text-base">{finding.title}</CardTitle>
          </div>
          {finding.resource && (
            <CardDescription className="font-mono text-xs">{finding.resource}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>{finding.explanation}</p>
          {finding.recommendation && (
            <div className="flex gap-2 rounded-md border border-primary/15 bg-primary/5 p-3">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-muted-foreground">{finding.recommendation}</p>
            </div>
          )}
          {finding.wellArchitectedPillar && (
            <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
              <BookOpenCheck className="h-3 w-3 text-primary" />
              Well-Architected · {finding.wellArchitectedPillar}
            </Badge>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Validate() {
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<IacFormat>("terraform");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    const text = await file.text();
    setSource(text);
    setFileName(file.name);
    setFormat(detectFormat(file.name, text));
  };

  const handleAnalyze = async () => {
    if (!source.trim()) return;

    setIsAnalyzing(true);
    setStreamText("");
    setResult(null);

    try {
      await streamJsonEvents<ValidationResult>(
        "/api/validations/analyze",
        { source, format },
        {
          onChunk: (content) => setStreamText((prev) => prev + content),
          onDone: (result) => setResult(result),
          onError: (error) =>
            toast({
              title: "Validation Failed",
              description: error,
              variant: "destructive",
            }),
        },
      );
    } catch {
      toast({
        title: "Validation Error",
        description: "Failed to connect to the validation service.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          <ShieldCheck className="h-3 w-3" />
          Architecture Validator
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Validate your infrastructure</h1>
        <p className="max-w-2xl text-muted-foreground">
          Upload or paste Terraform, CloudFormation, or Kubernetes manifests. Get Well-Architected scores and prioritized findings with concrete fixes.
        </p>
      </motion.div>

      <Card className="overflow-hidden border-primary/15 bg-card/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            Infrastructure code
          </CardTitle>
          <CardDescription>The validator checks encryption, IAM, networking, backups, availability, logging, secrets, and cost.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={format} onValueChange={(v) => setFormat(v as IacFormat)}>
              <SelectTrigger className="w-[190px] bg-background/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              ref={fileInputRef}
              type="file"
              accept=".tf,.tfvars,.yaml,.yml,.json,.template"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload file
            </Button>
            {fileName && (
              <span className="font-mono text-xs text-muted-foreground">{fileName}</span>
            )}
          </div>

          <Textarea
            placeholder={'e.g.\nresource "aws_s3_bucket" "assets" {\n  bucket = "my-app-assets"\n  acl    = "public-read"\n}'}
            className="min-h-[220px] resize-none bg-background/60 font-mono text-sm"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setFileName(null);
            }}
          />

          <Button onClick={handleAnalyze} disabled={isAnalyzing || !source.trim()} className="w-full gap-2 sm:w-auto">
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Auditing infrastructure…
              </>
            ) : (
              <>
                <FileSearch className="h-4 w-4" />
                Analyze infrastructure
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {isAnalyzing && !result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-mono text-sm text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Streaming audit findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-md bg-background/70 p-4 font-mono text-xs text-muted-foreground">
                  {streamText || "Connecting to infrastructure auditor…"}
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary/70 align-middle" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Validation report</h2>
              {result.summary && (
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {SCORE_LABELS.map(({ key, label }, i) => (
                <ScoreCard key={key} label={label} score={result.scores?.[key] ?? 0} index={i} />
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold tracking-tight">
                Findings
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {result.findings?.length ?? 0} issue{(result.findings?.length ?? 0) === 1 ? "" : "s"} detected
                </span>
              </h3>
              {result.findings?.length ? (
                <div className="space-y-4">
                  {result.findings.map((finding, i) => (
                    <FindingCard key={i} finding={finding} index={i} />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <ShieldCheck className="mb-4 h-12 w-12 text-emerald-400" />
                    <p className="text-lg font-medium">No issues found</p>
                    <p className="text-sm text-muted-foreground">This infrastructure passed all checks.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
