import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const architecturesTable = pgTable("architectures", {
  id: serial("id").primaryKey(),
  // Nullable so rows saved before auth existed keep working; ownerless rows
  // are simply invisible in the per-user library.
  userId: integer("user_id"),
  workspaceId: integer("workspace_id"),
  title: text("title").notNull(),
  requirements: text("requirements").notNull(),
  provider: text("provider").notNull().default("aws"),
  diagram: text("diagram").notNull(),
  terraform: text("terraform").notNull(),
  costEstimate: text("cost_estimate").notNull(),
  securityRecommendations: text("security_recommendations").notNull(),
  highAvailabilityPlan: text("high_availability_plan").notNull(),
  databaseRecommendation: text("database_recommendation").notNull(),
  kubernetesDeployment: text("kubernetes_deployment").notNull(),
  cicdPipeline: text("cicd_pipeline").notNull(),
  monitoringSetup: text("monitoring_setup").notNull(),
  disasterRecovery: text("disaster_recovery").notNull(),
  threatModel: text("threat_model").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertArchitectureSchema = createInsertSchema(architecturesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectArchitectureSchema = createSelectSchema(architecturesTable);

export type InsertArchitecture = z.infer<typeof insertArchitectureSchema>;
export type Architecture = typeof architecturesTable.$inferSelect;
