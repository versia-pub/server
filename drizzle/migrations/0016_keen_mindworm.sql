ALTER TABLE "Applications" RENAME COLUMN "redirect_uris" TO "redirect_uri";--> statement-breakpoint
ALTER TABLE "Tokens" ADD COLUMN "client_id" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "Tokens" ADD COLUMN "redirect_uri" text NOT NULL DEFAULT '';