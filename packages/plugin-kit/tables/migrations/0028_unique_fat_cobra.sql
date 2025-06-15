ALTER TABLE "Challenges" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "Instances" ADD COLUMN "protocol" text DEFAULT 'lysand' NOT NULL;