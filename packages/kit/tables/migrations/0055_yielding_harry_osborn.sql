ALTER TABLE "Instances" RENAME COLUMN "base_url" TO "domain";--> statement-breakpoint
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_uri_unique";--> statement-breakpoint
ALTER TABLE "Reaction" DROP COLUMN "uri";