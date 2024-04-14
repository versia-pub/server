ALTER TABLE "Instance" RENAME COLUMN "disableAutomoderation" TO "disable_automoderation";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME COLUMN "showingReblogs" TO "showing_reblogs";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME COLUMN "followedBy" TO "followed_by";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME COLUMN "blockedBy" TO "blocked_by";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME COLUMN "mutingNotifications" TO "muting_notifications";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME COLUMN "domainBlocking" TO "domain_blocking";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "Relationship" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "Status" RENAME COLUMN "contentType" TO "content_type";--> statement-breakpoint
ALTER TABLE "Status" RENAME COLUMN "spoilerText" TO "spoiler_text";--> statement-breakpoint
ALTER TABLE "Status" RENAME COLUMN "contentSource" TO "content_source";--> statement-breakpoint
ALTER TABLE "Status" DROP CONSTRAINT "Status_reblogId_fkey";
--> statement-breakpoint
ALTER TABLE "Status" DROP CONSTRAINT "Status_inReplyToPostId_fkey";
--> statement-breakpoint
ALTER TABLE "Status" DROP CONSTRAINT "Status_quotingPostId_fkey";
--> statement-breakpoint
DROP INDEX IF EXISTS "Application_client_id_key";--> statement-breakpoint
DROP INDEX IF EXISTS "Status_uri_key";--> statement-breakpoint
ALTER TABLE "Relationship" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Status" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Application_client_id_index" ON "Application" ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Status_uri_index" ON "Status" ("uri");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_reblogId_Status_id_fk" FOREIGN KEY ("reblogId") REFERENCES "Status"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_inReplyToPostId_Status_id_fk" FOREIGN KEY ("inReplyToPostId") REFERENCES "Status"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Status" ADD CONSTRAINT "Status_quotingPostId_Status_id_fk" FOREIGN KEY ("quotingPostId") REFERENCES "Status"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
