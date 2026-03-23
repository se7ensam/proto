ALTER TABLE "plan_sections" ADD COLUMN "phase_id" text;--> statement-breakpoint
ALTER TABLE "plan_sections" ADD COLUMN "phase_order" integer;--> statement-breakpoint
ALTER TABLE "plan_sections" ADD COLUMN "structured_data" jsonb;--> statement-breakpoint
CREATE INDEX "plan_sections_phase_id_idx" ON "plan_sections" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "plan_sections_phase_order_idx" ON "plan_sections" USING btree ("phase_order");