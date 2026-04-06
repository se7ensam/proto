CREATE TABLE "github_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"github_access_token" text NOT NULL,
	"github_refresh_token" text,
	"github_token_expires_at" timestamp,
	"github_username" text NOT NULL,
	"github_user_id" text NOT NULL,
	"github_email" text,
	"github_avatar_url" text,
	"repo_name" text,
	"repo_full_name" text,
	"repo_url" text,
	"repo_owner" text,
	"repo_is_private" boolean DEFAULT true,
	"collaborator_username" text,
	"collaborator_email" text,
	"collaboration_status" text DEFAULT 'none',
	"integration_status" text DEFAULT 'configured',
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_sync_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" uuid NOT NULL,
	"sync_type" text NOT NULL,
	"plan_section_id" uuid,
	"message_id" uuid,
	"github_resource_type" text,
	"github_resource_id" text,
	"github_resource_number" text,
	"github_resource_url" text,
	"status" text NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_sync_history" ADD CONSTRAINT "github_sync_history_integration_id_github_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."github_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_sync_history" ADD CONSTRAINT "github_sync_history_plan_section_id_plan_sections_id_fk" FOREIGN KEY ("plan_section_id") REFERENCES "public"."plan_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_sync_history" ADD CONSTRAINT "github_sync_history_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_integrations_user_id_idx" ON "github_integrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_integrations_conversation_id_idx" ON "github_integrations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "github_integrations_github_user_id_idx" ON "github_integrations" USING btree ("github_user_id");--> statement-breakpoint
CREATE INDEX "github_sync_history_integration_id_idx" ON "github_sync_history" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "github_sync_history_status_idx" ON "github_sync_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "github_sync_history_created_at_idx" ON "github_sync_history" USING btree ("created_at");