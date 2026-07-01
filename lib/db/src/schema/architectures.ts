import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const architecturesTable = pgTable("architectures", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  requirements: text("requirements").notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertArchitectureSchema = createInsertSchema(architecturesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectArchitectureSchema = createSelectSchema(architecturesTable);

export type InsertArchitecture = z.infer<typeof insertArchitectureSchema>;
export type Architecture = typeof architecturesTable.$inferSelect;
