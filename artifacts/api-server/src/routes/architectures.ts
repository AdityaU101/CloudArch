import { Router } from "express";
import { eq, count, gte, desc } from "drizzle-orm";
import { db, architecturesTable } from "@workspace/db";
import {
  GetArchitectureParams,
  UpdateArchitectureParams,
  UpdateArchitectureBody,
  DeleteArchitectureParams,
  SaveArchitectureBody,
  GenerateArchitectureBody,
  DownloadTerraformParams,
} from "@workspace/api-zod";
import { groq, GROQ_MODEL } from "../lib/groq";

const router = Router();

const SYSTEM_PROMPT = `You are an expert AWS cloud architect. Given a set of business/application requirements, you produce a complete, production-ready cloud architecture plan.

You MUST respond with a JSON object containing EXACTLY these fields (all required, all strings):
{
  "title": "Short descriptive title for this architecture",
  "diagram": "A complete Mermaid diagram showing all AWS services and their connections",
  "terraform": "Complete Terraform HCL code with provider config, all resources, variables, and outputs",
  "costEstimate": "Detailed monthly cost breakdown per service with total estimate",
  "securityRecommendations": "Numbered list of security best practices and specific AWS security services to use",
  "highAvailabilityPlan": "Multi-AZ / multi-region strategy, load balancing, auto-scaling details",
  "databaseRecommendation": "Specific database service recommendation with instance type, size, backup strategy",
  "kubernetesDeployment": "Complete Kubernetes YAML manifests (Deployment, Service, HPA, Ingress)",
  "cicdPipeline": "CI/CD pipeline definition using AWS CodePipeline or GitHub Actions YAML",
  "monitoringSetup": "CloudWatch dashboards, alarms, log groups, and SNS alerting setup",
  "disasterRecovery": "RTO/RPO targets, backup strategy, cross-region failover procedure"
}

CRITICAL MERMAID DIAGRAM RULES — follow exactly or the diagram will break:

1. Start with "graph TD" (top-down) — never use flowchart, sequenceDiagram, or graph LR
2. Node IDs: alphanumeric only, no spaces — User, ALB, EC2Auto, RDSPrimary
3. Node labels must NEVER use quotes — write EC2(EC2 Auto Scaling) NOT EC2("EC2 Auto Scaling")
4. Use these shapes:
   - Rounded box for services: EC2(EC2 Instances)
   - Cylinder for databases: RDS[(RDS Aurora)]
   - Diamond for decisions: WAF{AWS WAF}
   - Rectangle for groups: IGW[Internet Gateway]
5. Use subgraphs to group by AWS boundary:
   subgraph Internet[Public Internet]
   subgraph VPC[AWS VPC - us-east-1]
   subgraph AZ1[Availability Zone 1]
6. Arrows: --> with optional label: EC2 -->|writes| S3
7. Add classDef color blocks right after "graph TD" — copy these EXACTLY:
   classDef compute fill:#FF9900,stroke:#E8871D,color:#000,font-weight:bold
   classDef database fill:#3F48CC,stroke:#2E37B8,color:#fff,font-weight:bold
   classDef network fill:#8C4FFF,stroke:#7B3FE4,color:#fff,font-weight:bold
   classDef storage fill:#3F8624,stroke:#2E7218,color:#fff,font-weight:bold
   classDef security fill:#DD344C,stroke:#C2293F,color:#fff,font-weight:bold
   classDef cache fill:#C7131F,stroke:#A50E18,color:#fff,font-weight:bold
   classDef user fill:#232F3E,stroke:#FF9900,color:#FF9900,font-weight:bold
   classDef messaging fill:#E7157B,stroke:#C4106A,color:#fff,font-weight:bold
8. After all nodes, assign classes: class EC2,Lambda,EKS compute
9. NEVER put quotes anywhere in the diagram string

Example of correct format:
graph TD
  classDef compute fill:#FF9900,stroke:#E8871D,color:#000,font-weight:bold
  classDef database fill:#3F48CC,stroke:#2E37B8,color:#fff,font-weight:bold
  classDef network fill:#8C4FFF,stroke:#7B3FE4,color:#fff,font-weight:bold
  classDef storage fill:#3F8624,stroke:#2E7218,color:#fff,font-weight:bold
  classDef security fill:#DD344C,stroke:#C2293F,color:#fff,font-weight:bold
  Users([End Users]) --> CDN(CloudFront CDN)
  CDN --> WAF{AWS WAF}
  WAF --> ALB(Application Load Balancer)
  subgraph VPC[AWS VPC]
    ALB --> EC2(EC2 Auto Scaling Group)
    EC2 --> RDS[(RDS Aurora PostgreSQL)]
    EC2 --> Cache(ElastiCache Redis)
    EC2 --> S3[S3 Object Storage]
  end
  class EC2 compute
  class RDS database
  class ALB,WAF network
  class S3 storage
  class Cache cache

Be specific and thorough. Use real AWS service names, real instance types, real pricing. Make the Terraform and Kubernetes manifests actually deployable.`;

router.get("/architectures", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(architecturesTable)
      .orderBy(desc(architecturesTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list architectures");
    res.status(500).json({ error: "Failed to list architectures" });
  }
});

router.get("/architectures/stats", async (req, res) => {
  try {
    const [totalRow] = await db.select({ count: count() }).from(architecturesTable);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentRow] = await db
      .select({ count: count() })
      .from(architecturesTable)
      .where(gte(architecturesTable.createdAt, sevenDaysAgo));
    const [latest] = await db
      .select({ title: architecturesTable.title })
      .from(architecturesTable)
      .orderBy(desc(architecturesTable.createdAt))
      .limit(1);

    res.json({
      totalCount: totalRow?.count ?? 0,
      recentCount: recentRow?.count ?? 0,
      latestTitle: latest?.title ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.post("/architectures/generate", async (req, res) => {
  const parsed = GenerateArchitectureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "requirements is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { requirements } = parsed.data;

  try {
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate a complete AWS cloud architecture for the following requirements:\n\n${requirements}`,
        },
      ],
      stream: true,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`);
      }
    }

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(fullResponse);
    } catch {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: "AI returned invalid JSON" })}\n\n`,
      );
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ type: "done", result: parsed })}\n\n`);
    res.end();
  } catch (err: unknown) {
    req.log.error({ err }, "Groq generation failed");
    const message =
      err instanceof Error ? err.message : "AI generation failed";
    res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    res.end();
  }
});

router.post("/architectures", async (req, res) => {
  const parsed = SaveArchitectureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const [row] = await db
      .insert(architecturesTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to save architecture");
    res.status(500).json({ error: "Failed to save architecture" });
  }
});

router.get("/architectures/:id", async (req, res) => {
  const params = GetArchitectureParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(architecturesTable)
      .where(eq(architecturesTable.id, params.data.id));
    if (!row) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get architecture");
    res.status(500).json({ error: "Failed to get architecture" });
  }
});

router.patch("/architectures/:id", async (req, res) => {
  const params = UpdateArchitectureParams.safeParse({
    id: Number(req.params.id),
  });
  const body = UpdateArchitectureBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  try {
    const [row] = await db
      .update(architecturesTable)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(architecturesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update architecture");
    res.status(500).json({ error: "Failed to update architecture" });
  }
});

router.delete("/architectures/:id", async (req, res) => {
  const params = DeleteArchitectureParams.safeParse({
    id: Number(req.params.id),
  });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await db
      .delete(architecturesTable)
      .where(eq(architecturesTable.id, params.data.id))
      .returning();
    if (!deleted.length) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete architecture");
    res.status(500).json({ error: "Failed to delete architecture" });
  }
});

router.get("/architectures/:id/terraform", async (req, res) => {
  const params = DownloadTerraformParams.safeParse({
    id: Number(req.params.id),
  });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(architecturesTable)
      .where(eq(architecturesTable.id, params.data.id));
    if (!row) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="main.tf"`,
    );
    res.send(row.terraform);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch terraform");
    res.status(500).json({ error: "Failed to fetch terraform" });
  }
});

export default router;
