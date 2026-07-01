import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mermaid } from "./mermaid";
import { CodeBlock } from "./code-block";
import { Button } from "@/components/ui/button";
import { Download, Edit2 } from "lucide-react";

interface ArchitectureData {
  id?: number;
  title?: string;
  diagram?: string;
  terraform?: string;
  costEstimate?: string;
  securityRecommendations?: string;
  highAvailabilityPlan?: string;
  databaseRecommendation?: string;
  kubernetesDeployment?: string;
  cicdPipeline?: string;
  monitoringSetup?: string;
  disasterRecovery?: string;
}

interface ArchitectureViewerProps {
  architecture: ArchitectureData;
  isDetail?: boolean;
}

export function ArchitectureViewer({ architecture, isDetail }: ArchitectureViewerProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="diagram" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-2 bg-muted/50 p-2 justify-start">
          <TabsTrigger value="diagram">Diagram</TabsTrigger>
          <TabsTrigger value="terraform">Terraform</TabsTrigger>
          <TabsTrigger value="cost">Cost Estimate</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="ha">High Availability</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="k8s">Kubernetes</TabsTrigger>
          <TabsTrigger value="cicd">CI/CD</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="dr">Disaster Recovery</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="diagram" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Architecture Diagram</CardTitle>
                <CardDescription>Visual representation of the generated AWS architecture.</CardDescription>
              </CardHeader>
              <CardContent>
                {architecture.diagram ? (
                  <Mermaid chart={architecture.diagram} />
                ) : (
                  <p className="text-muted-foreground">No diagram generated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terraform" className="m-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Terraform Infrastructure</CardTitle>
                  <CardDescription>Infrastructure as Code configuration.</CardDescription>
                </div>
                {isDetail && architecture.id && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/architectures/${architecture.id}/terraform`} download={`architecture-${architecture.id}.tf`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download .tf
                    </a>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {architecture.terraform ? (
                  <CodeBlock code={architecture.terraform} language="hcl" />
                ) : (
                  <p className="text-muted-foreground">No Terraform code generated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Cost Estimate</CardTitle>
                <CardDescription>Estimated monthly AWS infrastructure costs.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap font-mono text-sm">{architecture.costEstimate}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Security Recommendations</CardTitle>
                <CardDescription>IAM, network security, and compliance.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap font-mono text-sm">{architecture.securityRecommendations}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ha" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>High Availability Plan</CardTitle>
                <CardDescription>Fault tolerance and multi-AZ/Region strategies.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap font-mono text-sm">{architecture.highAvailabilityPlan}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Database Recommendation</CardTitle>
                <CardDescription>Data storage, caching, and persistence choices.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap font-mono text-sm">{architecture.databaseRecommendation}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="k8s" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Kubernetes Deployment</CardTitle>
                <CardDescription>EKS configuration and workload manifests.</CardDescription>
              </CardHeader>
              <CardContent>
                {architecture.kubernetesDeployment ? (
                  <CodeBlock code={architecture.kubernetesDeployment} language="yaml" />
                ) : (
                  <p className="text-muted-foreground">No Kubernetes deployment generated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cicd" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>CI/CD Pipeline</CardTitle>
                <CardDescription>GitHub Actions or GitLab CI workflows.</CardDescription>
              </CardHeader>
              <CardContent>
                {architecture.cicdPipeline ? (
                  <CodeBlock code={architecture.cicdPipeline} language="yaml" />
                ) : (
                  <p className="text-muted-foreground">No CI/CD pipeline generated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Monitoring Setup</CardTitle>
                <CardDescription>Observability, logging, and alerting strategy.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap font-mono text-sm">{architecture.monitoringSetup}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dr" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Disaster Recovery Plan</CardTitle>
                <CardDescription>RTO/RPO targets, backup strategies, and failover process.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap font-mono text-sm">{architecture.disasterRecovery}</div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
